# Midnight Wallet dApp

A minimal React + Vite app that connects to a Midnight wallet (Lace — Midnight edition via the DApp connector),
builds the required MidnightJS providers from the wallet’s service URIs, and uses `@midnight-ntwrk/midnight-js-contracts`
helpers to deploy a Compact contract, call `mintTest`, and transfer tokens to a wallet.

## What you need
- Midnight-enabled Lace wallet installed in your browser and unlocked.
- Access to a Midnight test environment (the wallet exposes the Indexer, WS, Prover and Node URLs).
- Your Compact contracts compiled to ESM modules (`.mjs`) so the app can `import()` them at runtime.

## Run locally
```bash
yarn i   # or yarn / npm
yarn dev
```
Open http://localhost:5173 and **Connect Lace (Midnight)**.

## Notes / design
- The app uses these MidnightJS providers:
  - `levelPrivateStateProvider()` — IndexedDB-backed storage for private states and signing keys.
  - `indexerPublicDataProvider(httpUrl, wsUrl)` — GraphQL Indexer client.
  - `new FetchZkConfigProvider(nodeUrl)` — fetches ZK keys and zkIR from the node.
  - `httpClientProofProvider(proverUrl)` — HTTP client to the proof server.
  - A thin wallet adapter (via the DApp connector) to implement the `WalletProvider` and `MidnightProvider` interfaces.
- The wallet DApp connector is expected at `window.midnight.lace` and must support `enable`, `getServiceURIs`, `balanceTransaction`, `submitTransaction`.

## Security
- Keys never leave the wallet; proofs and submission are handled by the wallet + proof server.
- This is a testnet-only starter. Review and harden before production.

## Docker

```shell
docker build -t midnight-lace-dapp .
docker run -p 8080:8080 midnight-lace-dapp
```

OR

```shell
yarn dapp:docker
```

Access at: `http://localhost:8080`
