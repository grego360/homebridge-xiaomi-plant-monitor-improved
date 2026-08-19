# Homebridge Xiaomi Plant Monitor Improved

[![npm version](https://img.shields.io/npm/v/homebridge-xiaomi-plant-monitor-improved.svg)](https://www.npmjs.com/package/homebridge-xiaomi-plant-monitor-improved)
[![npm downloads](https://img.shields.io/npm/dt/homebridge-xiaomi-plant-monitor-improved.svg)](https://www.npmjs.com/package/homebridge-xiaomi-plant-monitor-improved)

A Homebridge dynamic-platform plugin for Xiaomi Mi Flora, Flower Care, Flower Pot, and compatible Bluetooth Low Energy plant sensors.

## Features

- Soil moisture, battery, temperature, and ambient-light readings in HomeKit
- Soil conductivity/fertility readings in Homebridge logs
- Automatic discovery or an explicit list of Bluetooth addresses
- Stable cached accessories across restarts and temporary discovery failures
- Serialized Bluetooth operations with safe retry and timeout behavior
- Per-device names, service visibility, and low-battery thresholds
- Last-known-value retention and HomeKit fault status when a sensor is unavailable
- Homebridge UI configuration schema
- Native Mi Flora GATT client with no dependency on the legacy `miflora` wrapper

The plugin never substitutes invented readings when Bluetooth communication fails.

## Requirements

- Homebridge 1.11 or 2.x
- Node.js 22.14 or newer in the Node.js 22 line, or Node.js 24
- A working Bluetooth Low Energy adapter
- Linux permissions to open a raw Bluetooth HCI socket

Linux and Raspberry Pi OS are the primary deployment targets. macOS and Windows use Noble's platform-specific native Bluetooth implementation and should be considered best effort.

### Debian, Ubuntu, and Raspberry Pi OS

Install the Bluetooth packages before installing the plugin:

```bash
sudo apt-get update
sudo apt-get install -y bluetooth bluez libbluetooth-dev libudev-dev libcap2-bin
```

On Raspberry Pi OS, also install the Raspberry Pi Bluetooth package when it is not already present:

```bash
sudo apt-get install -y pi-bluetooth
```

For an official Homebridge installation, grant raw Bluetooth access to its bundled Node.js binary:

```bash
sudo setcap cap_net_raw+eip "$(readlink -f /opt/homebridge/bin/node)"
```

If Homebridge uses a different Node.js binary, apply the capability to that binary instead. Node.js upgrades may replace the executable and require the capability to be applied again.

Confirm that Bluetooth is enabled and a controller is available:

```bash
sudo systemctl enable --now bluetooth
sudo rfkill unblock bluetooth
bluetoothctl list
```

## Installation

Install **Xiaomi Plant Monitor Improved** from the Homebridge UI, or use npm in the environment where Homebridge manages its plugins:

```bash
npm install -g homebridge-xiaomi-plant-monitor-improved
```

Restart Homebridge after installation.

## Configuration

Use the Homebridge UI settings form or add the platform to `config.json`. The platform identifier remains `xiaomi-plant-monitor` for compatibility with existing installations and cached accessories.

Manual device configuration is recommended because it provides stable names and limits discovery to the intended sensors:

```json
{
  "platform": "xiaomi-plant-monitor",
  "name": "Plant Monitor",
  "fetchDataIntervalInMs": 3600000,
  "displayTemperature": true,
  "displayLightLevel": true,
  "displayFertility": true,
  "lowBatteryThreshold": 10,
  "devices": [
    {
      "address": "c4:7c:8d:6c:09:00",
      "name": "Monstera"
    },
    {
      "address": "c4:7c:8d:6c:09:01",
      "name": "Fiddle Leaf Fig",
      "displayLightLevel": false,
      "lowBatteryThreshold": 15
    }
  ]
}
```

Omit `devices`, or leave it empty, to discover all compatible sensors automatically. After discovery, add each address explicitly to assign a stable friendly name.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | string | `Plant Monitor` | Platform display name |
| `fetchDataIntervalInMs` | integer | `3600000` | Delay between completed polling cycles; minimum 30000 ms |
| `displayTemperature` | boolean | `true` | Add temperature services by default |
| `displayLightLevel` | boolean | `true` | Add ambient-light services by default |
| `displayFertility` | boolean | `true` | Include conductivity/fertility values in logs |
| `lowBatteryThreshold` | integer | `10` | Default low-battery threshold, clamped to 0–100% |
| `devices` | array | omitted | Explicit sensors; enables address-filtered discovery |
| `devices[].address` | string | required | BLE MAC address or platform BLE UUID |
| `devices[].name` | string | generated | HomeKit accessory name |
| `devices[].displayTemperature` | boolean | global value | Per-device temperature override |
| `devices[].displayLightLevel` | boolean | global value | Per-device light override |
| `devices[].displayFertility` | boolean | global value | Per-device fertility-log override |
| `devices[].lowBatteryThreshold` | integer | global value | Per-device low-battery threshold |

Apple Home has no standard soil-conductivity characteristic, so fertility is logged rather than displayed as a Home tile. Moisture is represented using HomeKit's humidity service.

## Finding a sensor address

Mi Flora sensors advertise without pairing. Keep the sensor near the Homebridge adapter, close any plant-monitoring phone app, and scan for 30 seconds:

```bash
bluetoothctl --timeout 30 scan on
bluetoothctl devices
```

Inspect a likely address:

```bash
bluetoothctl info C4:7C:8D:6C:09:00
```

An original Flower Care sensor normally advertises Xiaomi service UUID `0000fe95-0000-1000-8000-00805f9b34fb`. Its friendly name may remain unavailable until the first successful connection.

Do not pair the sensor. A temporary `bluetoothctl connect ADDRESS` can be used as a diagnostic; disconnect it before starting Homebridge.

## Polling behavior

At the start of a cycle, the plugin discovers configured sensors, connects to each sensor serially, reads firmware and battery data, enables realtime mode, reads measurements, and disconnects. A slow Linux BLE connection may take close to the 90-second connection deadline; the complete query has a 120-second deadline.

One hour (`3600000` ms) is appropriate for normal plant monitoring. Use `30000` only for short testing sessions. The next cycle is scheduled after the current cycle completes, so polls do not overlap.

Many Mi Flora sensors accept only one active GATT connection. The Flower Care app, another Homebridge instance, Home Assistant, or another active gateway can make discovery succeed while reads time out. Passive advertisement listeners normally do not hold a GATT connection.

## Failure behavior

When a sensor cannot be read, the plugin:

1. Leaves the last valid HomeKit readings unchanged.
2. Marks its sensor services with a fault status.
3. Logs the operation and error that failed.
4. Clears the fault after the next successful read.

Ordinary transient errors can be retried. A timed-out native operation is not retried immediately because it may still be running and cannot always be cancelled safely.

A discovery miss does not delete an accessory. In explicit-device mode, an accessory is removed only when its address is removed from `devices`.

The legacy `returnDefaultDataOnError` option is ignored and can be removed from configuration.

## Troubleshooting

### Sensor is not discovered

- Replace the CR2032 battery if its condition is uncertain.
- Move the sensor closer to the Homebridge adapter.
- Confirm the controller is listed by `bluetoothctl list`.
- Run `bluetoothctl --timeout 30 scan on` and look for the Xiaomi `FE95` service.
- Configure the discovered address explicitly.
- Ensure Bluetooth is powered on and not blocked by `rfkill`.

### Discovery works but reads time out

- Close the Flower Care app and temporarily disable Bluetooth on nearby phones.
- Stop other services that actively poll the same sensor.
- Keep the sensor within one metre of the adapter for testing.
- Replace the battery even if advertisements are still visible.
- Stop any interactive `bluetoothctl` scan or connection before restarting Homebridge.
- Restart Bluetooth and then Homebridge.

Version 4.1 and newer report whether the connection, GATT discovery, characteristic read, characteristic write, or disconnect timed out. Allow at least two minutes after startup before restarting the bridge during diagnosis.

### Raspberry Pi permission errors

Verify the capability on the actual Node.js binary used by Homebridge:

```bash
getcap "$(readlink -f /opt/homebridge/bin/node)"
```

Expected output includes `cap_net_raw=eip`. Reapply it with `setcap` if it is missing.

### `EAFNOSUPPORT` in an LXC container

The Noble transport opens a raw Linux HCI socket. Linux rejects `AF_BLUETOOTH` sockets in a separate network namespace, so a normal LXC container can report `Address family not supported by protocol` even when its USB adapter is visible.

Use a VM with USB Bluetooth passthrough, run Homebridge directly on a suitable host, or use a deployment that shares the host network namespace. Device passthrough and additional container capabilities alone do not remove this kernel limitation. A VM is the recommended Proxmox deployment for this transport.

### Homebridge reports the plugin but Bluetooth is unavailable

Native Bluetooth initialization is deferred until discovery. The platform therefore remains registered, restores cached accessories, retains their last real readings, and reports the Bluetooth failure without making Homebridge treat the plugin as missing.

## Development

```bash
npm ci
npm run lint
npm test
npm run build
npm pack --dry-run
```

The codebase is split into configuration normalization, native Mi Flora discovery/GATT transport, serialized data fetching, HomeKit service management, and platform lifecycle modules under `src/`.

Pull requests should include tests for behavior changes. Bluetooth changes should also be exercised on actual Raspberry Pi or Linux hardware with both a reachable and an unavailable sensor.

## Upgrade notes

### Version 4.1

- The unmaintained `miflora` wrapper was replaced by an internal client built directly on `@abandonware/noble`.
- Connection setup now has a 90-second deadline, a complete query has a 120-second deadline, and required GATT characteristics are discovered directly.
- No configuration changes are required when upgrading from 4.0.

### Version 4.0

- Node.js 16, 18, and 20 are no longer supported.
- Keep the existing `xiaomi-plant-monitor` platform value.
- Cached accessories continue to use Bluetooth-address-derived UUIDs.
- Failed queries retain real cached values instead of publishing synthetic defaults.

## Acknowledgments

This project builds on the original [homebridge-xiaomi-plant-monitor](https://github.com/Zacknetic/homebridge-xiaomi-plant-monitor) project and the wider Mi Flora reverse-engineering community.

## License

ISC
