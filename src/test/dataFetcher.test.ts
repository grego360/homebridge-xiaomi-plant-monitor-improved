import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Logger, PlatformAccessory } from "homebridge";
import { isMiFloraData, queryPlantData } from "../dataFetcher.js";
import type { MiFloraData, PlantAccessory } from "../types.js";

const validData: MiFloraData = {
  firmwareInfo: { battery: 82, firmware: "3.3.5" },
  sensorValues: {
    temperature: 21.4,
    lux: 750,
    moisture: 42,
    fertility: 880,
  },
};

function logger(): Logger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  } as unknown as Logger;
}

function plant(query: () => Promise<MiFloraData>): PlantAccessory {
  return {
    accessory: {} as PlatformAccessory,
    device: { address: "c4:7c:8d:6c:09:00", query },
    config: {
      address: "c4:7c:8d:6c:09:00",
      name: "Monstera",
      displayTemperature: true,
      displayLightLevel: true,
      displayFertility: true,
      lowBatteryThreshold: 10,
    },
    consecutiveFailures: 0,
  };
}

describe("sensor data fetching", () => {
  it("accepts a complete finite sensor payload", () => {
    assert.equal(isMiFloraData(validData), true);
    assert.equal(
      isMiFloraData({
        ...validData,
        sensorValues: { ...validData.sensorValues, moisture: Number.NaN },
      }),
      false,
    );
  });

  it("retries ordinary Bluetooth failures", async () => {
    let attempts = 0;
    const sensor = plant(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("temporary Bluetooth failure");
      }
      return validData;
    });

    const result = await queryPlantData(sensor, logger(), {
      retries: 3,
      timeoutMs: 100,
      retryDelayMs: 0,
    });

    assert.deepEqual(result, validData);
    assert.equal(attempts, 3);
  });

  it("uses separate firmware and sensor reads when the device supports them", async () => {
    let combinedQueries = 0;
    const sensor = plant(async () => {
      combinedQueries += 1;
      return validData;
    });
    let firmwareReads = 0;
    let sensorReads = 0;
    sensor.device!.queryFirmwareInfo = async () => {
      firmwareReads += 1;
      return validData.firmwareInfo;
    };
    sensor.device!.querySensorValues = async () => {
      sensorReads += 1;
      return validData.sensorValues;
    };

    const result = await queryPlantData(sensor, logger(), {
      retries: 1,
      timeoutMs: 100,
    });

    assert.deepEqual(result, validData);
    assert.equal(firmwareReads, 1);
    assert.equal(sensorReads, 1);
    assert.equal(combinedQueries, 0);
  });

  it("does not retry an operation that timed out and cannot be cancelled", async () => {
    let attempts = 0;
    const sensor = plant(() => {
      attempts += 1;
      return new Promise<MiFloraData>(() => undefined);
    });

    let failure: unknown;
    try {
      await queryPlantData(sensor, logger(), {
        retries: 3,
        timeoutMs: 5,
        retryDelayMs: 0,
      });
    } catch (error) {
      failure = error;
    }

    assert.ok(failure instanceof Error);
    assert.equal(failure.name, "TimeoutError");
    assert.equal(attempts, 1);
  });

  it("does not retry the legacy miflora timeout error", async () => {
    let attempts = 0;
    const sensor = plant(async () => {
      attempts += 1;
      throw new Error("timeout");
    });

    await assert.rejects(
      queryPlantData(sensor, logger(), {
        retries: 3,
        timeoutMs: 100,
        retryDelayMs: 0,
      }),
      /timeout/,
    );

    assert.equal(attempts, 1);
  });

  it("rejects invalid sensor payloads instead of publishing them", async () => {
    const sensor = plant(async () => ({
      ...validData,
      sensorValues: { ...validData.sensorValues, lux: Number.NaN },
    }));

    let failure: unknown;
    try {
      await queryPlantData(sensor, logger(), {
        retries: 1,
        timeoutMs: 100,
        retryDelayMs: 0,
      });
    } catch (error) {
      failure = error;
    }

    assert.ok(failure instanceof Error);
    assert.equal(
      failure.message,
      "The sensor returned an invalid data payload",
    );
  });
});
