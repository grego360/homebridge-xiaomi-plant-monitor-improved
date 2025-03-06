# Contributing to homebridge-xiaomi-plant-monitor

Thank you for your interest in contributing to the Homebridge Mi Flora Plugin! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project.

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Setup

1. Clone your fork of the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the TypeScript code:
   ```bash
   npm run build
   ```
4. Run tests:
   ```bash
   npm test
   ```
5. Use watch mode during development:
   ```bash
   npm run watch
   ```

## Coding Standards

- Follow the existing code style
- Write TypeScript code with proper type annotations
- Add JSDoc comments for public APIs
- Ensure all tests pass before submitting a pull request
- Run ESLint to check for code quality issues:
  ```bash
  npm run lint
  ```

## Testing

- Add tests for new features
- Ensure existing tests pass
- Test your changes with actual Mi Flora devices if possible

## Pull Request Process

1. Update the README.md and documentation with details of changes if appropriate
2. Update the CHANGELOG.md with details of changes
3. The version number will be updated by the maintainers when your PR is merged
4. Your PR will be reviewed by the maintainers, who may request changes

## Questions?

If you have any questions about contributing, please open an issue in the repository.

Thank you for your contributions!
