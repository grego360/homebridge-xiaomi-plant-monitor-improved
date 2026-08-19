import type { API, Service } from "homebridge";
import type {
  MiFloraData,
  PlantAccessory,
  PlantAccessoryContext,
} from "./types.js";

function getOrAddService(
  plant: PlantAccessory,
  api: API,
  serviceType: typeof api.hap.Service.HumiditySensor,
  name: string,
  subtype: string,
): Service {
  return (
    plant.accessory.getService(serviceType) ??
    plant.accessory.addService(serviceType, name, subtype)
  );
}

function setServiceName(service: Service, api: API, name: string): void {
  service.setCharacteristic(api.hap.Characteristic.Name, name);
}

function setLowBattery(
  service: Service,
  api: API,
  battery: number,
  threshold: number,
): void {
  service.updateCharacteristic(
    api.hap.Characteristic.StatusLowBattery,
    battery < threshold
      ? api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
      : api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL,
  );
}

export function configureAccessoryServices(
  plant: PlantAccessory,
  api: API,
  pluginVersion: string,
): void {
  const { accessory, config } = plant;
  accessory.updateDisplayName(config.name);

  const information =
    accessory.getService(api.hap.Service.AccessoryInformation) ??
    accessory.addService(api.hap.Service.AccessoryInformation);
  information
    .setCharacteristic(api.hap.Characteristic.Manufacturer, "Xiaomi")
    .setCharacteristic(api.hap.Characteristic.Model, "Mi Flora Plant Sensor")
    .setCharacteristic(api.hap.Characteristic.SerialNumber, config.address)
    .setCharacteristic(api.hap.Characteristic.Name, config.name)
    .setCharacteristic(api.hap.Characteristic.FirmwareRevision, pluginVersion);

  const moisture = getOrAddService(
    plant,
    api,
    api.hap.Service.HumiditySensor,
    `${config.name} Moisture`,
    `moisture-${config.address}`,
  );
  setServiceName(moisture, api, `${config.name} Moisture`);

  const battery = getOrAddService(
    plant,
    api,
    api.hap.Service.Battery,
    `${config.name} Battery`,
    `battery-${config.address}`,
  );
  setServiceName(battery, api, `${config.name} Battery`);

  configureOptionalService(
    plant,
    api,
    api.hap.Service.TemperatureSensor,
    config.displayTemperature,
    `${config.name} Temperature`,
    `temperature-${config.address}`,
  );
  configureOptionalService(
    plant,
    api,
    api.hap.Service.LightSensor,
    config.displayLightLevel,
    `${config.name} Light`,
    `light-${config.address}`,
  );
}

function configureOptionalService(
  plant: PlantAccessory,
  api: API,
  serviceType:
    | typeof api.hap.Service.TemperatureSensor
    | typeof api.hap.Service.LightSensor,
  enabled: boolean,
  name: string,
  subtype: string,
): void {
  const existing = plant.accessory.getService(serviceType);
  if (!enabled) {
    if (existing) {
      plant.accessory.removeService(existing);
    }
    return;
  }

  const service = existing ?? plant.accessory.addService(serviceType, name, subtype);
  setServiceName(service, api, name);
}

export function updateAccessoryServices(
  plant: PlantAccessory,
  data: MiFloraData,
  api: API,
): void {
  const { battery, firmware } = data.firmwareInfo;
  const { temperature, lux, moisture } = data.sensorValues;
  const threshold = plant.config.lowBatteryThreshold;

  const information = plant.accessory.getService(
    api.hap.Service.AccessoryInformation,
  );
  information?.updateCharacteristic(
    api.hap.Characteristic.FirmwareRevision,
    firmware,
  );

  const humidityService = plant.accessory.getService(
    api.hap.Service.HumiditySensor,
  );
  if (humidityService) {
    humidityService.updateCharacteristic(
      api.hap.Characteristic.CurrentRelativeHumidity,
      Math.min(100, Math.max(0, moisture)),
    );
    setLowBattery(humidityService, api, battery, threshold);
  }

  const batteryService = plant.accessory.getService(api.hap.Service.Battery);
  if (batteryService) {
    batteryService
      .updateCharacteristic(
        api.hap.Characteristic.ChargingState,
        api.hap.Characteristic.ChargingState.NOT_CHARGEABLE,
      )
      .updateCharacteristic(
        api.hap.Characteristic.BatteryLevel,
        Math.min(100, Math.max(0, battery)),
      );
    setLowBattery(batteryService, api, battery, threshold);
  }

  if (plant.config.displayTemperature) {
    const service = plant.accessory.getService(api.hap.Service.TemperatureSensor);
    service?.updateCharacteristic(
      api.hap.Characteristic.CurrentTemperature,
      Math.min(100, Math.max(-270, temperature)),
    );
  }

  if (plant.config.displayLightLevel) {
    const service = plant.accessory.getService(api.hap.Service.LightSensor);
    service?.updateCharacteristic(
      api.hap.Characteristic.CurrentAmbientLightLevel,
      Math.min(100_000, Math.max(0.0001, lux)),
    );
  }

  setAccessoryFault(plant, api, false);
}

export function setAccessoryFault(
  plant: PlantAccessory,
  api: API,
  faulted: boolean,
): void {
  const value = faulted
    ? api.hap.Characteristic.StatusFault.GENERAL_FAULT
    : api.hap.Characteristic.StatusFault.NO_FAULT;

  for (const serviceType of [
    api.hap.Service.HumiditySensor,
    api.hap.Service.TemperatureSensor,
    api.hap.Service.LightSensor,
  ]) {
    const service = plant.accessory.getService(serviceType);
    service?.updateCharacteristic(api.hap.Characteristic.StatusFault, value);
  }
}

export function accessoryContext(plant: PlantAccessory): PlantAccessoryContext {
  return plant.accessory.context as PlantAccessoryContext;
}
