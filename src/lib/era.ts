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

// The `/version` subpath rather than the package root: the root pulls in the ledger WASM at module
// scope, and nothing here needs it.
import {
  protocolVersionToLedger,
  type LedgerVersion,
  type ProtocolVersionSource,
} from '@midnight-ntwrk/midnight-js-protocol/version';

export type NetworkEra = {
  readonly ledgerVersion: LedgerVersion;
  readonly protocolVersion: number;
};

/**
 * Which side of the ledger fork the network head is on.
 *
 * One read, one mapping: `ledgerVersion` is derived from the `protocolVersion` returned beside it,
 * so the two cannot disagree if the head advances mid-read. `protocolVersionToLedger` raises on a
 * version this client cannot place rather than silently treating it as current.
 */
export async function readNetworkEra(source: ProtocolVersionSource): Promise<NetworkEra> {
  const protocolVersion = await source.queryLatestProtocolVersion();
  return { ledgerVersion: protocolVersionToLedger(protocolVersion, 'construct'), protocolVersion };
}
