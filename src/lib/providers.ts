/*
 * This file is part of midnight-wallet-dapp.
 * Copyright (C) 2025-2026 Midnight Foundation
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
import type { ConnectedAPI, ProvingProvider } from '@midnight-ntwrk/dapp-connector-api';

import { createWalletProvidersFromConnectedAPI } from './walletAdapter';
import { DemoCircuits, DemoProviders } from './types';
import { type BlockHashConfig, type BlockHeightConfig, ProofProvider, UnboundTransaction } from '@midnight-ntwrk/midnight-js/types';
import { type ContractAddress, CostModel, UnprovenTransaction } from '@midnight-ntwrk/ledger-v8';

export type ShieldedAddress = {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
};

export const createProofProvider = (provingProvider: ProvingProvider): ProofProvider => ({
  async proveTx(unprovenTx: UnprovenTransaction): Promise<UnboundTransaction> {
    return unprovenTx.prove(provingProvider, CostModel.initialCostModel());
  },
});

export async function buildProvidersFromConnectedAPI(
  connectedAPI: ConnectedAPI,
  contractName: string
): Promise<DemoProviders> {
  const zkConfigHttpBase = window.location.origin + '/contract/compiled/' + contractName;
  const zkConfigProvider = new FetchZkConfigProvider<DemoCircuits>(zkConfigHttpBase, fetch.bind(window));

  const config = await connectedAPI.getConfiguration();
  const rawPublicDataProvider = indexerPublicDataProvider(config.indexerUri, config.indexerWsUri);

  const publicDataProvider = {
    ...rawPublicDataProvider,
    async queryZSwapAndContractState(
      contractAddress: ContractAddress,
      queryConfig?: BlockHeightConfig | BlockHashConfig
    ) {
      const result = await rawPublicDataProvider.queryZSwapAndContractState(contractAddress, queryConfig);
      if (!result) return result;

      const [zswapChainState, contractState, ledgerParameters] = result;
      return [zswapChainState.postBlockUpdate(new Date()), contractState, ledgerParameters] as typeof result;
    },
  };

  const proofProvider = httpClientProofProvider(config.proverServerUri!, zkConfigProvider);

  // TODO: not implemented in dapp-connector yet
  // const provingProvider = await connectedAPI.getProvingProvider(zkConfigProvider.asKeyMaterialProvider());
  // const proofProvider = createProofProvider(provingProvider);

  const shieldedAddress: ShieldedAddress = await connectedAPI.getShieldedAddresses();
  const unshieldedAddress = await connectedAPI.getUnshieldedAddress();

  const { walletProvider, midnightProvider } = createWalletProvidersFromConnectedAPI(
    connectedAPI,
    proofProvider,
    zkConfigProvider,
    shieldedAddress,
    unshieldedAddress.unshieldedAddress
  );

  // For demo purposes only, we use a simple password provider that returns a fixed password.
  const privateStateProvider = levelPrivateStateProvider({
    privateStoragePasswordProvider: () => 'Midnight-demo-app-storage-password!',
    accountId: shieldedAddress.shieldedAddress,
  });

  return {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
  };
}
