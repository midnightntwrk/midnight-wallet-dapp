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
import { CompiledContract } from '@midnight-ntwrk/compact-js';

import * as CompiledOutput from '../contract/index';
import { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { ImpureCircuitId } from '@midnight-ntwrk/compact-js';

export type DemoContract = CompiledOutput.Contract<undefined>;

export type DemoCircuits = ImpureCircuitId<DemoContract>;

export type DemoProviders = MidnightProviders<DemoCircuits>;

export const createSimpleContractInstance = (): DemoContract => new CompiledOutput.Contract({});

export const CompiledDemoContract = CompiledContract.make<DemoContract>(
  'UnshieldedDemo',
  CompiledOutput.Contract<undefined>
).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets('./contract/build/unshielded-demo')
);
