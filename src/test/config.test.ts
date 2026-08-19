import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { Logger, PlatformConfig } from "homebridge";
import {
  deviceConfigForAddress,
  normalizeAddress,
  normalizeConfig,
} from "../config.js";
import { PLATFORM_NAME, PLUGIN_NAME, PLUGIN_VERSION } from "../settings.js";

function logger(): Logger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  } as unknown as Logger;
}

describe("configuration", () => {
  it("keeps the backward-compatible platform alias and canonical package name", () => {
    assert.equal(PLATFORM_NAME, "xiaomi-plant-monitor");
    assert.equal(PLUGIN_NAME, "homebridge-xiaomi-plant-monitor-improved");
    assert.equal(PLUGIN_VERSION, "4.1.0");
  });

  it("normalizes global and per-device settings", () => {
    const config = normalizeConfig(
      {
        platform: PLATFORM_NAME,
        name: "My Plants",
        fetchDataIntervalInMs: 1_000,
        displayLightLevel: false,
        lowBatteryThreshold: 0,
        devices: [
          {
            address: " C4:7C:8D:6C:09:00 ",
            name: "Monstera",
            displayLightLevel: true,
            lowBatteryThreshold: 20,
          },
        ],
      } as PlatformConfig,
      logger(),
    );

    assert.equal(config.name, "My Plants");
    assert.equal(config.fetchDataIntervalInMs, 30_000);
    assert.equal(config.lowBatteryThreshold, 0);
    assert.equal(config.hasExplicitDevices, true);
    assert.deepEqual(config.devices, [
      {
        address: "c4:7c:8d:6c:09:00",
        name: "Monstera",
        displayTemperature: true,
        displayLightLevel: true,
        displayFertility: true,
        lowBatteryThreshold: 20,
      },
    ]);
  });

  it("deduplicates configured addresses and ignores invalid entries", () => {
    const config = normalizeConfig(
      {
        platform: PLATFORM_NAME,
        devices: [
          { address: "not-an-address" },
          { address: "c4:7c:8d:6c:09:00", name: "Old name" },
          { address: "C4:7C:8D:6C:09:00", name: "New name" },
        ],
      } as PlatformConfig,
      logger(),
    );

    assert.equal(config.devices.length, 1);
    assert.equal(config.devices[0].name, "New name");
  });

  it("creates defaults for dynamically discovered devices", () => {
    const config = normalizeConfig(
      { platform: PLATFORM_NAME, displayTemperature: false } as PlatformConfig,
      logger(),
    );
    const device = deviceConfigForAddress(config, "C4:7C:8D:6C:09:01");

    assert.equal(device.address, "c4:7c:8d:6c:09:01");
    assert.equal(device.name, "Plant c4:7c:8d:6c:09:01");
    assert.equal(device.displayTemperature, false);
  });

  it("normalizes addresses independently of accessory names", () => {
    assert.equal(
      normalizeAddress(" C4:7C:8D:6C:09:00 "),
      "c4:7c:8d:6c:09:00",
    );
  });

  it("renders configured sensors as editable tabs in Homebridge UI", () => {
    const schema = JSON.parse(
      readFileSync(new URL("../../config.schema.json", import.meta.url), "utf8"),
    ) as {
      layout: Array<string | { key?: string; type?: string; items?: string[] }>;
      schema: {
        properties: {
          lowBatteryThreshold: { minimum?: number; maximum?: number };
        };
      };
    };
    const devicesLayout = schema.layout.find(
      (entry) => typeof entry === "object" && entry.key === "devices",
    );

    assert.deepEqual(devicesLayout, {
      key: "devices",
      type: "tabarray",
      title: "{{ value.name || value.address || 'New Sensor' }}",
      expandable: true,
      expanded: true,
      orderable: true,
      items: [
        "devices[].address",
        "devices[].name",
        "devices[].displayTemperature",
        "devices[].displayLightLevel",
        "devices[].displayFertility",
        "devices[].lowBatteryThreshold",
      ],
    });
    assert.equal(schema.schema.properties.lowBatteryThreshold.minimum, undefined);
    assert.equal(schema.schema.properties.lowBatteryThreshold.maximum, undefined);
  });
});
