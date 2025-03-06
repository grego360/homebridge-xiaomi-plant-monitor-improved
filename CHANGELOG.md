# Changelog

All notable changes to this project will be documented in this file.

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
