import { normalizeAddress } from "./config.js";
import { CONNECTION_TIMEOUT_MS } from "./settings.js";
import type { MiFloraData, MiFloraDevice } from "./types.js";
import { TimeoutError } from "./utils.js";

const XIAOMI_ADVERTISEMENT_UUID = "fe95";
const DATA_SERVICE_UUID = "0000120400001000800000805f9b34fb";
const MODE_CHARACTERISTIC_UUID = "00001a0000001000800000805f9b34fb";
const DATA_CHARACTERISTIC_UUID = "00001a0100001000800000805f9b34fb";
const FIRMWARE_CHARACTERISTIC_UUID = "00001a0200001000800000805f9b34fb";
const REALTIME_MODE = Buffer.from("a01f", "hex");

interface NobleCharacteristic {
  uuid: string;
  read(callback: (error: Error | null, data: Buffer) => void): void;
  write(data: Buffer, withoutResponse: boolean, callback: (error?: Error | null) => void): void;
}

interface NobleAdvertisement {
  localName?: string;
  serviceData?: Array<{ uuid: string; data: Buffer }>;
}

interface NoblePeripheral {
  address: string;
  state: string;
  advertisement: NobleAdvertisement;
  connect(callback: (error?: Error | null) => void): void;
  disconnect(callback?: () => void): void;
  discoverSomeServicesAndCharacteristics(
    serviceUuids: string[],
    characteristicUuids: string[],
    callback: (
      error: Error | null,
      services: unknown[],
      characteristics: NobleCharacteristic[],
    ) => void,
  ): void;
}

interface NobleModule {
  state: string;
  on(event: "stateChange", listener: (state: string) => void): void;
  on(event: "discover", listener: (peripheral: NoblePeripheral) => void): void;
  removeListener(event: "stateChange", listener: (state: string) => void): void;
  removeListener(event: "discover", listener: (peripheral: NoblePeripheral) => void): void;
  startScanning(
    serviceUuids: string[],
    allowDuplicates: boolean,
    callback: (error?: Error | null) => void,
  ): void;
  stopScanning(callback?: () => void): void;
}

interface DiscoveryOptions {
  duration?: number;
  ignoreUnknown?: boolean;
  addresses?: string[];
}

function callbackOperation<T>(
  start: (callback: (error: Error | null, value: T) => void) => void,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new TimeoutError(message));
      }
    }, timeoutMs);

    const complete = (error: Error | null, value: T): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };

    try {
      start(complete);
    } catch (error) {
      complete(error instanceof Error ? error : new Error(String(error)), undefined as T);
    }
  });
}

function serviceData(peripheral: NoblePeripheral): Buffer | undefined {
  return peripheral.advertisement.serviceData?.find(
    (entry) => entry.uuid.toLowerCase() === XIAOMI_ADVERTISEMENT_UUID,
  )?.data;
}

function peripheralAddress(peripheral: NoblePeripheral): string | undefined {
  if (peripheral.address) {
    return normalizeAddress(peripheral.address);
  }

  const data = serviceData(peripheral);
  if (!data || data.length <= 10) {
    return undefined;
  }

  return [...data.subarray(5, 11)]
    .reverse()
    .map((value) => value.toString(16).padStart(2, "0"))
    .join(":");
}

function isSupportedMiFlora(peripheral: NoblePeripheral): boolean {
  const data = serviceData(peripheral);
  if (!data || data.length < 4) {
    return false;
  }
  const productId = data.readUInt16LE(2);
  return productId === 0x0098 || productId === 0x015d;
}

class NativeMiFloraDevice implements MiFloraDevice {
  private firmwareCharacteristic?: NobleCharacteristic;
  private modeCharacteristic?: NobleCharacteristic;
  private dataCharacteristic?: NobleCharacteristic;

  constructor(
    readonly address: string,
    private readonly peripheral: NoblePeripheral,
  ) {}

  private async connect(): Promise<void> {
    if (this.peripheral.state !== "connected") {
      await callbackOperation<void>(
        (callback) => this.peripheral.connect((error) => callback(error ?? null, undefined)),
        CONNECTION_TIMEOUT_MS,
        `Connection timed out after ${CONNECTION_TIMEOUT_MS} ms`,
      );
    }

    if (
      this.firmwareCharacteristic &&
      this.modeCharacteristic &&
      this.dataCharacteristic
    ) {
      return;
    }

    const characteristics = await callbackOperation<NobleCharacteristic[]>(
      (callback) => {
        this.peripheral.discoverSomeServicesAndCharacteristics(
          [DATA_SERVICE_UUID],
          [
            MODE_CHARACTERISTIC_UUID,
            DATA_CHARACTERISTIC_UUID,
            FIRMWARE_CHARACTERISTIC_UUID,
          ],
          (error, _services, discovered) => callback(error, discovered),
        );
      },
      30_000,
      "GATT characteristic discovery timed out after 30000 ms",
    );

    this.modeCharacteristic = characteristics.find(
      (item) => item.uuid.toLowerCase() === MODE_CHARACTERISTIC_UUID,
    );
    this.dataCharacteristic = characteristics.find(
      (item) => item.uuid.toLowerCase() === DATA_CHARACTERISTIC_UUID,
    );
    this.firmwareCharacteristic = characteristics.find(
      (item) => item.uuid.toLowerCase() === FIRMWARE_CHARACTERISTIC_UUID,
    );

    if (!this.modeCharacteristic || !this.dataCharacteristic || !this.firmwareCharacteristic) {
      throw new Error("The Mi Flora GATT characteristics were not found");
    }
  }

  private read(characteristic: NobleCharacteristic): Promise<Buffer> {
    return callbackOperation<Buffer>(
      (callback) => characteristic.read(callback),
      15_000,
      `Reading characteristic ${characteristic.uuid} timed out after 15000 ms`,
    );
  }

  private write(characteristic: NobleCharacteristic, data: Buffer): Promise<void> {
    return callbackOperation<void>(
      (callback) => {
        characteristic.write(data, false, (error) => callback(error ?? null, undefined));
      },
      15_000,
      `Writing characteristic ${characteristic.uuid} timed out after 15000 ms`,
    );
  }

  async queryFirmwareInfo(_plain: true): Promise<MiFloraData["firmwareInfo"]> {
    void _plain;
    await this.connect();
    const data = await this.read(this.firmwareCharacteristic!);
    if (data.length < 3) {
      throw new Error("The sensor returned invalid firmware data");
    }
    return {
      battery: data.readUInt8(0),
      firmware: data.toString("ascii", 2),
    };
  }

  async querySensorValues(_plain: true): Promise<MiFloraData["sensorValues"]> {
    void _plain;
    await this.connect();
    await this.write(this.modeCharacteristic!, REALTIME_MODE);
    const mode = await this.read(this.modeCharacteristic!);
    if (!mode.equals(REALTIME_MODE)) {
      throw new Error("The sensor did not enter realtime data mode");
    }

    const data = await this.read(this.dataCharacteristic!);
    if (data.length < 10) {
      throw new Error("The sensor returned invalid measurement data");
    }
    return {
      temperature: data.readInt16LE(0) / 10,
      lux: data.readUInt32LE(3),
      moisture: data.readUInt8(7),
      fertility: data.readUInt16LE(8),
    };
  }

  async query(): Promise<MiFloraData> {
    const firmwareInfo = await this.queryFirmwareInfo(true);
    const sensorValues = await this.querySensorValues(true);
    return { firmwareInfo, sensorValues };
  }

  async disconnect(): Promise<void> {
    if (this.peripheral.state === "disconnected") {
      return;
    }
    await callbackOperation<void>(
      (callback) => this.peripheral.disconnect(() => callback(null, undefined)),
      10_000,
      "Disconnect timed out after 10000 ms",
    );
  }
}

let noblePromise: Promise<NobleModule> | undefined;

async function loadNoble(): Promise<NobleModule> {
  noblePromise ??= import("@abandonware/noble").then((module) => {
    const imported = module as unknown as {
      default?: NobleModule;
    };
    return imported.default ?? (module as unknown as NobleModule);
  });
  return noblePromise;
}

async function waitForPoweredOn(noble: NobleModule): Promise<void> {
  if (noble.state === "poweredOn") {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const stateChanged = (state: string): void => {
      if (state === "poweredOn") {
        clearTimeout(timeout);
        noble.removeListener("stateChange", stateChanged);
        resolve();
      }
    };
    const timeout = setTimeout(() => {
      noble.removeListener("stateChange", stateChanged);
      reject(new TimeoutError("Bluetooth adapter did not become powered on within 30000 ms"));
    }, 30_000);
    noble.on("stateChange", stateChanged);
  });
}

export async function discoverWithNoble(
  noble: NobleModule,
  options: DiscoveryOptions = {},
): Promise<MiFloraDevice[]> {
  await waitForPoweredOn(noble);

  const duration = options.duration ?? 10_000;
  const addresses = new Set((options.addresses ?? []).map(normalizeAddress));
  const devices = new Map<string, MiFloraDevice>();

  return new Promise<MiFloraDevice[]>((resolve, reject) => {
    let finished = false;
    let timer: ReturnType<typeof setTimeout>;

    const finish = (error?: Error): void => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      noble.removeListener("discover", discovered);
      noble.stopScanning(() => {
        if (error) {
          reject(error);
        } else {
          resolve([...devices.values()]);
        }
      });
    };

    const discovered = (peripheral: NoblePeripheral): void => {
      if (!isSupportedMiFlora(peripheral)) {
        return;
      }
      const address = peripheralAddress(peripheral);
      if (!address || (options.ignoreUnknown && !addresses.has(address))) {
        return;
      }
      devices.set(address, new NativeMiFloraDevice(address, peripheral));
      if (addresses.size > 0 && [...addresses].every((item) => devices.has(item))) {
        finish();
      }
    };

    noble.on("discover", discovered);
    timer = setTimeout(() => finish(), duration);
    noble.startScanning([XIAOMI_ADVERTISEMENT_UUID], true, (error) => {
      if (error) {
        finish(error);
      }
    });
  });
}

export async function discover(options: DiscoveryOptions = {}): Promise<MiFloraDevice[]> {
  return discoverWithNoble(await loadNoble(), options);
}
