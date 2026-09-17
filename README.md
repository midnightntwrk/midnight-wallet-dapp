# Midnight Wallet dApp

A minimal React + Vite starter template for building decentralized applications on the Midnight network. Demonstrates wallet integration with Lace (Midnight edition), deploying Compact smart contracts, and token operations (minting, claiming, depositing, withdrawing).

## Prerequisites

- **Node.js** 22+ (see `.nvmrc`)
- **Yarn** (configured via `.yarnrc.yml`)
- **Lace Wallet** (Midnight edition) installed and unlocked in your browser
- Access to a Midnight test environment (QANet, Preview, PreProd, or local)
- Optional: Docker for containerized deployment
- **[direnv](https://direnv.net/)** if you use the local stack. `compose.yml` interpolates the image
  tags exported by `.envrc` (`NODE_TAG`, `INDEXER_TAG`, `PROOF_SERVER_TAG`, …); without them loaded
  into your shell, `yarn env:up` resolves every image to a blank tag and the pull fails. Run
  `direnv allow` once, or `source .envrc` in the shell you run `yarn env:*` from.
- Optional: `COMPACTC_VERSION` env var for contract compilation (set via `.envrc`)

## Quick Start

```bash
yarn install
yarn dev
```

Open http://localhost:5173 and click **Connect Lace (Midnight)**.

## Available Scripts

| Script               | Description                             |
| -------------------- | --------------------------------------- |
| `yarn dev`           | Start development server (port 5173)    |
| `yarn build`         | Type-check and build for production     |
| `yarn preview`       | Preview production build                |
| `yarn compact`       | Compile Compact contracts               |
| `yarn contract-demo` | Generate contract build artifacts       |
| `yarn contract-demo:retained` | Build the pre-fork (ledger v8) twin |
| `yarn build:docker`  | Build Docker image                      |
| `yarn dapp:docker`   | Run dApp via Docker Compose (port 8080) |
| `yarn env:up`        | Start local blockchain environment      |
| `yarn env:fork`      | Enact the ledger v8 -> v9 hard fork      |
| `yarn env:down`      | Stop environment and remove its volumes |
| `yarn test:e2e`      | Run Playwright e2e smoke tests          |
| `yarn lint`          | Run ESLint                              |
| `yarn lint:fix`      | Run ESLint with auto-fix                |
| `yarn format`        | Format code with Prettier               |
| `yarn format:check`  | Check code formatting                   |
| `yarn changelog`     | Generate changelog from commit history  |
| `yarn clean`         | Remove dist, node_modules, and caches   |

## Project Structure

```
src/
├── App.tsx                     # Main React component with wallet/contract logic
├── main.tsx                    # Application entry point
├── styles.css                  # Global styles (dark theme)
├── polyfills.ts                # Node.js polyfills for browser
├── global.d.ts                 # Global type definitions
├── hooks/
│   ├── useWalletDetection.ts   # Wallet auto-detection hook
│   └── useActivityLog.ts       # Activity log management hook
├── utils/
│   └── errors.ts               # Error message extraction utility
├── components/
│   └── HardForkPanel.tsx       # Network Era card
├── lib/
│   ├── providers.ts            # MidnightJS provider factory
│   ├── session.ts              # Era-tagged contract session (deploy/join)
│   ├── era.ts                  # Network-head era reading
│   ├── walletAdapter.ts        # Wallet DApp connector adapter
│   ├── types.ts                # Contract type definitions
│   └── crypto-shim.ts          # Crypto module shimming for browser
└── contract/
    ├── contracts/               # Compact contract source (.compact)
    ├── compiled/                # Compiled artifacts (keys, zkir, modules)
    ├── index.ts                 # Contract import wrapper (current era)
    └── index-v8.ts              # Contract import wrapper (retained era)
```

## Technology Stack

- **React 19** + **Vite 7** + **TypeScript 5.9** (strict mode)
- **MidnightJS** libraries (v4.0.0-rc.2) for blockchain interaction
- **Apollo Client** for GraphQL subscriptions
- **RxJS** for reactive streams
- **Level** (IndexedDB) for private state storage
- **Playwright** for e2e testing

## Architecture

The app integrates with Midnight through these provider layers:

| Provider                    | Purpose                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `levelPrivateStateProvider` | IndexedDB-backed storage for private states and signing keys |
| `indexerPublicDataProvider` | GraphQL indexer client for blockchain data                   |
| `FetchZkConfigProvider`     | Fetches ZK keys and zkIR from the node                       |
| `httpClientProofProvider`   | HTTP client to the proof server                              |
| Wallet Adapter              | DApp connector for key management and transaction submission |

The wallet connector is expected at `window.midnight.lace` and must support API version 4.x with `enable`, `getServiceURIs`, `balanceTransaction`, and `submitTransaction`.

## Features

- **Wallet Connection**: Auto-detects Midnight wallet APIs, multi-wallet dropdown selector
- **Network Selection**: QANet, Preview, PreProd, or custom network configuration
- **Contract Deployment**: Deploy or join an existing token-transfers Compact contract
- **Unshielded Token Operations**:
  - Mint tokens with unique color identifier
  - Claim minted tokens to wallet address
  - Deposit/receive unshielded tokens
- **Shielded Token Operations**:
  - Mint and claim shielded tokens
  - Deposit shielded tokens with nonce, color, and value
- **NIGHT Token Operations**:
  - Deposit NIGHT tokens (1,000,000 STAR = 1 NIGHT)
  - Withdraw NIGHT tokens to address
- **Faucet Link**: Direct link to request test tokens on supported networks
- **Activity Log**: Real-time transaction monitoring with timestamps

## Docker Deployment

Build and run:

```bash
yarn build:docker
docker run -p 8080:8080 midnight-wallet-dapp
```

Or via Docker Compose:

```bash
yarn dapp:docker
```

Access at http://localhost:8080.

## Local Blockchain Environment

The local stack is a **hard-fork environment**: the chain's genesis carries the ledger v8 runtime,
but the node running it is the v9 binary. It therefore starts pre-fork, and `yarn env:fork` moves it
across the boundary through a real governance runtime upgrade — the same shape midnight-js uses in
`testkit-js/compose-fork.yml`.

```bash
yarn env:up      # Start services (chain comes up pre-fork, ledger v8)
yarn env:fork    # Enact the fork; takes a few minutes
yarn env:down    # Stop services and remove the volumes
```

`yarn env:down` removes the volumes on purpose. The chainspec lives in one, so a plain `down` would
resume the already-forked chain on the next start instead of giving you a fresh pre-fork one.

### Services

| Service                 | Port | Notes                                     |
| ----------------------- | ---- | ----------------------------------------- |
| Proof Server (ledger 9) | 6300 | Proves ledger-v9 contracts                |
| Proof Server (ledger 8) | 6301 | Proves ledger-v8 contracts, fork included |
| Indexer                 | 8088 | Serves both eras                          |
| Midnight Node           | 9944 | v9 binary on a chain that starts pre-fork |

Point the wallet at the proof server for the era of the **contract you are calling**, not for the
side of the fork the chain is on: 6301 for a ledger-v8 contract, 6300 for a ledger-v9 one. A contract
deployed before the fork keeps being proved at 6301 after it, which is the whole point of the
retained artifact. The dApp builds one proof provider from whatever `proverServerUri` the wallet
reports, so switching contract era means switching the wallet's proof-server setting and
reconnecting.

To check which side of the boundary the chain is on, read the runtime spec version — `1000000`
through `1999999` is pre-fork, `2000000` and above is post-fork:

```bash
curl -s -H 'Content-Type: application/json' \
  -d '{"id":1,"jsonrpc":"2.0","method":"state_getRuntimeVersion"}' http://localhost:9944
```

### Crossing the fork

The dApp carries **two** builds of the same `.compact` source:

| Artifact | Toolchain | Era |
| --- | --- | --- |
| `src/contract/compiled/token-transfers` | compactc 0.34.0, runtime 0.19.0 | current (ledger v9) |
| `src/contract/compiled/token-transfers-v8` | compactc 0.31.1, runtime 0.16.0 | retained (ledger v8) |

The retained twin is what makes a contract deployed *before* the fork still callable *after* it. Build
it with `yarn contract-demo:retained`; the script also repoints its generated module at the retained
runtime copy (`compact-runtime-ledger8`), because a browser bundle has one install where midnight-js
uses one per era.

**Both eras share one call surface.** Pick the era in the **Contract Era** selector before deploying or
joining; from then on the contract carries it, and the seven circuit buttons behave the same way on either
side of the boundary. (`sendShieldedToUser` and `mintShieldedToSelf` are compiled into both artifacts but
have no UI, so they are exercised by neither era.) A contract keeps the era it was deployed with for life — the network head decides
which pipeline runs underneath, which is the framework's business rather than the dApp's.

That works because both eras publish `callTx` as one typed method per circuit, and both artifacts are built
from the same source, so a union of the two handles is callable directly:

```ts
await session.handle.callTx.mintAndReceive(amount); // type-checks against both eras at once
```

No era branching appears in any circuit handler; the era is named only at deploy and join, plus the
selector that feeds them.

The **Network Era** card reports which side of the boundary the chain is on (`v8` before the fork, `v9`
after `yarn env:fork`). It is informational only — the Contract Era selector is not gated by it, so read
the card before choosing a pre-fork deploy. The framework still refuses a genuinely impossible pairing,
but it does so at deploy time rather than in the UI.

### Prefunded wallet seed

```
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon diesel
```

## Development

### Code quality

Pre-push hooks are configured via Husky to run:

- `yarn lint` — ESLint checks
- `yarn tsc --noEmit` — TypeScript type checking

Hooks are automatically installed when running `yarn install`.

### Code formatting

```bash
yarn format         # Auto-format with Prettier
yarn format:check   # Verify formatting without changes
```

## Testing

This dApp is itself a test harness — wallet developers run it to exercise their wallet implementation against real contract operations (deploy, mint, claim, deposit, withdraw). The included `yarn test:e2e` Playwright smoke test verifies the app builds and loads correctly, but the meaningful testing happens interactively through the UI with a connected wallet.

## Troubleshooting

| Problem                       | Solution                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Wallet not detected           | Ensure the Lace (Midnight edition) extension is installed, unlocked, and the page is refreshed. |
| WASM-related build errors     | Run `yarn clean && yarn install` to clear caches and reinstall dependencies.                    |
| Contract compilation fails    | Verify `COMPACTC_VERSION` is set (see `.envrc`) and run `yarn compact`.                         |
| Local environment won't start | Ensure Docker is running and ports 6300, 6301, 8088, 9944 are not in use.                       |
| Transaction errors            | Check the Activity Log for details. Ensure the wallet is connected to the correct network.      |

## Security

- Keys never leave the wallet; all signing happens in Lace
- Transaction balancing and proofs handled by wallet + proof server
- **Testnet only** — review and harden before any production use

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.
