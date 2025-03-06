import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
import type { MiFloraDevice, PlantAccessory, MiFloraConfig } from './types.js';
import miflora from 'miflora';
import debugModule from 'debug';

// Initialize debug logger
debugModule('homebridge-xiaomi-plant-monitor');
const PLUGIN_NAME = 'homebridge-xiaomi-plant-monitor';
const PLATFORM_NAME = 'xiaomi-plant-monitor';

/**
 * MiFlora Plant Monitor Platform for Homebridge
 */
class MifloraPlatform implements DynamicPlatformPlugin {
  private readonly log: Logger;
  private readonly api: API;
  private readonly config: MiFloraConfig;
  private readonly plants: PlantAccessory[] = [];
  private readonly fetchDataIntervalInMs: number;
  
  // Feature flags from config
  private readonly displayTemperature: boolean;
  private readonly displayLightLevel: boolean;
  private readonly displayFertility: boolean;
  private readonly lowBatteryThreshold: number;

  constructor(log: Logger, config: PlatformConfig, api: API) {
    this.log = log;
    this.api = api;
    this.config = config as MiFloraConfig;
    
    // Configuration options with defaults
    this.fetchDataIntervalInMs = this.config.fetchDataIntervalInMs || 3600000; // Default: 1 hour
    this.displayTemperature = this.config.displayTemperature !== false; // Default: true
    this.displayLightLevel = this.config.displayLightLevel !== false; // Default: true
    this.displayFertility = this.config.displayFertility !== false; // Default: true
    this.lowBatteryThreshold = this.config.lowBatteryThreshold || 10; // Default: 10%
    
    // Only start the plugin once the Homebridge API is available
    if (api) {
      // Listen to event "didFinishLaunching", this means homebridge is done loading cached accessories
      this.api.on('didFinishLaunching', () => {
        this.log.info('Xiaomi Plant Monitor finished launching');
        // Start the plugin
        this.run().catch(error => this.log.error('Error during initial run:', error));
        // Set up the interval for data fetching
        setInterval(() => this.run().catch(error => this.log.error('Error during scheduled run:', error)), 
          this.fetchDataIntervalInMs);
      });
    }
  }

  /**
   * Main run method that discovers and updates plant data
   */
  async run(): Promise<void> {
    try {
      this.log.info('Searching for Mi Flora plants...');
      await this.searchAndAddNewPlant();
      this.log.info('Fetching plant data...');
      await this.fetchPlantsData();
    } catch (e) {
      this.log.error('Error during run cycle:', e);
    }
  }

  /**
   * Fetch data for all plants in parallel
   */
  async fetchPlantsData(): Promise<void> {
    const promises = this.plants.map(plant => this.updatePlantData(plant));
    await Promise.allSettled(promises);
  }

  /**
   * Discover Mi Flora devices with improved error handling
   */
  async searchAndAddNewPlant(): Promise<void> {
    this.log.info('Scanning for Mi Flora plants...');
    try {
      // Configure discovery options
      const discoveryOptions = {
        duration: 20000, // Increase scan duration to 20 seconds for better discovery
        // If specific devices are configured, only look for those
        addresses: this.config.devices?.map(device => device.address),
        ignoreUnknown: this.config.devices?.length ? true : false
      };
      
      this.log.debug('Discovery options:', discoveryOptions);
      
      // Attempt discovery with a timeout
      const discoveryPromise = miflora.discover(discoveryOptions) as Promise<MiFloraDevice[]>;
      
      // Add a timeout to the discovery process
      const timeoutPromise = new Promise<MiFloraDevice[]>((_, reject) => {
        setTimeout(() => reject(new Error('Discovery timed out after 30 seconds')), 30000);
      });
      
      // Race the discovery against the timeout
      const devices = await Promise.race([discoveryPromise, timeoutPromise]);
      
      this.log.info(`Finished scanning, found ${devices.length} plant(s)`);
      
      for (const device of devices) {
        await this.addPlantAccessory(device);
      }
    } catch (error) {
      this.log.error('Error discovering plants:', error);
      // If we have configured devices but discovery failed, try to add them anyway
      if (this.config.devices?.length) {
        this.log.info('Using configured devices as fallback');
        for (const deviceConfig of this.config.devices) {
          try {
            // Create a minimal device object from the configuration
            const mockDevice = {
              address: deviceConfig.address,
              query: async () => {
                throw new Error('Device not available, please check Bluetooth connection');
              }
            } as MiFloraDevice;
            
            await this.addPlantAccessory(mockDevice);
          } catch (deviceError) {
            this.log.error(`Error adding configured device ${deviceConfig.address}:`, deviceError);
          }
        }
      }
    }
  }

  /**
   * Add a new plant accessory or update an existing one
   */
  async addPlantAccessory(device: MiFloraDevice): Promise<void> {
    try {
      const plant = this.plants.find(plant => plant.accessory.displayName === device.address);
      
      if (plant === undefined) {
        this.log.info(`Adding new plant: ${device.address}`);
        const uuid = this.api.hap.uuid.generate(device.address);
        const accessory = new this.api.platformAccessory(device.address, uuid);
        
        // Set accessory information
        const informationService = accessory.getService(this.api.hap.Service.AccessoryInformation) ||
          accessory.addService(this.api.hap.Service.AccessoryInformation);
          
        informationService
          .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'Xiaomi')
          .setCharacteristic(this.api.hap.Characteristic.Model, 'Mi Flora Plant Sensor')
          .setCharacteristic(this.api.hap.Characteristic.SerialNumber, device.address);
        
        // Add required services
        accessory.addService(this.api.hap.Service.HumiditySensor, `${device.address} Moisture`);
        accessory.addService(this.api.hap.Service.BatteryService, `${device.address} Battery`);
        
        // Add optional services based on config
        if (this.displayTemperature) {
          accessory.addService(this.api.hap.Service.TemperatureSensor, `${device.address} Temperature`);
        }
        
        if (this.displayLightLevel) {
          accessory.addService(this.api.hap.Service.LightSensor, `${device.address} Light`);
        }
        
        this.plants.push({device, accessory});
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      } else if (plant.device === undefined) {
        this.log.info(`Setting cached plant: ${device.address}`);
        const indexToUpdate = this.plants.findIndex(plant => plant.accessory.displayName === device.address);
        this.plants[indexToUpdate] = {device, accessory: plant.accessory};
      } else {
        this.log.debug(`Plant already exists: ${device.address}`);
      }
    } catch (error) {
      this.log.error(`Error adding plant accessory ${device.address}:`, error);
    }
  }

  /**
   * Update data for a specific plant with retry logic
   */
  async updatePlantData(plant: PlantAccessory): Promise<void> {
    try {
      if (plant.device === undefined) {
        this.log.info('Cached plant not found, removing from accessories');
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [plant.accessory]);
        const indexToDelete = this.plants.findIndex(element => element === plant);
        this.plants.splice(indexToDelete, 1);
        return;
      }
      
      // Query the device for updated data with retry logic
      let retries = 3;
      let lastError: Error | null = null;
      let queryResult = null;
      
      while (retries > 0 && queryResult === null) {
        try {
          this.log.debug(`Attempting to query plant ${plant.accessory.displayName}, attempts remaining: ${retries}`);
          queryResult = await plant.device.query();
          break; // Success, exit the retry loop
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          this.log.debug(`Query attempt failed: ${lastError.message}, retries left: ${retries-1}`);
          retries--;
          if (retries > 0) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, (4 - retries) * 2000));
          }
        }
      }
      
      if (queryResult === null) {
        throw lastError || new Error('Failed to query device after multiple attempts');
      }
      
      const { firmwareInfo, sensorValues } = queryResult;
      const { battery, firmware } = firmwareInfo;
      const { temperature, lux, moisture, fertility } = sensorValues;
      
      this.log.info(`Plant: ${plant.accessory.displayName} | Battery: ${battery}% | Firmware: ${firmware} | Temperature: ${temperature}°C | Light: ${lux} lux | Moisture: ${moisture}% | Fertility: ${fertility} µS/cm`);
      
      // Update humidity service (moisture)
      const humidityService = plant.accessory.getService(this.api.hap.Service.HumiditySensor);
      if (humidityService) {
        humidityService.updateCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity, moisture);
        humidityService.updateCharacteristic(
          this.api.hap.Characteristic.StatusLowBattery,
          battery < this.lowBatteryThreshold 
            ? this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW 
            : this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
        );
      }
      
      // Update battery service
      const batteryService = plant.accessory.getService(this.api.hap.Service.BatteryService);
      if (batteryService) {
        batteryService.updateCharacteristic(this.api.hap.Characteristic.ChargingState, this.api.hap.Characteristic.ChargingState.NOT_CHARGEABLE);
        batteryService.updateCharacteristic(this.api.hap.Characteristic.BatteryLevel, battery);
        batteryService.updateCharacteristic(
          this.api.hap.Characteristic.StatusLowBattery,
          battery < this.lowBatteryThreshold 
            ? this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW 
            : this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
        );
      }
      
      // Update temperature service if enabled
      if (this.displayTemperature) {
        const temperatureService = plant.accessory.getService(this.api.hap.Service.TemperatureSensor);
        if (temperatureService) {
          temperatureService.updateCharacteristic(this.api.hap.Characteristic.CurrentTemperature, temperature);
          temperatureService.updateCharacteristic(
            this.api.hap.Characteristic.StatusLowBattery,
            battery < this.lowBatteryThreshold 
              ? this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW 
              : this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
          );
        }
      }
      
      // Update light level service if enabled
      if (this.displayLightLevel) {
        const lightService = plant.accessory.getService(this.api.hap.Service.LightSensor);
        if (lightService) {
          lightService.updateCharacteristic(this.api.hap.Characteristic.CurrentAmbientLightLevel, lux);
          lightService.updateCharacteristic(
            this.api.hap.Characteristic.StatusLowBattery,
            battery < this.lowBatteryThreshold 
              ? this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW 
              : this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
          );
        }
      }
      
      // Update fertility data (we don't have a direct HomeKit service for this)
      // So we log it for now, but in the future could add a custom characteristic
      if (this.displayFertility) {
        this.log.debug(`Plant: ${plant.accessory.displayName} | Fertility: ${fertility} µS/cm`);
        // Future enhancement: could add a custom characteristic for fertility
      }
      
    } catch (error) {
      this.log.error(`Error updating plant data for ${plant.accessory.displayName}:`, error);
    }
  }

  /**
   * Configure cached accessories
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info(`Adding cached accessory: ${accessory.displayName}`);
    this.plants.push({device: undefined, accessory});
  }
}

/**
 * Register the platform with Homebridge
 */
const init = (api: API) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, MifloraPlatform);
};

export default init;
