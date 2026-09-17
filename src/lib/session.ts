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
  type PipelineEra,
} from '@midnight-ntwrk/midnight-js/contracts';
import type { ConnectedAPI } from '@midnightntwrk/dapp-connector-api';

import { buildProvidersFromConnectedAPI, type ProviderBundle } from './providers';
import {
  CompiledDemoContract,
  createRetainedContractInstance,
  type DemoCircuits,
  type DemoContract,
  type RetainedCircuits,
  type RetainedContract,
} from './types';

const CURRENT_ARTIFACT = 'token-transfers';
const RETAINED_ARTIFACT = 'token-transfers-v8';

/**
 * Which toolchain built the contract being called.
 *
 * A property of the CONTRACT, not of the network: one deployed before the fork is called with the
 * retained artifact for the rest of its life, the boundary included. Which pipeline runs underneath
 * is decided by the network head, and that is the framework's business rather than ours.
 *
 * Aliased from the framework rather than re-declared, so a new era cannot arrive without this dApp
 * failing to compile.
 */
export type ContractEra = PipelineEra;

/**
 * A contract handle of either era.
 *
 * Both eras publish `callTx` as one typed method per circuit, and both twins are built from the
 * same source, so the union is callable directly — `handle.callTx.mintAndReceive(amount)` type-checks
 * against both arms at once. That is what keeps the era out of every call site.
 */
export type ContractHandle = FoundContract<DemoContract> | Ledger8.FoundContract<RetainedContract>;

/**
 * The era is read off `handle.era`, which the framework already tags; a second copy could drift.
 * `dispose` releases the indexer WebSocket the provider set owns.
 */
export type ContractSession = {
  readonly handle: ContractHandle;
  readonly dispose: () => Promise<void>;
};

const currentEraProviders = (connectedAPI: ConnectedAPI): Promise<ProviderBundle<DemoCircuits>> =>
  buildProvidersFromConnectedAPI<DemoCircuits>(connectedAPI, CURRENT_ARTIFACT);

// `require-if-present`: compactc 0.31.1 emits no `contract-manifest.json`, and verification reads
// exactly that file, so the fail-closed default refuses every pre-fork artifact. This mode skips the
// check when there is no manifest, but still fails on one that does not certify the artifact.
const retainedEraProviders = (connectedAPI: ConnectedAPI): Promise<ProviderBundle<RetainedCircuits>> =>
  buildProvidersFromConnectedAPI<RetainedCircuits>(connectedAPI, RETAINED_ARTIFACT, 'require-if-present');

/** Opens a contract with an already-built provider set, releasing it if opening fails. */
async function withCleanup(
  dispose: () => Promise<void>,
  open: () => Promise<ContractHandle>
): Promise<ContractSession> {
  try {
    return { handle: await open(), dispose };
  } catch (error) {
    // The indexer socket is already open; a failed deploy or join must not leak it. Releasing it is
    // reported but never rethrown: the error worth surfacing is the one that explains why the open
    // failed, and an unguarded `await` here would replace it with a teardown error instead.
    await dispose().catch((disposeError: unknown) => {
      console.error('[session] could not release the providers after a failed open', disposeError);
    });
    throw error;
  }
}

/**
 * Refuses an era this dApp carries no artifact for.
 *
 * Typed `never`, so a third `PipelineEra` member arriving upstream fails to compile here rather than
 * falling through to the retained branch and deploying a pre-fork contract under a new era's name.
 */
function unsupportedEra(era: never): Error {
  return new Error(
    `No compiled artifact for contract era "${String(era)}". Each era needs its own build of the ` +
      'contract, so a new era needs a new artifact before it can be deployed or joined.'
  );
}

/**
 * The provider set is never handed back to the caller alongside a separate era value. Pairing the
 * two at a call site is what would let a ledger-9 set open a ledger-8 contract, and structural
 * typing does not reject that pairing — a ledger-9 set satisfies the ledger-8 provider type.
 * Building and using them inside one branch removes the opportunity entirely.
 */
export async function deploySessionContract(connectedAPI: ConnectedAPI, era: ContractEra): Promise<ContractSession> {
  if (era === 'ledger9') {
    const { providers, dispose } = await currentEraProviders(connectedAPI);
    return withCleanup(dispose, () => deployContract(providers, { compiledContract: CompiledDemoContract }));
  }
  if (era === 'ledger8') {
    const { providers, dispose } = await retainedEraProviders(connectedAPI);
    return withCleanup(dispose, () =>
      deployContract(providers, { compiledContract: createRetainedContractInstance() })
    );
  }
  throw unsupportedEra(era);
}

export async function joinSessionContract(
  connectedAPI: ConnectedAPI,
  era: ContractEra,
  contractAddress: string
): Promise<ContractSession> {
  if (era === 'ledger9') {
    const { providers, dispose } = await currentEraProviders(connectedAPI);
    return withCleanup(dispose, () =>
      findDeployedContract(providers, { compiledContract: CompiledDemoContract, contractAddress })
    );
  }
  if (era === 'ledger8') {
    const { providers, dispose } = await retainedEraProviders(connectedAPI);
    return withCleanup(dispose, () =>
      findDeployedContract(providers, { compiledContract: createRetainedContractInstance(), contractAddress })
    );
  }
  throw unsupportedEra(era);
}
