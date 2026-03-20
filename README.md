# Midnight Wallet dApp

A minimal React + Vite starter template for building decentralized applications on the Midnight network. Demonstrates wallet integration with Lace (Midnight edition), deploying Compact smart contracts, and token operations (minting, claiming, depositing, withdrawing).

## Prerequisites

- **Node.js** 22+ (see `.nvmrc`)
- **Yarn** (configured via `.yarnrc.yml`)
- **Lace Wallet** (Midnight edition) installed and unlocked in your browser
- Access to a Midnight test environment (QANet, Preview, PreProd, or local)
- Optional: Docker for containerized deployment
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
| `yarn build:docker`  | Build Docker image                      |
| `yarn dapp:docker`   | Run dApp via Docker Compose (port 8080) |
| `yarn env:up`        | Start local blockchain environment      |
| `yarn env:down`      | Stop local blockchain environment       |
| `yarn test:e2e`      | Run Playwright e2e smoke tests          |
| `yarn lint`          | Run ESLint                              |
| `yarn lint:fix`      | Run ESLint with auto-fix                |
| `yarn format`        | Format code with Prettier               |
| `yarn format:check`  | Check code formatting                   |
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
├── lib/
│   ├── providers.ts            # MidnightJS provider factory
│   ├── walletAdapter.ts        # Wallet DApp connector adapter
│   ├── types.ts                # Contract type definitions
│   └── crypto-shim.ts          # Crypto module shimming for browser
└── contract/
    ├── contracts/               # Compact contract source (.compact)
    ├── compiled/                # Compiled artifacts (keys, zkir, modules)
    └── index.ts                 # Contract import wrapper
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

Start a complete local environment with proof-server, indexer, and midnight-node:

```bash
yarn env:up      # Start services
yarn env:down    # Stop services
```

### Services

| Service          | Port |
| ---------------- | ---- |
| Proof Server     | 6300 |
| Indexer          | 8088 |
| Midnight Node    | 9944 |

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

| Problem | Solution |
| ------- | -------- |
| Wallet not detected | Ensure the Lace (Midnight edition) extension is installed, unlocked, and the page is refreshed. |
| WASM-related build errors | Run `yarn clean && yarn install` to clear caches and reinstall dependencies. |
| Contract compilation fails | Verify `COMPACTC_VERSION` is set (see `.envrc`) and run `yarn compact`. |
| Local environment won't start | Ensure Docker is running and ports 6300, 8088, 9944 are not in use. |
| Transaction errors | Check the Activity Log for details. Ensure the wallet is connected to the correct network. |

## Security

- Keys never leave the wallet; all signing happens in Lace
- Transaction balancing and proofs handled by wallet + proof server
- **Testnet only** — review and harden before any production use

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.
