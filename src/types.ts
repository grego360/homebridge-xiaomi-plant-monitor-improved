import type { PlatformAccessory } from 'homebridge';

export interface MiFloraDevice {
  address: string;
  query: () => Promise<MiFloraData>;
}

export interface MiFloraData {
  firmwareInfo: {
    battery: number;
    firmware: string;
  };
  sensorValues: {
    temperature: number;
    lux: number;
    moisture: number;
    fertility: number;
  };
}

export interface PlantAccessory {
  device?: MiFloraDevice;
  accessory: PlatformAccessory;
}

export interface DeviceConfig {
  address: string;
  name?: string;
  displayTemperature?: boolean;
  displayLightLevel?: boolean;
  displayFertility?: boolean;
  lowBatteryThreshold?: number;
  moistureThreshold?: {
    low?: number;
    high?: number;
  };
  temperatureThreshold?: {
    low?: number;
    high?: number;
  };
}

export interface MiFloraConfig {
  platform: string;
  fetchDataIntervalInMs?: number;
  displayTemperature?: boolean;
  displayLightLevel?: boolean;
  displayFertility?: boolean;
  lowBatteryThreshold?: number;
  devices?: DeviceConfig[];
}
