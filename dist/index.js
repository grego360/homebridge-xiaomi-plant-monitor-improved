import { deviceConfigForAddress, isSupportedAddress, normalizeAddress, normalizeConfig, } from "./config.js";
import { disconnectPlantDevices, fetchPlantsData } from "./dataFetcher.js";
import { discoverDevices } from "./deviceDiscovery.js";
import { configureAccessoryServices } from "./platformAccessory.js";
import { PLATFORM_NAME, PLUGIN_NAME, PLUGIN_VERSION } from "./settings.js";
import { handleError } from "./utils.js";
export class MifloraPlatform {
    log;
    api;
    plants = [];
    config;
    pollTimer;
    running = false;
    shuttingDown = false;
    constructor(log, rawConfig, api) {
        this.log = log;
        this.api = api;
        this.config = normalizeConfig(rawConfig, log);
        this.api.on("didFinishLaunching", () => {
            void this.start().catch((error) => {
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
    async start() {
        this.log.info(`Starting Xiaomi Plant Monitor ${PLUGIN_VERSION}; polling every ${this.config.fetchDataIntervalInMs} ms`);
        this.reconcileConfiguredAccessories();
        await this.run();
        this.scheduleNextRun();
    }
    scheduleNextRun() {
        if (this.shuttingDown) {
            return;
        }
        this.pollTimer = setTimeout(() => {
            void this.run().finally(() => this.scheduleNextRun());
        }, this.config.fetchDataIntervalInMs);
    }
    async run() {
        if (this.running) {
            this.log.warn("Skipping a polling cycle because the previous cycle is still running");
            return;
        }
        this.running = true;
        try {
            await this.searchAndAddNewPlants();
            await fetchPlantsData(this.plants, this.log, this.api);
        }
        catch (error) {
            handleError(this.log, "Unexpected polling-cycle failure", error);
        }
        finally {
            this.running = false;
        }
    }
    async searchAndAddNewPlants() {
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
        }
        catch (error) {
            handleError(this.log, "Bluetooth discovery failed; cached accessories will be retained", error, "warn");
        }
    }
    reconcileConfiguredAccessories() {
        for (const device of this.config.devices) {
            this.upsertPlant(device.address);
        }
        if (!this.config.hasExplicitDevices || this.config.devices.length === 0) {
            return;
        }
        const configuredAddresses = new Set(this.config.devices.map((device) => device.address));
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
    upsertPlant(address, device) {
        const normalizedAddress = normalizeAddress(address);
        const config = deviceConfigForAddress(this.config, normalizedAddress);
        let plant = this.plants.find((candidate) => candidate.config.address === normalizedAddress);
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
        const context = accessory.context;
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
    configureAccessory(accessory) {
        const context = accessory.context;
        const address = this.addressFromCachedAccessory(accessory, context);
        if (!address) {
            this.log.error(`Cannot restore cached accessory ${accessory.displayName}: no valid Bluetooth address was found`);
            return;
        }
        context.deviceAddress = address;
        const plant = {
            accessory,
            config: deviceConfigForAddress(this.config, address),
            consecutiveFailures: context.consecutiveFailures ?? 0,
        };
        configureAccessoryServices(plant, this.api, PLUGIN_VERSION);
        this.plants.push(plant);
        this.api.updatePlatformAccessories([accessory]);
        this.log.info(`Restored cached accessory ${plant.config.name} (${address})`);
    }
    addressFromCachedAccessory(accessory, context) {
        const candidates = [context.deviceAddress, accessory.displayName];
        const information = accessory.getService(this.api.hap.Service.AccessoryInformation);
        if (information) {
            candidates.push(information.getCharacteristic(this.api.hap.Characteristic.SerialNumber).value);
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
export default (api) => {
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, MifloraPlatform);
};
//# sourceMappingURL=index.js.map