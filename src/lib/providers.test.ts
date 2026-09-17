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

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { dispose, indexerPublicDataProvider } = vi.hoisted(() => {
  const dispose = vi.fn(() => Promise.resolve());
  return {
    dispose,
    // The indexer provider opens a WebSocket and an Apollo client the moment it is constructed, so
    // every path that abandons it after this point has to release it.
    indexerPublicDataProvider: vi.fn(() => ({ dispose, queryZSwapAndContractState: vi.fn() })),
  };
});

vi.mock('@midnight-ntwrk/midnight-js-indexer-public-data-provider', () => ({ indexerPublicDataProvider }));
vi.mock('@midnight-ntwrk/midnight-js-level-private-state-provider', () => ({
  levelPrivateStateProvider: vi.fn(() => ({})),
}));
// A class, not an arrow: the builder reaches it with `new`.
vi.mock('@midnight-ntwrk/midnight-js-fetch-zk-config-provider', () => ({
  FetchZkConfigProvider: class {},
}));
vi.mock('@midnight-ntwrk/midnight-js-http-client-proof-provider', () => ({
  httpClientProofProvider: vi.fn(() => ({})),
}));
vi.mock('./walletAdapter', () => ({
  createWalletProvidersFromConnectedAPI: vi.fn(() => ({ walletProvider: {}, midnightProvider: {} })),
}));

import { buildProvidersFromConnectedAPI, type ProviderConnector } from './providers';

const SHIELDED = {
  shieldedAddress: 'mn_shield-addr_test',
  shieldedCoinPublicKey: 'coin-public-key',
  shieldedEncryptionPublicKey: 'encryption-public-key',
};

const configuration = (proverServerUri: string | undefined) => ({
  indexerUri: 'http://localhost:8088/api/v3/graphql',
  indexerWsUri: 'ws://localhost:8088/api/v3/graphql/ws',
  substrateNodeUri: 'ws://localhost:9944',
  networkId: 'undeployed',
  proverServerUri,
});

/** `ProviderConnector` is the five methods the builder uses, so a whole wallet is not needed here. */
const connectorWith = (overrides: Partial<ProviderConnector> = {}): ProviderConnector => ({
  getConfiguration: () => Promise.resolve(configuration('http://localhost:6300')),
  getShieldedAddresses: () => Promise.resolve(SHIELDED),
  getUnshieldedAddress: () => Promise.resolve({ unshieldedAddress: 'mn_addr_test' }),
  balanceUnsealedTransaction: () => Promise.resolve({ tx: '' }),
  submitTransaction: () => Promise.resolve(),
  ...overrides,
});

describe('buildProvidersFromConnectedAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` leaves a queued `mockRejectedValueOnce` in place, so restore the resolving
    // default explicitly — otherwise a rejection staged by one test fires in the next one.
    dispose.mockReset();
    dispose.mockResolvedValue(undefined);
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
  });

  test('releases the indexer connection when the wallet supplies no proof-server URL', async () => {
    const connectedAPI = connectorWith({ getConfiguration: () => Promise.resolve(configuration(undefined)) });

    await expect(buildProvidersFromConnectedAPI(connectedAPI, 'token-transfers')).rejects.toThrow(/proverServerUri/);

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  test('releases the indexer connection when the wallet cannot supply an address', async () => {
    const connectedAPI = connectorWith({
      getShieldedAddresses: () => Promise.reject(new Error('wallet locked')),
    });

    await expect(buildProvidersFromConnectedAPI(connectedAPI, 'token-transfers')).rejects.toThrow('wallet locked');

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  test('keeps the original failure visible when releasing the indexer also fails', async () => {
    dispose.mockRejectedValueOnce(new Error('websocket already closed'));
    const connectedAPI = connectorWith({
      getShieldedAddresses: () => Promise.reject(new Error('wallet locked')),
    });

    await expect(buildProvidersFromConnectedAPI(connectedAPI, 'token-transfers')).rejects.toThrow('wallet locked');
  });

  test('hands back a working provider set without disposing it', async () => {
    const { providers, dispose: bundleDispose } = await buildProvidersFromConnectedAPI(
      connectorWith(),
      'token-transfers'
    );

    expect(providers.publicDataProvider).toBeDefined();
    expect(dispose).not.toHaveBeenCalled();

    await bundleDispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
