import type { MiFloraDevice } from "./types.js";
interface NobleCharacteristic {
    uuid: string;
    read(callback: (error: Error | null, data: Buffer) => void): void;
    write(data: Buffer, withoutResponse: boolean, callback: (error?: Error | null) => void): void;
}
interface NobleAdvertisement {
    localName?: string;
    serviceData?: Array<{
        uuid: string;
        data: Buffer;
    }>;
}
interface NoblePeripheral {
    address: string;
    state: string;
    advertisement: NobleAdvertisement;
    connect(callback: (error?: Error | null) => void): void;
    disconnect(callback?: () => void): void;
    discoverSomeServicesAndCharacteristics(serviceUuids: string[], characteristicUuids: string[], callback: (error: Error | null, services: unknown[], characteristics: NobleCharacteristic[]) => void): void;
}
interface NobleModule {
    state: string;
    on(event: "stateChange", listener: (state: string) => void): void;
    on(event: "discover", listener: (peripheral: NoblePeripheral) => void): void;
    removeListener(event: "stateChange", listener: (state: string) => void): void;
    removeListener(event: "discover", listener: (peripheral: NoblePeripheral) => void): void;
    startScanning(serviceUuids: string[], allowDuplicates: boolean, callback: (error?: Error | null) => void): void;
    stopScanning(callback?: () => void): void;
}
interface DiscoveryOptions {
    duration?: number;
    ignoreUnknown?: boolean;
    addresses?: string[];
}
export declare function discoverWithNoble(noble: NobleModule, options?: DiscoveryOptions): Promise<MiFloraDevice[]>;
export declare function discover(options?: DiscoveryOptions): Promise<MiFloraDevice[]>;
export {};
//# sourceMappingURL=miFloraClient.d.ts.map