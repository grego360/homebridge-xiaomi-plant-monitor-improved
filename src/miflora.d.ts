declare module 'miflora' {
  interface MiFloraDevice {
    address: string;
    query(): Promise<{
      firmwareInfo: {
        battery: number;
        firmware: string;
      };
      sensorValues: {
        temperature: number;
        lux: number;
        moisture: number;
        fertility: number;
      };
    }>;
  }

  interface MiFloraModule {
    discover(options?: {
      duration?: number;
      ignoreUnknown?: boolean;
      addresses?: string[];
    }): Promise<MiFloraDevice[]>;
  }

  const miflora: MiFloraModule;
  export default miflora;
}
