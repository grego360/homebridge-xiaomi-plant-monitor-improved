import { handleError } from "./utils.js";
/**
 * Fetch data for all plants in parallel
 */
export async function fetchPlantsData(plants, log, api) {
    const promises = plants.map((plant) => updatePlantData(plant, log, api));
    await Promise.allSettled(promises);
}
/**
 * Update data for a specific plant with retry logic
 */
async function updatePlantData(plant, log, api) {
    try {
        if (plant.device === undefined) {
            log.info("Cached plant not found, removing from accessories");
            api.unregisterPlatformAccessories("homebridge-xiaomi-plant-monitor", "xiaomi-plant-monitor", [plant.accessory]);
            return;
        }
        // Query the device for updated data
        const queryResult = await queryPlantData(plant, log);
        // Update accessory services with new data
        updateAccessoryServices(plant, queryResult, api, log);
    }
    catch (error) {
        handleError(log, `Error updating plant data for ${plant.accessory.displayName}`, error);
    }
}
/**
 * Query plant data with retry logic
 */
async function queryPlantData(plant, log) {
    if (!plant.device) {
        throw new Error("Device is undefined");
    }
    let retries = 3;
    let lastError = null;
    let queryResult = null;
    while (retries > 0 && queryResult === null) {
        try {
            log.debug(`Attempting to query plant ${plant.accessory.displayName}, attempts remaining: ${retries}`);
            queryResult = await plant.device.query();
            break; // Success, exit the retry loop
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            handleError(log, `Query attempt failed for ${plant.accessory.displayName}`, lastError, "warn");
            retries--;
            if (retries > 0) {
                // Wait before retrying (exponential backoff)
                await new Promise((resolve) => setTimeout(resolve, (4 - retries) * 2000));
            }
        }
    }
    if (queryResult === null) {
        throw (lastError || new Error("Failed to query device after multiple attempts"));
    }
    return queryResult;
}
/**
 * Update accessory services with new plant data
 */
function updateAccessoryServices(plant, queryResult, api, log) {
    const { firmwareInfo, sensorValues } = queryResult;
    const { battery, firmware } = firmwareInfo;
    const { temperature, lux, moisture, fertility } = sensorValues;
    log.info(`Plant: ${plant.accessory.displayName} | Battery: ${battery}% | Firmware: ${firmware} | Temperature: ${temperature}°C | Light: ${lux} lux | Moisture: ${moisture}% | Fertility: ${fertility} µS/cm`);
    // Update humidity service (moisture)
    const humidityService = plant.accessory.getService(api.hap.Service.HumiditySensor);
    if (humidityService) {
        humidityService.updateCharacteristic(api.hap.Characteristic.CurrentRelativeHumidity, moisture);
        humidityService.updateCharacteristic(api.hap.Characteristic.StatusLowBattery, battery < plant.lowBatteryThreshold
            ? api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
            : api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    }
    // Update battery service
    const batteryService = plant.accessory.getService(api.hap.Service.BatteryService);
    if (batteryService) {
        batteryService.updateCharacteristic(api.hap.Characteristic.ChargingState, api.hap.Characteristic.ChargingState.NOT_CHARGEABLE);
        batteryService.updateCharacteristic(api.hap.Characteristic.BatteryLevel, battery);
        batteryService.updateCharacteristic(api.hap.Characteristic.StatusLowBattery, battery < plant.lowBatteryThreshold
            ? api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
            : api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    }
    // Update temperature service if enabled
    if (plant.displayTemperature) {
        const temperatureService = plant.accessory.getService(api.hap.Service.TemperatureSensor);
        if (temperatureService) {
            temperatureService.updateCharacteristic(api.hap.Characteristic.CurrentTemperature, temperature);
            temperatureService.updateCharacteristic(api.hap.Characteristic.StatusLowBattery, battery < plant.lowBatteryThreshold
                ? api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
                : api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
        }
    }
    // Update light level service if enabled
    if (plant.displayLightLevel) {
        const lightService = plant.accessory.getService(api.hap.Service.LightSensor);
        if (lightService) {
            lightService.updateCharacteristic(api.hap.Characteristic.CurrentAmbientLightLevel, lux);
            lightService.updateCharacteristic(api.hap.Characteristic.StatusLowBattery, battery < plant.lowBatteryThreshold
                ? api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
                : api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
        }
    }
    // Update fertility data (we don't have a direct HomeKit service for this)
    // So we log it for now, but in the future could add a custom characteristic
    if (plant.displayFertility) {
        log.debug(`Plant: ${plant.accessory.displayName} | Fertility: ${fertility} µS/cm`);
        // Future enhancement: could add a custom characteristic for fertility
    }
}
//# sourceMappingURL=dataFetcher.js.map