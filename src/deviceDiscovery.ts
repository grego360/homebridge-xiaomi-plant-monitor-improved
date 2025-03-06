import miflora from 'miflora';
import type { MiFloraDevice, MiFloraConfig } from './types.js';
import type { Logger } from 'homebridge';

/**
 * Discover Mi Flora devices with improved error handling
 */
export async function discoverDevices(config: MiFloraConfig, log: Logger): Promise<MiFloraDevice[]> {
  log.info('Scanning for Mi Flora plants...');
  try {
    // Configure discovery options
    const discoveryOptions = {
      duration: 20000, // Increase scan duration to 20 seconds for better discovery
      // If specific devices are configured, only look for those
      addresses: config.devices?.map(device => device.address),
      ignoreUnknown: config.devices?.length ? true : false,
    };

    log.debug('Discovery options:', discoveryOptions);

    // Attempt discovery with a timeout
    const discoveryPromise = miflora.discover(discoveryOptions) as Promise<MiFloraDevice[]>;

    // Add a timeout to the discovery process
    const timeoutPromise = new Promise<MiFloraDevice[]>((_, reject) => {
      setTimeout(() => reject(new Error('Discovery timed out after 30 seconds')), 30000);
    });

    // Race the discovery against the timeout
    const devices = await Promise.race([discoveryPromise, timeoutPromise]);

    log.info(`Finished scanning, found ${devices.length} plant(s)`);

    return devices;
  } catch (error) {
    log.error('Error discovering plants:', error);
    // If we have configured devices but discovery failed, try to add them anyway
    if (config.devices?.length) {
      log.info('Using configured devices as fallback');
      return config.devices.map(deviceConfig => {
        log.info(`Creating fallback device for ${deviceConfig.address}`);
        return {
          address: deviceConfig.address,
          query: async () => {
            throw new Error('Device not available, please check Bluetooth connection');
          },
        } as MiFloraDevice;
      });
    }
    throw error;
  }
}
