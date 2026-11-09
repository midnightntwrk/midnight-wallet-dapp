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
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { ConnectedAPI } from '@midnightntwrk/dapp-connector-api';

import { createWalletProvidersFromConnectedAPI } from './walletAdapter';
import { DemoCircuits } from './types';
import { SerializedZswapChainState, type MidnightProviders } from '@midnight-ntwrk/midnight-js/types';
import type { ZkArtifactIntegrityMode } from '@midnight-ntwrk/midnight-js/utils';
import { type BlockHashConfig, type BlockHeightConfig } from '@midnight-ntwrk/midnight-js/types';
import { ZswapChainState, type ContractAddress } from '@midnightntwrk/ledger-v9';

const ZSWAP_MERKLE_ROOT_RETENTION_SECONDS = 3600n;

/**
 * How long a transaction this dApp builds stays valid, in seconds.
 *
 * Required per provider set since midnight-js 5.0.0, which has no default of its own. An hour is
 * what the framework's own wallet provider uses, and it is long enough for a demo session that
 * waits on a proof server between building a call and submitting it.
 */
const TRANSACTION_TTL_SECONDS = 3600;

export type ShieldedAddress = {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
};

/**
 * Only the connector methods a provider set reaches for: the three read here, plus the two the
 * wallet seams call. Narrowed the same way `createWalletProvidersFromConnectedAPI` narrows its own
 * parameter, so the dependency is honest and a caller — or a test — need not stand up a whole
 * connector.
 */
export type ProviderConnector = Pick<
  ConnectedAPI,
  | 'getConfiguration'
  | 'getShieldedAddresses'
  | 'getUnshieldedAddress'
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

  const config = await connectedAPI.getConfiguration();
  const publicDataProvider = indexerPublicDataProvider({
    queryURL: config.indexerUri,
    subscriptionURL: config.indexerWsUri,
  });

  // Past this point the provider owns a WebSocket and an Apollo client, but the caller has no way to
  // release them until this function returns the disposer. Every failure in between — a wallet with
  // no proof server set, a locked wallet, unavailable storage — must therefore release them here, or
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

    if (config.proverServerUri === undefined) {
      throw new Error(
        'The connected wallet did not supply a proof-server URL (proverServerUri). Set the proof ' +
          'server in the wallet — port 6301 for a ledger-v8 contract, 6300 for a ledger-v9 one — ' +
          'and reconnect.'
      );
    }
    const proofProvider = httpClientProofProvider({ url: config.proverServerUri, zkConfigProvider });

    // TODO: switch to connectedAPI.getProvingProvider once implemented in dapp-connector

    const shieldedAddress: ShieldedAddress = await connectedAPI.getShieldedAddresses();
    const unshieldedAddress = await connectedAPI.getUnshieldedAddress();

    const { walletProvider, midnightProvider } = createWalletProvidersFromConnectedAPI(
      connectedAPI,
      shieldedAddress,
      unshieldedAddress.unshieldedAddress
    );

    // For demo purposes only, we use a simple password provider that returns a fixed password.
    const privateStateProvider = levelPrivateStateProvider({
      privateStoragePasswordProvider: () => 'Midnight-demo-app-storage-password!',
      accountId: shieldedAddress.shieldedAddress,
    });

    return {
      providers: {
        config: { networkId: config.networkId, ttlSeconds: TRANSACTION_TTL_SECONDS },
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
