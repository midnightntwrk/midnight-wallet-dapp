/*
 * This file is part of midnight-wallet-dapp.
 * Copyright (C) Midnight Foundation
 * SPDX-License-Identifier: Apache-2.0
 * Licensed under the Apache License, Version 2.0 (the "License");
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import {
  dappConnectorNetwork,
  dappConnectorProofProvider,
  dappConnectorWalletProviders,
} from '@midnight-ntwrk/midnight-js-dapp-connector-proof-provider';
import type { ConnectedAPI } from '@midnightntwrk/dapp-connector-api';

import { DemoCircuits } from './types';
import { SerializedZswapChainState, type MidnightProviders } from '@midnight-ntwrk/midnight-js/types';
import type { ZkArtifactIntegrityMode } from '@midnight-ntwrk/midnight-js/utils';
import { type BlockHashConfig, type BlockHeightConfig } from '@midnight-ntwrk/midnight-js/types';
import { CostModel, ZswapChainState, type ContractAddress } from '@midnightntwrk/ledger-v9';

const ZSWAP_MERKLE_ROOT_RETENTION_SECONDS = 3600n;

/**
 * How long a transaction this dApp builds stays valid, in seconds.
 *
 * Required per provider set since midnight-js 5.0.0, which has no default of its own. An hour is
 * what the framework's own wallet provider uses, and it is long enough for a demo session that
 * waits on a proof server between building a call and submitting it.
 */
const TRANSACTION_TTL_SECONDS = 3600;

/**
 * Only the connector methods a provider set reaches for: `getConfiguration` for the network,
 * `getProvingProvider` for proving, `getShieldedAddresses` for the private-state account, and the
 * two the framework's wallet seams call. Narrowed so the dependency is honest and a caller — or a
 * test — need not stand up a whole connector.
 */
export type ProviderConnector = Pick<
  ConnectedAPI,
  | 'getConfiguration'
  | 'getProvingProvider'
  | 'getShieldedAddresses'
  | 'balanceUnsealedTransaction'
  | 'submitTransaction'
>;

/**
 * A provider set together with the cleanup its indexer connection needs.
 *
 * `indexerPublicDataProvider` opens a WebSocket and an Apollo client; the generic
 * `PublicDataProvider` interface does not expose `dispose()`, so the concrete handle is captured
 * here rather than being recovered with a cast at the call site.
 */
export type ProviderBundle<K extends string> = {
  readonly providers: MidnightProviders<K>;
  readonly dispose: () => Promise<void>;
};

/**
 * Builds the provider set for one compiled artifact.
 *
 * Generic in the circuit-id type because the two eras name their circuits differently: compact-js
 * brands the current era's ids, while the retained era uses plain literals. One provider set typed
 * for the other era's ids does not satisfy the call sites.
 *
 * `integrity` exists for the retained artifact: compactc 0.31.1 emits no `contract-manifest.json`,
 * and verification reads exactly that file, so the default `'require'` refuses every pre-fork
 * artifact however intact it is.
 */
export async function buildProvidersFromConnectedAPI<K extends string = DemoCircuits>(
  connectedAPI: ProviderConnector,
  contractName: string,
  integrity: ZkArtifactIntegrityMode = 'require'
): Promise<ProviderBundle<K>> {
  const zkConfigHttpBase = window.location.origin + '/contract/compiled/' + contractName;
  const zkConfigProvider = new FetchZkConfigProvider<K>(zkConfigHttpBase, {
    fetchFunc: fetch.bind(window),
    verify: integrity,
  });

  // The endpoints and the network id come from the wallet rather than being read field by field:
  // the connector reports one node URI, and deriving the second scheme from it is the framework's
  // job, not this dApp's.
  const network = await dappConnectorNetwork(connectedAPI);
  const publicDataProvider = indexerPublicDataProvider(network.indexer);

  // Past this point the provider owns a WebSocket and an Apollo client, but the caller has no way to
  // release them until this function returns the disposer. Every failure in between — a wallet that
  // refuses to prove, a locked wallet, unavailable storage — must therefore release them here, or
  // each retry by a user fixing their wallet strands another connection.
  try {
    const baseQueryZSwapAndContractState = publicDataProvider.queryZSwapAndContractState.bind(publicDataProvider);
    publicDataProvider.queryZSwapAndContractState = async (
      contractAddress: ContractAddress,
      queryConfig?: BlockHeightConfig | BlockHashConfig
    ) => {
      const result = await baseQueryZSwapAndContractState(contractAddress, queryConfig);
      if (!result) return result;

      // The read crosses as bytes now, so the retention window is applied by decoding with this
      // dApp's own ledger copy and sealing the result back into a state of the same era. Only the
      // current era is decoded here: this dApp carries no v8 runtime, and a pre-fork read is better
      // passed through untouched than refused by a decoder that has nothing to offer it.
      const { zswapChainState } = result;
      if (zswapChainState.era !== 'v9') return result;

      const updated = zswapChainState
        .deserialize({ v9: ZswapChainState })
        .postBlockUpdate(new Date(), ZSWAP_MERKLE_ROOT_RETENTION_SECONDS);
      return { ...result, zswapChainState: SerializedZswapChainState.fromBytes('v9', updated.serialize()) };
    };

    // Proving goes through the wallet, so this dApp never learns a proof-server URL and the user
    // never has to point one at the era they are calling. The cost model is consulted on the
    // current era only; the retained ledger type-checks `prove()` against its own class across the
    // WASM boundary and uses that one instead.
    const proofProvider = await dappConnectorProofProvider(
      connectedAPI,
      zkConfigProvider,
      CostModel.initialCostModel()
    );

    const { walletProvider, midnightProvider } = await dappConnectorWalletProviders(connectedAPI);

    // Read for the private-state account id. The wallet providers above read the shielded keys
    // themselves, so this is the account this device stores state under, not key material they need.
    const shieldedAddress = await connectedAPI.getShieldedAddresses();

    // For demo purposes only, we use a simple password provider that returns a fixed password.
    const privateStateProvider = levelPrivateStateProvider({
      privateStoragePasswordProvider: () => 'Midnight-demo-app-storage-password!',
      accountId: shieldedAddress.shieldedAddress,
    });

    return {
      providers: {
        config: { networkId: network.networkId, ttlSeconds: TRANSACTION_TTL_SECONDS },
        privateStateProvider,
        publicDataProvider,
        zkConfigProvider,
        proofProvider,
        walletProvider,
        midnightProvider,
      },
      dispose: () => publicDataProvider.dispose(),
    };
  } catch (error) {
    // Reported, never rethrown: the error worth surfacing is the one that explains why the set could
    // not be built, not a failure to tidy up after it.
    await publicDataProvider.dispose().catch((disposeError: unknown) => {
      console.error('[providers] could not release the indexer after a failed build', disposeError);
    });
    throw error;
  }
}
