# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Faucet link for requesting test tokens on supported networks
- Network selector with support for QANet, Preview, PreProd, and custom networks
- Shielded token operations (mint, claim, deposit)
- Multi-wallet dropdown selector
- `.nvmrc` for consistent Node.js version

### Changed

- Upgraded to MidnightJS v4.0.0-rc.2 (Ledger v8)
- Updated dependencies to latest versions
- Improved GitHub Actions security scanning

## [2.0.1] - 2026-03-13

### Added

- Error case test for non-existing network configuration

## [2.0.0] - 2026-03-12

### Changed

- Upgraded to MidnightJS v3.2.0
- Upgraded to Ledger v7.0.2 stack
- Recompiled contract to match new compactc version
- Externalized npm scope configuration
- Updated Docker images to versions 7.0.2, 3.1.0, and 0.21.0
- Updated mock wallet to use STAR terminology and added shielded address

## [1.0.0] - 2026-02-26

### Added

- Initial release of the Midnight Wallet dApp
- Wallet connection with Lace (Midnight edition)
- Contract deployment for token-transfers Compact contract
- Unshielded token operations: mint, claim, deposit, withdraw
- NIGHT token deposit and withdrawal
- Activity log with real-time transaction monitoring
- Playwright e2e smoke tests
- Docker and Docker Compose deployment
- Local blockchain environment setup (proof-server, indexer, midnight-node)
- ESLint, Prettier, and Husky for code quality
- CI/CD pipeline with GitHub Actions

[Unreleased]: https://github.com/midnight-ntwrk/midnight-wallet-dapp/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/midnight-ntwrk/midnight-wallet-dapp/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/midnight-ntwrk/midnight-wallet-dapp/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/midnight-ntwrk/midnight-wallet-dapp/releases/tag/v1.0.0
