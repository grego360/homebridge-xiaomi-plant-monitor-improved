import { readFileSync } from "node:fs";
export const PLUGIN_NAME = "homebridge-xiaomi-plant-monitor-improved";
// This is intentionally kept stable for backward compatibility with existing
// Homebridge configurations and cached accessories.
export const PLATFORM_NAME = "xiaomi-plant-monitor";
const packageManifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
export const PLUGIN_VERSION = packageManifest.version;
export const DEFAULT_FETCH_INTERVAL_MS = 3_600_000;
export const MIN_FETCH_INTERVAL_MS = 30_000;
export const DEFAULT_DISCOVERY_DURATION_MS = 20_000;
export const DISCOVERY_TIMEOUT_MS = 30_000;
export const CONNECTION_TIMEOUT_MS = 90_000;
export const QUERY_TIMEOUT_MS = 120_000;
export const QUERY_RETRIES = 3;
export const DEFAULT_LOW_BATTERY_THRESHOLD = 10;
//# sourceMappingURL=settings.js.map