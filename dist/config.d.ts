import type { Logger, PlatformConfig } from "homebridge";
import type { NormalizedDeviceConfig, NormalizedMiFloraConfig } from "./types.js";
export declare function normalizeAddress(address: string): string;
export declare function isSupportedAddress(address: string): boolean;
export declare function normalizeConfig(rawConfig: PlatformConfig, log: Logger): NormalizedMiFloraConfig;
export declare function deviceConfigForAddress(config: NormalizedMiFloraConfig, address: string): NormalizedDeviceConfig;
//# sourceMappingURL=config.d.ts.map