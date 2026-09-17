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
import type { ConnectedAPI } from '@midnightntwrk/dapp-connector-api';

const { buildProviders, deployContract, findDeployedContract, dispose } = vi.hoisted(() => ({
  buildProviders: vi.fn(),
  deployContract: vi.fn(),
  findDeployedContract: vi.fn(),
  dispose: vi.fn(() => Promise.resolve()),
}));

vi.mock('./providers', () => ({ buildProvidersFromConnectedAPI: buildProviders }));

vi.mock('@midnight-ntwrk/midnight-js/contracts', () => ({
  deployContract,
  findDeployedContract,
  Ledger8: {},
}));

// The real module loads both compiled artifacts, which pull in the Compact runtime WASM. The era
// dispatch only forwards these values, so their identity is all that matters here.
vi.mock('./types', () => ({
  CompiledDemoContract: { marker: 'current' },
  createRetainedContractInstance: () => ({ marker: 'retained' }),
}));

import { deploySessionContract, joinSessionContract, type ContractEra } from './session';

// The dispatch forwards the connector untouched to the mocked provider factory, so it is never read.
const connectedAPI = {} as ConnectedAPI;
const CONTRACT_ADDRESS = '0200aabb';

/** The only way to reach the defensive branch: `ContractEra` has no third member to pass honestly. */
const UNKNOWN_ERA = 'ledger10' as ContractEra;

describe('era dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildProviders.mockResolvedValue({ providers: { marker: 'providers' }, dispose });
    deployContract.mockResolvedValue({ era: 'ledger9', contractAddress: CONTRACT_ADDRESS });
    findDeployedContract.mockResolvedValue({ era: 'ledger9', contractAddress: CONTRACT_ADDRESS });
  });

  test('deploys the current era against the current artifact', async () => {
    await deploySessionContract(connectedAPI, 'ledger9');

    expect(buildProviders).toHaveBeenCalledWith(connectedAPI, 'token-transfers');
  });

  test('deploys the retained era against the pre-fork artifact, waiving the absent manifest', async () => {
    await deploySessionContract(connectedAPI, 'ledger8');

    expect(buildProviders).toHaveBeenCalledWith(connectedAPI, 'token-transfers-v8', 'require-if-present');
  });

  test('refuses an era it cannot place rather than deploying the pre-fork artifact', async () => {
    await expect(deploySessionContract(connectedAPI, UNKNOWN_ERA)).rejects.toThrow(/ledger10/);

    expect(deployContract).not.toHaveBeenCalled();
  });

  test('refuses an era it cannot place rather than joining through the pre-fork artifact', async () => {
    await expect(joinSessionContract(connectedAPI, UNKNOWN_ERA, CONTRACT_ADDRESS)).rejects.toThrow(/ledger10/);

    expect(findDeployedContract).not.toHaveBeenCalled();
  });
});

describe('provider cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` leaves a queued `mockRejectedValueOnce` in place, so restore the resolving
    // default explicitly — otherwise a rejection staged by one test fires in the next one.
    dispose.mockReset();
    dispose.mockResolvedValue(undefined);
    buildProviders.mockResolvedValue({ providers: { marker: 'providers' }, dispose });
  });

  test('releases the providers when a deploy fails, and reports why the deploy failed', async () => {
    deployContract.mockRejectedValue(new Error('proof server unreachable'));

    await expect(deploySessionContract(connectedAPI, 'ledger9')).rejects.toThrow('proof server unreachable');

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  test('keeps the join failure visible when releasing the providers also fails', async () => {
    findDeployedContract.mockRejectedValue(new Error('contract address not found'));
    dispose.mockRejectedValueOnce(new Error('websocket already closed'));

    await expect(joinSessionContract(connectedAPI, 'ledger9', CONTRACT_ADDRESS)).rejects.toThrow(
      'contract address not found'
    );
  });
});
