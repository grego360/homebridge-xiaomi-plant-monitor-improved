import type { API, Logger } from "homebridge";
import {
  QUERY_RETRIES,
  QUERY_TIMEOUT_MS,
} from "./settings.js";
import type { MiFloraData, MiFloraDevice, PlantAccessory } from "./types.js";
import { accessoryContext, setAccessoryFault, updateAccessoryServices } from "./platformAccessory.js";
import { handleError, TimeoutError, withTimeout } from "./utils.js";

interface QueryOptions {
  retries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isUncancellableTimeout(error: Error): boolean {
  return error instanceof TimeoutError || /(?:timeout|timed out)/i.test(error.message);
}

async function readMiFloraData(device: MiFloraDevice): Promise<MiFloraData> {
  // miflora's combined query() adds a 10-second timeout around the complete
  // firmware + sensor sequence. Some Linux adapters legitimately take much
  // longer to establish the first GATT connection. Calling the two public
  // reads separately matches the library's documented usage and avoids that
  // additional combined deadline while reusing the same connection.
  if (device.queryFirmwareInfo && device.querySensorValues) {
    const firmwareInfo = await device.queryFirmwareInfo(true);
    const sensorValues = await device.querySensorValues(true);
    return { firmwareInfo, sensorValues };
  }

  return device.query();
}

export function isMiFloraData(value: unknown): value is MiFloraData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<MiFloraData>;
  return (
    typeof candidate.firmwareInfo?.firmware === "string" &&
    isFiniteNumber(candidate.firmwareInfo.battery) &&
    isFiniteNumber(candidate.sensorValues?.temperature) &&
    isFiniteNumber(candidate.sensorValues.lux) &&
    isFiniteNumber(candidate.sensorValues.moisture) &&
    isFiniteNumber(candidate.sensorValues.fertility)
  );
}

async function disconnect(device: MiFloraDevice | undefined, log: Logger): Promise<void> {
  if (!device?.disconnect) {
    return;
  }

  try {
    await device.disconnect();
  } catch (error) {
    handleError(log, `Could not disconnect ${device.address}`, error, "warn");
  }
}

export async function queryPlantData(
  plant: PlantAccessory,
  log: Logger,
  options: QueryOptions = {},
): Promise<MiFloraData> {
  if (!plant.device) {
    throw new Error("The Bluetooth device is not currently discoverable");
  }

  const retries = options.retries ?? QUERY_RETRIES;
  const timeoutMs = options.timeoutMs ?? QUERY_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? 3_000;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const result = await withTimeout(
        readMiFloraData(plant.device),
        timeoutMs,
        `Query timed out after ${timeoutMs} ms`,
      );
      if (!isMiFloraData(result)) {
        throw new Error("The sensor returned an invalid data payload");
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      handleError(
        log,
        `Query attempt ${attempt}/${retries} failed for ${plant.config.address}`,
        lastError,
        "warn",
      );
      await disconnect(plant.device, log);

      // A timed-out promise cannot be cancelled by the legacy miflora library.
      // Retrying immediately could create concurrent operations on one adapter.
      if (isUncancellableTimeout(lastError)) {
        log.warn(
          `Not retrying ${plant.config.address}; the timed-out BLE operation cannot be cancelled safely`,
        );
        break;
      }

      if (attempt === retries) {
        break;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, retryDelayMs * attempt);
      });
    }
  }

  throw lastError ?? new Error("The sensor query failed");
}

export async function disconnectPlantDevices(
  plants: PlantAccessory[],
  log: Logger,
): Promise<void> {
  await Promise.all(plants.map((plant) => disconnect(plant.device, log)));
}

async function updatePlantData(
  plant: PlantAccessory,
  log: Logger,
  api: API,
): Promise<void> {
  const context = accessoryContext(plant);

  if (!plant.device) {
    plant.consecutiveFailures += 1;
    context.consecutiveFailures = plant.consecutiveFailures;
    setAccessoryFault(plant, api, true);
    api.updatePlatformAccessories([plant.accessory]);
    log.debug(`No Bluetooth device available for ${plant.config.address}; retaining cached values`);
    return;
  }

  let querySucceeded = false;
  try {
    const data = await queryPlantData(plant, log);
    querySucceeded = true;
    updateAccessoryServices(plant, data, api);
    plant.consecutiveFailures = 0;
    context.consecutiveFailures = 0;
    context.lastSuccessfulRead = Date.now();
    context.lastData = data;

    const { battery, firmware } = data.firmwareInfo;
    const { temperature, lux, moisture, fertility } = data.sensorValues;
    const fertilitySummary = plant.config.displayFertility
      ? `, fertility ${fertility} µS/cm`
      : "";
    log.info(
      `${plant.config.name}: battery ${battery}%, firmware ${firmware}, temperature ${temperature}°C, light ${lux} lux, moisture ${moisture}%${fertilitySummary}`,
    );
  } catch (error) {
    plant.consecutiveFailures += 1;
    context.consecutiveFailures = plant.consecutiveFailures;
    setAccessoryFault(plant, api, true);
    handleError(log, `Unable to update ${plant.config.name}; retaining cached values`, error);
  } finally {
    if (querySucceeded && plant.device) {
      await disconnect(plant.device, log);
    }
    api.updatePlatformAccessories([plant.accessory]);
  }
}

/**
 * BLE operations are deliberately serialized. Most Homebridge installations
 * have a single adapter and parallel GATT connections are unreliable.
 */
export async function fetchPlantsData(
  plants: PlantAccessory[],
  log: Logger,
  api: API,
): Promise<void> {
  for (const plant of plants) {
    await updatePlantData(plant, log, api);
  }
}
