# Changelog

All notable changes to this project will be documented in this file.

## [4.1.0] - 2026-08-17

### Changed

- Replaced the unmaintained `miflora` wrapper with an internal Mi Flora GATT client using the maintained Noble fork directly
- Limited service discovery to the three required Mi Flora characteristics
- Allowed up to 90 seconds for slow Linux BLE connections and 120 seconds for a complete query without nested legacy timers
- Correctly decode negative temperatures as signed 16-bit values

## [4.0.4] - 2026-08-17

### Fixed

- Read firmware and measurements separately to avoid the legacy library's short timeout around its combined query
- Increased the overall query deadline to 90 seconds for slow Linux BLE connections
- Made logs explicit when a timed-out native operation will not be retried

## [4.0.3] - 2026-08-17

### Fixed

- Treated the legacy `miflora` `Error("timeout")` as an uncancellable timeout so a still-running BLE operation is never retried concurrently
- Requested immediate sensor disconnection during shutdown so a pending connection is less likely to force a child-bridge `SIGKILL`

## [4.0.2] - 2026-08-17

### Fixed

- Deferred native Bluetooth initialization until discovery so an unavailable HCI socket no longer prevents Homebridge from registering the platform
- Added a regression test for unavailable container Bluetooth environments

## [4.0.1] - 2026-08-17

### Fixed

- Fixed the Homebridge UI sensor array so manually configured sensors can be added and edited
- Changed the global low-battery threshold from an awkward slider to a numeric input

## [4.0.0] - 2026-08-17

### Added

- Added a Homebridge UI configuration schema with global and per-device options
- Added configuration validation, normalized device identity, and meaningful unit tests
- Added Node.js 22/24 and Homebridge 1.11/2.x validation in CI
- Added explicit stale/fault state handling while retaining the last valid readings

### Changed

- Updated the canonical plugin identifier to match the npm package name
- Preserved `xiaomi-plant-monitor` as the platform alias for upgrade compatibility
- Serialized Bluetooth queries and prevented overlapping polling cycles
- Configured device names and per-device service options are now honored
- Accessories are identified by normalized Bluetooth address rather than display name
- Raised the minimum polling interval to 30 seconds
- Modernized TypeScript, linting, testing, packaging, and supported runtimes

### Fixed

- Temporary discovery failures no longer unregister cached accessories
- Timed-out Bluetooth operations are not retried concurrently
- Invalid and non-finite sensor payloads are rejected
- Timeout handles are cleared when operations settle
- Published package metadata, lockfile, generated output, and platform identifiers are synchronized

### Removed

- Removed fabricated fallback readings. `returnDefaultDataOnError` is deprecated and ignored

## [3.2.4] - 2025-03-06

### Added

- Added `returnDefaultDataOnError` configuration option (enabled by default) to provide fallback data when Bluetooth connections fail
- Improved timeout handling for Bluetooth operations to prevent hanging

### Fixed

- Fixed "Cannot read properties of undefined (reading 'read')" error during Bluetooth communication
- Enhanced error handling with more detailed logging
- Implemented more robust retry mechanism with longer delays between attempts
- Improved reliability when working with unstable Bluetooth connections

## [3.2.3] - 2025-03-06

### Fixed

- Fixed issue with accessories not being visible in HomeKit despite being visible in Homebridge
- Added proper naming and identification for all services to improve HomeKit integration
- Ensured accessories are properly published and updated in HomeKit
- Added unique identifiers for each service to prevent conflicts

## [3.2.2] - 2025-03-06

### Fixed

- Updated platform name to 'xiaomi-plant-monitor-improved' for better HomeKit integration
- Fixed light level characteristic to ensure minimum value of 0.0001 to comply with HomeKit requirements
- Improved error handling and logging for device discovery
- Enhanced validation of configuration properties

## [3.2.0] - 2025-03-06

### Added

- Improved Bluetooth device discovery with retry logic
- Added exponential backoff between connection attempts
- Added support for manual device configuration
- Enhanced error handling for device queries
- Added comprehensive documentation for troubleshooting

### Fixed

- Fixed miflora library import and TypeScript declarations
- Resolved Bluetooth connectivity issues with weak signals
- Fixed moisture sensor reading reliability
- Improved overall plugin stability

## [3.1.2] - 2025-03-06

### Added

- Converted project to TypeScript for better type safety and developer experience
- Added optional temperature sensor display
- Added optional light level sensor display
- Added optional fertility sensor display
- Added configurable low battery threshold
- Added development tools (nodemon for watch mode)
- Added unit test framework with Mocha and Chai
- Added ESLint for code quality
- Added LICENSE file with ISC license

### Changed

- Improved code organization with TypeScript interfaces
- Enhanced error handling with more specific type checking
- Improved build process with TypeScript configuration
- Updated package.json with better scripts and dependencies
- Enhanced README with development instructions

## [3.0.14] - 2025-03-06

### Breaking Changes

- Updated Node.js requirement to v16 or newer
- Updated Homebridge requirement to v1.4.0 or newer

### Added

- Improved error handling throughout the codebase
- Added detailed logging with debug support
- Added AccessoryInformation service with manufacturer, model, and serial number
- Added more descriptive names for services (e.g., "address Battery" instead of just the address)
- Added comprehensive documentation in README
- Added CHANGELOG.md to track changes

### Changed

- Fixed typo in class name (MifloraPlatfrom → MifloraPlatform)
- Updated miflora dependency to v1.0.6
- Added debug dependency for better logging
- Improved code structure with modern JavaScript practices
- Enhanced error handling with try/catch blocks
- Improved logging with more descriptive messages
- Updated README with current installation and usage instructions
- Updated .gitignore with more comprehensive exclusions

### Fixed

- Fixed initialization timing by using the didFinishLaunching event
- Improved handling of cached accessories
- Better error handling for Bluetooth discovery and device queries

## [2.0.14] - Previous version

- Initial version before the update
