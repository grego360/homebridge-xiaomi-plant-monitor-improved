import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from "homebridge";
export declare class MifloraPlatform implements DynamicPlatformPlugin {
    private readonly log;
    private readonly api;
    private readonly plants;
    private readonly config;
    private pollTimer?;
    private running;
    private shuttingDown;
    constructor(log: Logger, rawConfig: PlatformConfig, api: API);
    private start;
    private scheduleNextRun;
    run(): Promise<void>;
    searchAndAddNewPlants(): Promise<void>;
    private reconcileConfiguredAccessories;
    private upsertPlant;
    configureAccessory(accessory: PlatformAccessory): void;
    private addressFromCachedAccessory;
}
declare const _default: (api: API) => void;
export default _default;
//# sourceMappingURL=index.d.ts.map