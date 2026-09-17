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

import { networkHeadVersion } from '@midnight-ntwrk/midnight-js-protocol';
import type { LedgerVersion } from '@midnight-ntwrk/midnight-js-protocol/version';
import type { PublicDataProvider } from '@midnight-ntwrk/midnight-js/types';

export type NetworkEra = {
  readonly ledgerVersion: LedgerVersion;
  readonly protocolVersion: number;
};

/**
 * Which side of the ledger fork the network head is on.
 *
 * Read on every call rather than cached: the answer is wrong exactly at the boundary, which is
 * where it matters. `networkHeadVersion` maps the protocol version onto the era timeline, so a
 * version this client cannot place raises rather than being silently treated as current.
 */
export async function readNetworkEra(publicDataProvider: PublicDataProvider): Promise<NetworkEra> {
  const [ledgerVersion, protocolVersion] = await Promise.all([
    networkHeadVersion(publicDataProvider),
    publicDataProvider.queryLatestProtocolVersion(),
  ]);
  return { ledgerVersion, protocolVersion };
}
