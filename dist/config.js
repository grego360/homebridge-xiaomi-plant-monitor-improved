import { DEFAULT_FETCH_INTERVAL_MS, DEFAULT_LOW_BATTERY_THRESHOLD, MIN_FETCH_INTERVAL_MS, } from "./settings.js";
function boundedNumber(value, fallback, minimum, maximum) {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.min(maximum, Math.max(minimum, value))
        : fallback;
}
export function normalizeAddress(address) {
    return address.trim().toLowerCase();
}
export function isSupportedAddress(address) {
    return (/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(address) ||
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(address));
}
function normalizeDevice(device, defaults, log) {
    if (typeof device.address !== "string") {
        log.warn("Ignoring a configured device without an address");
        return undefined;
    }
    const address = normalizeAddress(device.address);
    if (!isSupportedAddress(address)) {
        log.warn(`Ignoring invalid Bluetooth address: ${device.address}`);
        return undefined;
    }
    return {
        address,
        name: device.name?.trim() || `Plant ${address}`,
        displayTemperature: device.displayTemperature ?? defaults.displayTemperature,
        displayLightLevel: device.displayLightLevel ?? defaults.displayLightLevel,
        displayFertility: device.displayFertility ?? defaults.displayFertility,
        lowBatteryThreshold: boundedNumber(device.lowBatteryThreshold, defaults.lowBatteryThreshold, 0, 100),
    };
}
export function normalizeConfig(rawConfig, log) {
    const config = rawConfig;
    const requestedInterval = config.fetchDataIntervalInMs;
    const fetchDataIntervalInMs = boundedNumber(requestedInterval, DEFAULT_FETCH_INTERVAL_MS, MIN_FETCH_INTERVAL_MS, Number.MAX_SAFE_INTEGER);
    if (typeof requestedInterval === "number" &&
        requestedInterval < MIN_FETCH_INTERVAL_MS) {
        log.warn(`fetchDataIntervalInMs was raised to the minimum of ${MIN_FETCH_INTERVAL_MS} ms`);
    }
    if (config.returnDefaultDataOnError !== undefined) {
        log.warn("returnDefaultDataOnError is deprecated and ignored; failed reads retain the last valid sensor values");
    }
    const defaults = {
        displayTemperature: config.displayTemperature ?? true,
        displayLightLevel: config.displayLightLevel ?? true,
        displayFertility: config.displayFertility ?? true,
        lowBatteryThreshold: boundedNumber(config.lowBatteryThreshold, DEFAULT_LOW_BATTERY_THRESHOLD, 0, 100),
    };
    const devicesByAddress = new Map();
    for (const device of config.devices ?? []) {
        const normalized = normalizeDevice(device, defaults, log);
        if (normalized) {
            devicesByAddress.set(normalized.address, normalized);
        }
    }
    return {
        name: typeof config.name === "string" && config.name.trim()
            ? config.name.trim()
            : "Plant Monitor",
        fetchDataIntervalInMs,
        ...defaults,
        devices: [...devicesByAddress.values()],
        hasExplicitDevices: Array.isArray(config.devices) && config.devices.length > 0,
    };
}
export function deviceConfigForAddress(config, address) {
    const normalizedAddress = normalizeAddress(address);
    return config.devices.find((device) => device.address === normalizedAddress) ?? {
        address: normalizedAddress,
        name: `Plant ${normalizedAddress}`,
        displayTemperature: config.displayTemperature,
        displayLightLevel: config.displayLightLevel,
        displayFertility: config.displayFertility,
        lowBatteryThreshold: config.lowBatteryThreshold,
    };
}
//# sourceMappingURL=config.js.map