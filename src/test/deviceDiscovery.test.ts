import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Logger, PlatformConfig } from "homebridge";
import { normalizeConfig } from "../config.js";
import { discoverDevices } from "../deviceDiscovery.js";
import { PLATFORM_NAME } from "../settings.js";

function logger(): Logger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  } as unknown as Logger;
}

describe("Bluetooth discovery", () => {
  it("loads the native BLE dependency only when discovery starts", async () => {
    const config = normalizeConfig(
      { platform: PLATFORM_NAME } as PlatformConfig,
      logger(),
    );
    const unavailable = new Error(
      "EAFNOSUPPORT, Address family not supported by protocol",
    );
    let loaderCalls = 0;

    await assert.rejects(
      discoverDevices(config, logger(), async () => {
        loaderCalls += 1;
        throw unavailable;
      }),
      unavailable,
    );

    assert.equal(loaderCalls, 1);
  });
});
