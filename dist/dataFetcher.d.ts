import type { API, Logger } from "homebridge";
import type { MiFloraData, PlantAccessory } from "./types.js";
interface QueryOptions {
    retries?: number;
    timeoutMs?: number;
    retryDelayMs?: number;
}
export declare function isMiFloraData(value: unknown): value is MiFloraData;
export declare function queryPlantData(plant: PlantAccessory, log: Logger, options?: QueryOptions): Promise<MiFloraData>;
export declare function disconnectPlantDevices(plants: PlantAccessory[], log: Logger): Promise<void>;
/**
 * BLE operations are deliberately serialized. Most Homebridge installations
 * have a single adapter and parallel GATT connections are unreliable.
 */
export declare function fetchPlantsData(plants: PlantAccessory[], log: Logger, api: API): Promise<void>;
export {};
//# sourceMappingURL=dataFetcher.d.ts.map