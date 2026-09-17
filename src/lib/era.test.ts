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

import { describe, expect, test } from 'vitest';

import { readNetworkEra } from './era';

/** `ProtocolVersionSource` is a single method, so the head can be stood up without a chain. */
const headAt = (protocolVersion: number) => ({
  queryLatestProtocolVersion: () => Promise.resolve(protocolVersion),
});

describe('readNetworkEra', () => {
  test('reports the retained era for a pre-fork head', async () => {
    const source = headAt(1_000_000);

    const era = await readNetworkEra(source);

    expect(era).toEqual({ ledgerVersion: 'v8', protocolVersion: 1_000_000 });
  });

  test('reports the current era for a post-fork head', async () => {
    const source = headAt(2_001_000);

    const era = await readNetworkEra(source);

    expect(era).toEqual({ ledgerVersion: 'v9', protocolVersion: 2_001_000 });
  });

  test('derives the ledger version from the protocol version it returns', async () => {
    const source = headAt(1_999_999);

    const era = await readNetworkEra(source);

    expect(era.ledgerVersion).toBe('v8');
    expect(era.protocolVersion).toBe(1_999_999);
  });
});
