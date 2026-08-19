import { normalizeAddress } from "./config.js";
import { CONNECTION_TIMEOUT_MS } from "./settings.js";
import { TimeoutError } from "./utils.js";
const XIAOMI_ADVERTISEMENT_UUID = "fe95";
const DATA_SERVICE_UUID = "0000120400001000800000805f9b34fb";
const MODE_CHARACTERISTIC_UUID = "00001a0000001000800000805f9b34fb";
const DATA_CHARACTERISTIC_UUID = "00001a0100001000800000805f9b34fb";
const FIRMWARE_CHARACTERISTIC_UUID = "00001a0200001000800000805f9b34fb";
const REALTIME_MODE = Buffer.from("a01f", "hex");
function callbackOperation(start, timeoutMs, message) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new TimeoutError(message));
            }
        }, timeoutMs);
        const complete = (error, value) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            if (error) {
                reject(error);
            }
            else {
                resolve(value);
            }
        };
        try {
            start(complete);
        }
        catch (error) {
            complete(error instanceof Error ? error : new Error(String(error)), undefined);
        }
    });
}
function serviceData(peripheral) {
    return peripheral.advertisement.serviceData?.find((entry) => entry.uuid.toLowerCase() === XIAOMI_ADVERTISEMENT_UUID)?.data;
}
function peripheralAddress(peripheral) {
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
function isSupportedMiFlora(peripheral) {
    const data = serviceData(peripheral);
    if (!data || data.length < 4) {
        return false;
    }
    const productId = data.readUInt16LE(2);
    return productId === 0x0098 || productId === 0x015d;
}
class NativeMiFloraDevice {
    address;
    peripheral;
    firmwareCharacteristic;
    modeCharacteristic;
    dataCharacteristic;
    constructor(address, peripheral) {
        this.address = address;
        this.peripheral = peripheral;
    }
    async connect() {
        if (this.peripheral.state !== "connected") {
            await callbackOperation((callback) => this.peripheral.connect((error) => callback(error ?? null, undefined)), CONNECTION_TIMEOUT_MS, `Connection timed out after ${CONNECTION_TIMEOUT_MS} ms`);
        }
        if (this.firmwareCharacteristic &&
            this.modeCharacteristic &&
            this.dataCharacteristic) {
            return;
        }
        const characteristics = await callbackOperation((callback) => {
            this.peripheral.discoverSomeServicesAndCharacteristics([DATA_SERVICE_UUID], [
                MODE_CHARACTERISTIC_UUID,
                DATA_CHARACTERISTIC_UUID,
                FIRMWARE_CHARACTERISTIC_UUID,
            ], (error, _services, discovered) => callback(error, discovered));
        }, 30_000, "GATT characteristic discovery timed out after 30000 ms");
        this.modeCharacteristic = characteristics.find((item) => item.uuid.toLowerCase() === MODE_CHARACTERISTIC_UUID);
        this.dataCharacteristic = characteristics.find((item) => item.uuid.toLowerCase() === DATA_CHARACTERISTIC_UUID);
        this.firmwareCharacteristic = characteristics.find((item) => item.uuid.toLowerCase() === FIRMWARE_CHARACTERISTIC_UUID);
        if (!this.modeCharacteristic || !this.dataCharacteristic || !this.firmwareCharacteristic) {
            throw new Error("The Mi Flora GATT characteristics were not found");
        }
    }
    read(characteristic) {
        return callbackOperation((callback) => characteristic.read(callback), 15_000, `Reading characteristic ${characteristic.uuid} timed out after 15000 ms`);
    }
    write(characteristic, data) {
        return callbackOperation((callback) => {
            characteristic.write(data, false, (error) => callback(error ?? null, undefined));
        }, 15_000, `Writing characteristic ${characteristic.uuid} timed out after 15000 ms`);
    }
    async queryFirmwareInfo(_plain) {
        void _plain;
        await this.connect();
        const data = await this.read(this.firmwareCharacteristic);
        if (data.length < 3) {
            throw new Error("The sensor returned invalid firmware data");
        }
        return {
            battery: data.readUInt8(0),
            firmware: data.toString("ascii", 2),
        };
    }
    async querySensorValues(_plain) {
        void _plain;
        await this.connect();
        await this.write(this.modeCharacteristic, REALTIME_MODE);
        const mode = await this.read(this.modeCharacteristic);
        if (!mode.equals(REALTIME_MODE)) {
            throw new Error("The sensor did not enter realtime data mode");
        }
        const data = await this.read(this.dataCharacteristic);
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
    async query() {
        const firmwareInfo = await this.queryFirmwareInfo(true);
        const sensorValues = await this.querySensorValues(true);
        return { firmwareInfo, sensorValues };
    }
    async disconnect() {
        if (this.peripheral.state === "disconnected") {
            return;
        }
        await callbackOperation((callback) => this.peripheral.disconnect(() => callback(null, undefined)), 10_000, "Disconnect timed out after 10000 ms");
    }
}
let noblePromise;
async function loadNoble() {
    noblePromise ??= import("@abandonware/noble").then((module) => {
        const imported = module;
        return imported.default ?? module;
    });
    return noblePromise;
}
async function waitForPoweredOn(noble) {
    if (noble.state === "poweredOn") {
        return;
    }
    await new Promise((resolve, reject) => {
        const stateChanged = (state) => {
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
export async function discoverWithNoble(noble, options = {}) {
    await waitForPoweredOn(noble);
    const duration = options.duration ?? 10_000;
    const addresses = new Set((options.addresses ?? []).map(normalizeAddress));
    const devices = new Map();
    return new Promise((resolve, reject) => {
        let finished = false;
        let timer;
        const finish = (error) => {
            if (finished) {
                return;
            }
            finished = true;
            clearTimeout(timer);
            noble.removeListener("discover", discovered);
            noble.stopScanning(() => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve([...devices.values()]);
                }
            });
        };
        const discovered = (peripheral) => {
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
export async function discover(options = {}) {
    return discoverWithNoble(await loadNoble(), options);
}
//# sourceMappingURL=miFloraClient.js.map