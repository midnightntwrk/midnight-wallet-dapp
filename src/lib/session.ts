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

import {
  deployContract,
  findDeployedContract,
  Ledger8,
  type FoundContract,
} from '@midnight-ntwrk/midnight-js/contracts';
import type { ConnectedAPI } from '@midnightntwrk/dapp-connector-api';

import { buildProvidersFromConnectedAPI } from './providers';
import {
  CompiledDemoContract,
  createRetainedContractInstance,
  type DemoCircuits,
  type DemoContract,
  type DemoProviders,
  type RetainedCircuits,
  type RetainedContract,
  type RetainedProviders,
} from './types';

const CURRENT_ARTIFACT = 'token-transfers';
const RETAINED_ARTIFACT = 'token-transfers-v8';

/**
 * Which toolchain built the contract being called.
 *
 * A property of the CONTRACT, not of the network: one deployed before the fork is called with the
 * retained artifact for the rest of its life, the boundary included. Which pipeline runs underneath
 * is decided by the network head, and that is the framework's business rather than ours.
 */
export type ContractEra = 'ledger9' | 'ledger8';

/**
 * A contract handle of either era.
 *
 * Both eras publish `callTx` as one typed method per circuit, and both twins are built from the
 * same source, so the union is callable directly — `handle.callTx.mintAndReceive(amount)` type-checks
 * against both arms at once. That is what keeps the era out of every call site.
 */
export type ContractHandle = FoundContract<DemoContract> | Ledger8.FoundContract<RetainedContract>;

export type ContractSession = {
  readonly era: ContractEra;
  readonly providers: DemoProviders | RetainedProviders;
  readonly handle: ContractHandle;
};

export const buildSessionProviders = async (connectedAPI: ConnectedAPI, era: ContractEra) =>
  era === 'ledger9'
    ? await buildProvidersFromConnectedAPI<DemoCircuits>(connectedAPI, CURRENT_ARTIFACT)
    : // `warn`: compactc 0.31.1 emits no `contract-manifest.json`, and integrity verification reads
      // exactly that file, so the fail-closed default refuses every pre-fork artifact.
      await buildProvidersFromConnectedAPI<RetainedCircuits>(connectedAPI, RETAINED_ARTIFACT, 'warn');

export async function deploySessionContract(
  providers: DemoProviders | RetainedProviders,
  era: ContractEra
): Promise<ContractSession> {
  const handle =
    era === 'ledger9'
      ? await deployContract(providers as DemoProviders, { compiledContract: CompiledDemoContract })
      : await deployContract(providers as RetainedProviders, { compiledContract: createRetainedContractInstance() });
  return { era, providers, handle };
}

export async function joinSessionContract(
  providers: DemoProviders | RetainedProviders,
  era: ContractEra,
  contractAddress: string
): Promise<ContractSession> {
  const handle =
    era === 'ledger9'
      ? await findDeployedContract(providers as DemoProviders, {
          compiledContract: CompiledDemoContract,
          contractAddress,
        })
      : await findDeployedContract(providers as RetainedProviders, {
          compiledContract: createRetainedContractInstance(),
          contractAddress,
        });
  return { era, providers, handle };
}
