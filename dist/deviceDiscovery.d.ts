import type { Logger } from "homebridge";
import type { MiFloraDevice, NormalizedMiFloraConfig } from "./types.js";
interface MiFloraModule {
    discover(options?: {
        duration?: number;
        ignoreUnknown?: boolean;
        addresses?: string[];
    }): Promise<MiFloraDevice[]>;
}
type MiFloraLoader = () => Promise<MiFloraModule>;
export declare function discoverDevices(config: NormalizedMiFloraConfig, log: Logger, loader?: MiFloraLoader): Promise<MiFloraDevice[]>;
export {};
//# sourceMappingURL=deviceDiscovery.d.ts.map