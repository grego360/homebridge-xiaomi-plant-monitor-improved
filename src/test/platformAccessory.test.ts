import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { API, PlatformAccessory } from "homebridge";
import {
  configureAccessoryServices,
  setAccessoryFault,
  updateAccessoryServices,
} from "../platformAccessory.js";
import type { PlantAccessory } from "../types.js";

class FakeService {
  readonly values = new Map<unknown, unknown>();

  setCharacteristic(characteristic: unknown, value: unknown): this {
    this.values.set(characteristic, value);
    return this;
  }

  updateCharacteristic(characteristic: unknown, value: unknown): this {
    this.values.set(characteristic, value);
    return this;
  }
}

function fixture(): {
  api: API;
  plant: PlantAccessory;
  services: Map<unknown, FakeService>;
  characteristic: Record<string, unknown>;
  serviceType: Record<string, unknown>;
} {
  const services = new Map<unknown, FakeService>();
  const serviceType = {
    AccessoryInformation: Symbol("AccessoryInformation"),
    HumiditySensor: Symbol("HumiditySensor"),
    Battery: Symbol("Battery"),
    TemperatureSensor: Symbol("TemperatureSensor"),
    LightSensor: Symbol("LightSensor"),
  };
  const characteristic = {
    Manufacturer: Symbol("Manufacturer"),
    Model: Symbol("Model"),
    SerialNumber: Symbol("SerialNumber"),
    Name: Symbol("Name"),
    FirmwareRevision: Symbol("FirmwareRevision"),
    CurrentRelativeHumidity: Symbol("CurrentRelativeHumidity"),
    StatusLowBattery: Object.assign(Symbol("StatusLowBattery"), {
      BATTERY_LEVEL_LOW: 1,
      BATTERY_LEVEL_NORMAL: 0,
    }),
    ChargingState: Object.assign(Symbol("ChargingState"), {
      NOT_CHARGEABLE: 2,
    }),
    BatteryLevel: Symbol("BatteryLevel"),
    CurrentTemperature: Symbol("CurrentTemperature"),
    CurrentAmbientLightLevel: Symbol("CurrentAmbientLightLevel"),
    StatusFault: Object.assign(Symbol("StatusFault"), {
      GENERAL_FAULT: 1,
      NO_FAULT: 0,
    }),
  };
  const accessory = {
    displayName: "old name",
    context: {},
    updateDisplayName(name: string) {
      this.displayName = name;
    },
    getService(type: unknown) {
      return services.get(type);
    },
    addService(type: unknown) {
      const service = new FakeService();
      services.set(type, service);
      return service;
    },
    removeService(service: FakeService) {
      for (const [type, candidate] of services) {
        if (candidate === service) {
          services.delete(type);
        }
      }
    },
  } as unknown as PlatformAccessory;
  const api = {
    hap: { Service: serviceType, Characteristic: characteristic },
  } as unknown as API;
  const plant: PlantAccessory = {
    accessory,
    config: {
      address: "c4:7c:8d:6c:09:00",
      name: "Monstera",
      displayTemperature: true,
      displayLightLevel: false,
      displayFertility: true,
      lowBatteryThreshold: 15,
    },
    consecutiveFailures: 0,
  };

  return { api, plant, services, characteristic, serviceType };
}

describe("HomeKit accessory services", () => {
  it("uses the configured name and removes disabled optional services", () => {
    const { api, plant, services, serviceType } = fixture();
    services.set(serviceType.LightSensor, new FakeService());

    configureAccessoryServices(plant, api, "4.0.0");

    assert.equal(plant.accessory.displayName, "Monstera");
    assert.equal(services.has(serviceType.HumiditySensor), true);
    assert.equal(services.has(serviceType.Battery), true);
    assert.equal(services.has(serviceType.TemperatureSensor), true);
    assert.equal(services.has(serviceType.LightSensor), false);
  });

  it("publishes bounded real readings and low-battery state", () => {
    const { api, plant, services, characteristic, serviceType } = fixture();
    configureAccessoryServices(plant, api, "4.0.0");

    updateAccessoryServices(
      plant,
      {
        firmwareInfo: { battery: 8, firmware: "3.3.5" },
        sensorValues: {
          temperature: 22,
          lux: 0,
          moisture: 120,
          fertility: 900,
        },
      },
      api,
    );

    const moisture = services.get(serviceType.HumiditySensor);
    const battery = services.get(serviceType.Battery);
    assert.equal(moisture?.values.get(characteristic.CurrentRelativeHumidity), 100);
    assert.equal(moisture?.values.get(characteristic.StatusLowBattery), 1);
    assert.equal(battery?.values.get(characteristic.BatteryLevel), 8);
  });

  it("marks sensor services faulted without overwriting their readings", () => {
    const { api, plant, services, characteristic, serviceType } = fixture();
    configureAccessoryServices(plant, api, "4.0.0");
    const moisture = services.get(serviceType.HumiditySensor);
    moisture?.values.set(characteristic.CurrentRelativeHumidity, 44);

    setAccessoryFault(plant, api, true);

    assert.equal(moisture?.values.get(characteristic.CurrentRelativeHumidity), 44);
    assert.equal(moisture?.values.get(characteristic.StatusFault), 1);
  });
});
