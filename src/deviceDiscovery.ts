import type { Logger } from "homebridge";
import { normalizeAddress } from "./config.js";
import {
  DEFAULT_DISCOVERY_DURATION_MS,
  DISCOVERY_TIMEOUT_MS,
} from "./settings.js";
import type { MiFloraDevice, NormalizedMiFloraConfig } from "./types.js";
import { withTimeout } from "./utils.js";

interface MiFloraModule {
  discover(options?: {
    duration?: number;
    ignoreUnknown?: boolean;
    addresses?: string[];
  }): Promise<MiFloraDevice[]>;
}

type MiFloraLoader = () => Promise<MiFloraModule>;

async function loadMiFlora(): Promise<MiFloraModule> {
  // Noble initializes its native HCI socket while the transport is loaded.
  // Loading it on demand lets Homebridge register the platform even when BLE
  // is unavailable, which is especially useful for container diagnostics.
  return import("./miFloraClient.js");
}

export async function discoverDevices(
  config: NormalizedMiFloraConfig,
  log: Logger,
  loader: MiFloraLoader = loadMiFlora,
): Promise<MiFloraDevice[]> {
  const addresses = config.hasExplicitDevices
    ? config.devices.map((device) => device.address)
    : undefined;
  const options = {
    duration: DEFAULT_DISCOVERY_DURATION_MS,
    addresses,
    ignoreUnknown: addresses !== undefined,
  };

  log.debug(`Bluetooth discovery options: ${JSON.stringify(options)}`);
  const miflora = await loader();
  const discovered = await withTimeout(
    miflora.discover(options),
    DISCOVERY_TIMEOUT_MS,
    `Discovery timed out after ${DISCOVERY_TIMEOUT_MS} ms`,
  );

  const devices = new Map<string, MiFloraDevice>();
  for (const device of discovered) {
    const address = normalizeAddress(device.address);
    device.address = address;
    devices.set(address, device);
  }

  log.info(`Bluetooth discovery found ${devices.size} plant(s)`);
  return [...devices.values()];
}
