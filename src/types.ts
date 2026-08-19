import type { PlatformAccessory, PlatformConfig } from "homebridge";

export interface MiFloraDevice {
  address: string;
  query: () => Promise<MiFloraData>;
  queryFirmwareInfo?: (plain: true) => Promise<MiFloraData["firmwareInfo"]>;
  querySensorValues?: (plain: true) => Promise<MiFloraData["sensorValues"]>;
  disconnect?: () => Promise<void> | void;
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
  config: NormalizedDeviceConfig;
  consecutiveFailures: number;
}

export interface DeviceConfig {
  address: string;
  name?: string;
  displayTemperature?: boolean;
  displayLightLevel?: boolean;
  displayFertility?: boolean;
  lowBatteryThreshold?: number;
}

export interface MiFloraConfig extends PlatformConfig {
  fetchDataIntervalInMs?: number;
  displayTemperature?: boolean;
  displayLightLevel?: boolean;
  displayFertility?: boolean;
  lowBatteryThreshold?: number;
  devices?: DeviceConfig[];
  returnDefaultDataOnError?: boolean;
}

export interface NormalizedDeviceConfig {
  address: string;
  name: string;
  displayTemperature: boolean;
  displayLightLevel: boolean;
  displayFertility: boolean;
  lowBatteryThreshold: number;
}

export interface NormalizedMiFloraConfig {
  name: string;
  fetchDataIntervalInMs: number;
  displayTemperature: boolean;
  displayLightLevel: boolean;
  displayFertility: boolean;
  lowBatteryThreshold: number;
  devices: NormalizedDeviceConfig[];
  hasExplicitDevices: boolean;
}

export interface PlantAccessoryContext {
  deviceAddress?: string;
  lastSuccessfulRead?: number;
  consecutiveFailures?: number;
  lastData?: MiFloraData;
}
