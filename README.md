# Homebridge Xiaomi Plant Monitor (Improved)

[![npm version](https://img.shields.io/npm/v/homebridge-xiaomi-plant-monitor-improved.svg)](https://www.npmjs.com/package/homebridge-xiaomi-plant-monitor-improved)
[![npm downloads](https://img.shields.io/npm/dt/homebridge-xiaomi-plant-monitor-improved.svg)](https://www.npmjs.com/package/homebridge-xiaomi-plant-monitor-improved)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

> A robust Homebridge plugin for Xiaomi Mi Flora plant sensors with improved Bluetooth connectivity and reliability

## Acknowledgments

This plugin is a fork of the original [homebridge-xiaomi-plant-monitor](https://github.com/Zacknetic/homebridge-xiaomi-plant-monitor) with improvements to Bluetooth connectivity, device discovery, and error handling.

## Overview

This Homebridge plugin integrates Xiaomi Mi Flora plant sensors (also known as Flower Care, Flower Mate, or Flower Monitor) with HomeKit, allowing you to monitor your plants' health directly from the Home app on your Apple devices.

This improved version features enhanced Bluetooth connectivity, robust error handling, and better device discovery - making it more reliable, especially in challenging environments with weak Bluetooth signals.

## Key Features

### Core Functionality
- **Automatic Discovery**: Finds your Mi Flora sensors on the network
- **Multiple Sensor Types**:
  - Moisture level (displayed as humidity in HomeKit)
  - Battery level with low battery alerts
  - Temperature readings
  - Light level measurements
  - Soil fertility (conductivity) data

### Improved Reliability
- **Enhanced Bluetooth Connectivity**:
  - Robust retry logic with exponential backoff
  - Better handling of weak Bluetooth signals
  - Graceful degradation when devices can't be reached
- **Manual Device Configuration**: Option to specify device addresses directly
- **Comprehensive Error Handling**: Prevents plugin crashes due to connectivity issues

### Developer-Friendly
- **TypeScript Implementation**: Improved type safety and code quality
- **Extensive Documentation**: Clear setup and troubleshooting guides
- **Regular Updates**: Maintained for compatibility with latest Homebridge versions

## System Requirements

- **Homebridge**: v1.4.0 or newer
- **Node.js**: v16 or newer
- **Bluetooth**: Hardware support required

## Platform-Specific Prerequisites

### Linux (Ubuntu/Debian/Raspbian)

```bash
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
```

### macOS

No additional dependencies required, but you must ensure Bluetooth is enabled in System Settings.

### Windows

No additional dependencies required, but you must ensure Bluetooth is enabled in Settings.

### Raspberry Pi Specific Notes

If running on a Raspberry Pi:

1. Ensure your Raspberry Pi has Bluetooth capability (built-in on Pi 3/4/5)
2. Position the Pi within reasonable proximity to your plant sensors
3. Consider using a USB Bluetooth adapter if signal strength is poor

## Installation

### Via Homebridge UI (Recommended)

1. Open your Homebridge UI dashboard
2. Navigate to the "Plugins" tab
3. Search for "xiaomi plant monitor improved"
4. Click "Install"

### Via Command Line

```bash
npm install -g homebridge-xiaomi-plant-monitor-improved
```

## Configuration

### Basic Configuration

Add the platform to your Homebridge `config.json` file:

```json
"platforms": [
    {
        "platform": "xiaomi-plant-monitor",
        "name": "Plant Monitor",
        "fetchDataIntervalInMs": 3600000,
        "displayTemperature": true,
        "displayLightLevel": true,
        "displayFertility": true,
        "lowBatteryThreshold": 10
    }
]
```

### Manual Device Configuration (Recommended)

For more reliable operation, especially with weak Bluetooth signals, manually specify your devices:

```json
"platforms": [
    {
        "platform": "xiaomi-plant-monitor",
        "name": "Plant Monitor",
        "fetchDataIntervalInMs": 7200000,
        "devices": [
            {
                "address": "c4:7c:8d:6c:09:00",
                "name": "Monstera Plant"
            },
            {
                "address": "c4:7c:8d:6c:09:01",
                "name": "Fiddle Leaf Fig"
            }
        ]
    }
]
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `platform` | string | Required | Must be "xiaomi-plant-monitor" |
| `name` | string | "Plant Monitor" | Name for the platform in HomeKit |
| `fetchDataIntervalInMs` | number | 3600000 | Interval in milliseconds between data updates (default: 1 hour) |
| `displayTemperature` | boolean | true | Whether to display temperature sensors in HomeKit |
| `displayLightLevel` | boolean | true | Whether to display light level sensors in HomeKit |
| `displayFertility` | boolean | true | Whether to display fertility sensors in HomeKit |
| `lowBatteryThreshold` | number | 10 | Battery percentage threshold for low battery warnings |
| `devices` | array | [] | Optional array of manually specified devices |
| `devices[].address` | string | - | Bluetooth MAC address of the device |
| `devices[].name` | string | - | Custom name for the device in HomeKit |

## Troubleshooting Guide

### Common Issues and Solutions

#### Device Not Discovered

1. **Bluetooth Enabled**: Verify Bluetooth is enabled on your system
2. **Battery Check**: Ensure the Mi Flora device has a working battery (CR2032)
3. **Proximity**: Move the Homebridge server closer to the Mi Flora device
4. **Manual Configuration**: Add the device address manually in your config (see Manual Device Configuration)

#### Inaccurate Moisture Readings (0% or 100%)

1. **Sensor Placement**: Ensure all 4 sensor prongs are fully inserted into the soil
2. **Soil Contact**: Clean the metal prongs if they appear dirty or corroded
3. **Calibration**: Remove and reinsert the sensor into the soil
4. **Water Level**: If soil is completely dry, readings of 0% may be accurate

#### Connection Timeouts

1. **Signal Strength**: Check the RSSI value in logs (values below -80 indicate weak signal)
2. **Interference**: Move the sensor away from other electronic devices
3. **Retry Settings**: Increase the retry count in your configuration
4. **Update Interval**: Consider increasing `fetchDataIntervalInMs` to reduce connection frequency

### Finding Your Device Address

To find your Mi Flora device's Bluetooth address:

```bash
sudo hcitool lescan
```

Look for devices named "Flower care" or "Flower mate" in the output.

### Enabling Debug Logs

For detailed logging, start Homebridge with the debug flag:

```bash
DEBUG=homebridge-xiaomi-plant-monitor-improved homebridge
```

For even more detailed Bluetooth logs:

```bash
DEBUG=homebridge-xiaomi-plant-monitor-improved,miflora* homebridge
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/grego360/homebridge-xiaomi-plant-monitor-improved.git
cd homebridge-xiaomi-plant-monitor-improved

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Watch mode for development
npm run watch
```

### Available Scripts

- `npm run build` - Builds the TypeScript code
- `npm run watch` - Builds and watches for changes
- `npm test` - Runs the test suite
- `npm run lint` - Lints the codebase

## Technical Details

### How It Works

This plugin uses Bluetooth Low Energy (BLE) to communicate with Mi Flora devices. It:

1. Discovers devices via Bluetooth scanning
2. Connects to each device and queries sensor data
3. Creates HomeKit accessories for each sensor type
4. Periodically updates the sensor data based on the configured interval

### Bluetooth Connectivity Improvements

The improved version implements:

- Retry logic with exponential backoff
- Better error handling for connection failures
- Support for manual device configuration
- Graceful degradation when devices can't be reached

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter issues or have questions:

1. Check the [Troubleshooting Guide](#troubleshooting-guide)
2. Open an [issue on GitHub](https://github.com/grego360/homebridge-xiaomi-plant-monitor-improved/issues)

## License

ISC
