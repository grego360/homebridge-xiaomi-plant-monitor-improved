import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import { discoverWithNoble } from "../miFloraClient.js";

const address = "c4:7c:8d:6c:09:00";
const modeUuid = "00001a0000001000800000805f9b34fb";
const dataUuid = "00001a0100001000800000805f9b34fb";
const firmwareUuid = "00001a0200001000800000805f9b34fb";

describe("native Mi Flora client", () => {
  it("discovers and reads the known Mi Flora GATT characteristics", async () => {
    let mode = Buffer.from("0000", "hex");
    let measurementData = Buffer.from("3e01a047000000000000023c00fb349b", "hex");
    let disconnected = false;
    const characteristics = [
      {
        uuid: modeUuid,
        read: (callback: (error: Error | null, data: Buffer) => void) => {
          callback(null, mode);
        },
        write: (
          data: Buffer,
          _withoutResponse: boolean,
          callback: (error?: Error | null) => void,
        ) => {
          mode = data;
          callback(null);
        },
      },
      {
        uuid: dataUuid,
        read: (callback: (error: Error | null, data: Buffer) => void) => {
          callback(null, measurementData);
        },
        write: () => undefined,
      },
      {
        uuid: firmwareUuid,
        read: (callback: (error: Error | null, data: Buffer) => void) => {
          callback(null, Buffer.from("642b332e332e35", "hex"));
        },
        write: () => undefined,
      },
    ];
    const peripheral = {
      address,
      state: "disconnected",
      advertisement: {
        serviceData: [
          {
            uuid: "fe95",
            data: Buffer.from("71209800d100096c8d7cc40d071003700000", "hex"),
          },
        ],
      },
      connect(callback: (error?: Error | null) => void) {
        this.state = "connected";
        callback(null);
      },
      disconnect(callback?: () => void) {
        this.state = "disconnected";
        disconnected = true;
        callback?.();
      },
      discoverSomeServicesAndCharacteristics(
        _serviceUuids: string[],
        _characteristicUuids: string[],
        callback: (error: Error | null, services: unknown[], found: typeof characteristics) => void,
      ) {
        callback(null, [{}], characteristics);
      },
    };
    class MockNoble extends EventEmitter {
      state = "poweredOn";

      startScanning(
        _serviceUuids: string[],
        _allowDuplicates: boolean,
        callback: (error?: Error | null) => void,
      ): void {
        callback(null);
        queueMicrotask(() => this.emit("discover", peripheral));
      }

      stopScanning(callback?: () => void): void {
        callback?.();
      }
    }

    const noble = new MockNoble() as unknown as Parameters<typeof discoverWithNoble>[0];
    const devices = await discoverWithNoble(noble, {
      addresses: [address],
      ignoreUnknown: true,
      duration: 100,
    });

    assert.equal(devices.length, 1);
    assert.deepEqual(await devices[0].query(), {
      firmwareInfo: { battery: 100, firmware: "3.3.5" },
      sensorValues: {
        temperature: 31.8,
        lux: 71,
        moisture: 0,
        fertility: 0,
      },
    });
    measurementData = Buffer.from("ccffa047000000000000023c00fb349b", "hex");
    assert.equal((await devices[0].querySensorValues?.(true))?.temperature, -5.2);
    await devices[0].disconnect?.();
    assert.equal(disconnected, true);
  });
});
