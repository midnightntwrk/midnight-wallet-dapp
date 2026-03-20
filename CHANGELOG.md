# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [3.0.0](https://github.com/midnight-ntwrk/midnight-wallet-dapp/compare/v2.0.1...v3.0.0) (2026-03-20)

### Features

* add shielded transfers ([570ff6e](https://github.com/midnight-ntwrk/midnight-wallet-dapp/commit/570ff6e936240c9960dfb28df4d2188d60f97c7a))
* add wallet selector ([d27763b](https://github.com/midnight-ntwrk/midnight-wallet-dapp/commit/d27763be1d3965bec2055905b427f352924bc185))
* faucet link ([02cfc3a](https://github.com/midnight-ntwrk/midnight-wallet-dapp/commit/02cfc3a820951815ccdc075720bd8b422f4d3e82))
* network selector ([40423f1](https://github.com/midnight-ntwrk/midnight-wallet-dapp/commit/40423f15b9474ba99ff831200eb4adb7771060d3))
* update shielded transfers ([d693918](https://github.com/midnight-ntwrk/midnight-wallet-dapp/commit/d6939188cd652731334ebac203219095009d383d))

## [2.0.1](https://github.com/midnight-ntwrk/midnight-wallet-dapp/compare/v2.0.0...v2.0.1) (2026-03-13)

### Features

* add a not existing network to test the error case ([72d4ca4](https://github.com/midnight-ntwrk/midnight-wallet-dapp/commit/72d4ca49e77d6fa195ed59aa9c74b87d7d82066a))

## [2.0.0](https://github.com/midnight-ntwrk/midnight-wallet-dapp/compare/v1.0.0...v2.0.0) (2026-03-12)

### Changed

* Upgraded to MidnightJS v3.2.0
* Upgraded to Ledger v7.0.2 stack
* Recompiled contract to match new compactc version
* Externalized npm scope configuration
* Updated Docker images to versions 7.0.2, 3.1.0, and 0.21.0
* Updated mock wallet to use STAR terminology and added shielded address

## [1.0.0](https://github.com/midnight-ntwrk/midnight-wallet-dapp/releases/tag/v1.0.0) (2026-02-26)

### Added

* Initial release of the Midnight Wallet dApp
* Wallet connection with Lace (Midnight edition)
* Contract deployment for token-transfers Compact contract
* Unshielded token operations: mint, claim, deposit, withdraw
* NIGHT token deposit and withdrawal
* Activity log with real-time transaction monitoring
* Playwright e2e smoke tests
* Docker and Docker Compose deployment
* Local blockchain environment setup (proof-server, indexer, midnight-node)
* ESLint, Prettier, and Husky for code quality
* CI/CD pipeline with GitHub Actions
