import type {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
} from "homebridge";
import {
  deviceConfigForAddress,
  isSupportedAddress,
  normalizeAddress,
  normalizeConfig,
} from "./config.js";
import { disconnectPlantDevices, fetchPlantsData } from "./dataFetcher.js";
import { discoverDevices } from "./deviceDiscovery.js";
import { configureAccessoryServices } from "./platformAccessory.js";
import { PLATFORM_NAME, PLUGIN_NAME, PLUGIN_VERSION } from "./settings.js";
import type {
  MiFloraDevice,
  NormalizedMiFloraConfig,
  PlantAccessory,
  PlantAccessoryContext,
} from "./types.js";
import { handleError } from "./utils.js";

export class MifloraPlatform implements DynamicPlatformPlugin {
  private readonly plants: PlantAccessory[] = [];
  private readonly config: NormalizedMiFloraConfig;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private running = false;
  private shuttingDown = false;

  constructor(
    private readonly log: Logger,
    rawConfig: PlatformConfig,
    private readonly api: API,
  ) {
    this.config = normalizeConfig(rawConfig, log);

    this.api.on("didFinishLaunching", () => {
      void this.start().catch((error: unknown) => {
        handleError(this.log, "Could not start the platform", error);
      });
    });
    this.api.on("shutdown", () => {
      this.shuttingDown = true;
      if (this.pollTimer) {
        clearTimeout(this.pollTimer);
      }
      // Trigger disconnect synchronously so a pending native connection does
      // not keep a child bridge alive until the supervisor has to kill it.
      void disconnectPlantDevices(this.plants, this.log);
    });
  }

  private async start(): Promise<void> {
    this.log.info(
      `Starting Xiaomi Plant Monitor ${PLUGIN_VERSION}; polling every ${this.config.fetchDataIntervalInMs} ms`,
    );
    this.reconcileConfiguredAccessories();
    await this.run();
    this.scheduleNextRun();
  }

  private scheduleNextRun(): void {
    if (this.shuttingDown) {
      return;
    }

    this.pollTimer = setTimeout(() => {
      void this.run().finally(() => this.scheduleNextRun());
    }, this.config.fetchDataIntervalInMs);
  }

  async run(): Promise<void> {
    if (this.running) {
      this.log.warn("Skipping a polling cycle because the previous cycle is still running");
      return;
    }

    this.running = true;
    try {
      await this.searchAndAddNewPlants();
      await fetchPlantsData(this.plants, this.log, this.api);
    } catch (error) {
      handleError(this.log, "Unexpected polling-cycle failure", error);
    } finally {
      this.running = false;
    }
  }

  async searchAndAddNewPlants(): Promise<void> {
    try {
      const devices = await discoverDevices(this.config, this.log);
      for (const device of devices) {
        const address = normalizeAddress(device.address);
        if (!isSupportedAddress(address)) {
          this.log.warn(`Ignoring discovered device with invalid address: ${device.address}`);
          continue;
        }
        this.upsertPlant(address, device);
      }
    } catch (error) {
      handleError(
        this.log,
        "Bluetooth discovery failed; cached accessories will be retained",
        error,
        "warn",
      );
    }
  }

  private reconcileConfiguredAccessories(): void {
    for (const device of this.config.devices) {
      this.upsertPlant(device.address);
    }

    if (!this.config.hasExplicitDevices || this.config.devices.length === 0) {
      return;
    }

    const configuredAddresses = new Set(
      this.config.devices.map((device) => device.address),
    );
    for (let index = this.plants.length - 1; index >= 0; index -= 1) {
      const plant = this.plants[index];
      if (!configuredAddresses.has(plant.config.address)) {
        this.log.info(`Removing ${plant.config.name}; it is no longer configured`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          plant.accessory,
        ]);
        this.plants.splice(index, 1);
      }
    }
  }

  private upsertPlant(address: string, device?: MiFloraDevice): PlantAccessory {
    const normalizedAddress = normalizeAddress(address);
    const config = deviceConfigForAddress(this.config, normalizedAddress);
    let plant = this.plants.find(
      (candidate) => candidate.config.address === normalizedAddress,
    );

    if (plant) {
      plant.config = config;
      if (device) {
        plant.device = device;
      }
      configureAccessoryServices(plant, this.api, PLUGIN_VERSION);
      return plant;
    }

    const uuid = this.api.hap.uuid.generate(normalizedAddress);
    const accessory = new this.api.platformAccessory(config.name, uuid);
    const context = accessory.context as PlantAccessoryContext;
    context.deviceAddress = normalizedAddress;
    context.consecutiveFailures = 0;

    plant = {
      accessory,
      config,
      device,
      consecutiveFailures: 0,
    };
    configureAccessoryServices(plant, this.api, PLUGIN_VERSION);
    this.plants.push(plant);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    this.log.info(`Registered ${config.name} (${normalizedAddress})`);
    return plant;
  }

  configureAccessory(accessory: PlatformAccessory): void {
    const context = accessory.context as PlantAccessoryContext;
    const address = this.addressFromCachedAccessory(accessory, context);
    if (!address) {
      this.log.error(
        `Cannot restore cached accessory ${accessory.displayName}: no valid Bluetooth address was found`,
      );
      return;
    }

    context.deviceAddress = address;
    const plant: PlantAccessory = {
      accessory,
      config: deviceConfigForAddress(this.config, address),
      consecutiveFailures: context.consecutiveFailures ?? 0,
    };
    configureAccessoryServices(plant, this.api, PLUGIN_VERSION);
    this.plants.push(plant);
    this.api.updatePlatformAccessories([accessory]);
    this.log.info(`Restored cached accessory ${plant.config.name} (${address})`);
  }

  private addressFromCachedAccessory(
    accessory: PlatformAccessory,
    context: PlantAccessoryContext,
  ): string | undefined {
    const candidates: unknown[] = [context.deviceAddress, accessory.displayName];
    const information = accessory.getService(this.api.hap.Service.AccessoryInformation);
    if (information) {
      candidates.push(
        information.getCharacteristic(this.api.hap.Characteristic.SerialNumber).value,
      );
    }

    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const address = normalizeAddress(candidate);
        if (isSupportedAddress(address)) {
          return address;
        }
      }
    }
    return undefined;
  }
}

export default (api: API): void => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, MifloraPlatform);
};
