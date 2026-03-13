# Midnight Wallet dApp

A minimal React + Vite starter template for building decentralized applications on the Midnight network. Demonstrates wallet integration with Lace (Midnight edition), deploying Compact smart contracts, and token operations (minting, claiming, depositing, withdrawing).

## Prerequisites

- **Node.js** 22+
- **Yarn** (configured via `.yarnrc.yml`)
- **Lace Wallet** (Midnight edition) installed and unlocked in your browser
- Access to a Midnight test environment (preview, preprod, or local)

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
| `yarn build`         | Build for production                    |
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

## Project Structure

```
src/
├── App.tsx                 # Main React component with wallet/contract logic
├── main.tsx                # Application entry point
├── styles.css              # Global styles (dark theme)
├── polyfills.ts            # Node.js polyfills for browser
├── lib/
│   ├── providers.ts        # MidnightJS provider factory
│   ├── walletAdapter.ts    # Wallet DApp connector adapter
│   ├── faucet.ts           # Faucet token transfer utilities
│   └── types.ts            # Contract type definitions
└── contract/
    ├── contracts/          # Compact contract source (.compact)
    └── build/              # Compiled artifacts (keys, zkir, modules)
```

## Technology Stack

- **React 19** + **Vite 7** + **TypeScript 5.9**
- **MidnightJS** libraries for blockchain interaction
- **Apollo Client** for GraphQL subscriptions
- **RxJS** for reactive streams
- **Level** (IndexedDB) for private state storage

## Architecture

The app integrates with Midnight through these provider layers:

| Provider                    | Purpose                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `levelPrivateStateProvider` | IndexedDB-backed storage for private states and signing keys |
| `indexerPublicDataProvider` | GraphQL Indexer client for blockchain data                   |
| `FetchZkConfigProvider`     | Fetches ZK keys and zkIR from the node                       |
| `httpClientProofProvider`   | HTTP client to the proof server                              |
| Wallet Adapter              | DApp connector for key management and transaction submission |

The wallet connector is expected at `window.midnight.lace` and must support `enable`, `getServiceURIs`, `balanceTransaction`, `submitTransaction`.

## Features

- **Wallet Connection**: Auto-detects Midnight wallet APIs, supports multiple networks
- **Contract Deployment**: Deploy the unshielded-demo Compact contract
- **Token Operations**:
  - Mint tokens with unique color identifier
  - Claim minted tokens to wallet address
  - Deposit/withdraw unshielded tokens
  - Deposit/withdraw NIGHT tokens
- **Activity Log**: Real-time transaction monitoring with timestamps

## Docker Deployment

**Build and run:**

```bash
docker build -t midnight-lace-dapp .
docker run -p 8080:8080 midnight-lace-dapp
```

**Or via Docker Compose:**

```bash
yarn dapp:docker
```

Access at http://localhost:8080

## Local Blockchain Environment

### Start a complete local environment with proof-server, indexer, and midnight-node:

```bash
yarn env:up      # Start services
yarn env:down    # Stop services
```

### Services:

- **Proof Server**: port 6300
- **Indexer**: port 8088
- **Midnight Node**: port 9944

### Prefund wallet seed:

abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon diesel

## Development

Pre-push hooks are configured via Husky to run:

- `yarn lint` - ESLint checks
- `yarn tsc --noEmit` - TypeScript type checking

Hooks are automatically installed when running `yarn install`.

## Testing

This dApp is itself a test harness — wallet developers run it to exercise their wallet implementation against real contract operations (deploy, mint, claim, deposit, withdraw). The included `yarn test:e2e` Playwright smoke test verifies the app builds and loads correctly, but the meaningful testing happens interactively through the UI with a connected wallet.

## Security

- Keys never leave the wallet; all signing happens in Lace
- Transaction balancing and proofs handled by wallet + proof server
- **Testnet only** — review and harden before any production use

## License

See [LICENSE](LICENSE) for details.
