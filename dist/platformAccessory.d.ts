import type { API } from "homebridge";
import type { MiFloraData, PlantAccessory, PlantAccessoryContext } from "./types.js";
export declare function configureAccessoryServices(plant: PlantAccessory, api: API, pluginVersion: string): void;
export declare function updateAccessoryServices(plant: PlantAccessory, data: MiFloraData, api: API): void;
export declare function setAccessoryFault(plant: PlantAccessory, api: API, faulted: boolean): void;
export declare function accessoryContext(plant: PlantAccessory): PlantAccessoryContext;
//# sourceMappingURL=platformAccessory.d.ts.map