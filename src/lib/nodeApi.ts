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

import { ApiPromise, WsProvider } from '@polkadot/api';
import type { DefinitionRpc } from '@polkadot/types/types';

/**
 * Direct access to the Substrate node, bypassing both the wallet and the indexer.
 *
 * The wallet hands us `Configuration.substrateNodeUri` and until now nothing consumed
 * it, so a wallet could advertise a dead, firewalled or wrong-network node and no dapp
 * would notice. Everything here exists to make that field load-bearing.
 */

/** Custom RPCs this node exposes beyond the standard Substrate set. */
const MIDNIGHT_RPC: Record<string, Record<string, DefinitionRpc>> = {
  midnight: {
    ledgerVersion: {
      description: 'Ledger implementation version active at the given block',
      params: [{ name: 'at', type: 'BlockHash', isOptional: true }],
      type: 'Text',
    },
    apiVersions: {
      description: 'Supported midnight RPC API versions',
      params: [],
      type: 'Vec<u32>',
    },
  },
};

/**
 * `api.rpc.midnight.*` is built at runtime from MIDNIGHT_RPC, but `RpcInterface` is a
 * static type that knows nothing about it. Narrow it here rather than augmenting the
 * `@polkadot/rpc-core` module globally - the cast is local, visible, and cannot
 * silently mistype anything else.
 */
interface MidnightRpc {
  ledgerVersion(): Promise<{ toString(): string }>;
  apiVersions(): Promise<{ toJSON(): unknown }>;
}

/**
 * `WsProvider` needs `ws(s)://`, but the connector may advertise either scheme -
 * the e2e mock says `http://localhost:9944`. Substrate serves JSON-RPC over both on
 * one port, so translate rather than demanding the wallet pick our favourite.
 */
export function toWsUri(uri: string): string {
  return uri.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
}

export interface NodeInfo {
  chain: string;
  nodeName: string;
  nodeVersion: string;
  peers: number;
  finalizedHeight: bigint;
  finalizedHash: string;
  ledgerVersion: string | null;
  apiVersions: number[] | null;
  genesisHash: string;
  specName: string;
  specVersion: number;
}

/**
 * Connect, read everything in one go, disconnect.
 *
 * Deliberately not a long-lived connection: this is a probe, and a probe that leaks a
 * reconnecting socket would keep "succeeding" after the node it is reporting on has died.
 * `autoConnectMs: false` disables the retry loop for the same reason - an unreachable
 * node must surface as an error, not as an infinite spinner.
 */
export async function fetchNodeInfo(substrateNodeUri: string, timeoutMs = 15_000): Promise<NodeInfo> {
  const provider = new WsProvider(toWsUri(substrateNodeUri), false);
  let api: ApiPromise | undefined;

  try {
    await withTimeout(provider.connect(), timeoutMs, 'connect');
    api = await withTimeout(
      ApiPromise.create({ provider, rpc: MIDNIGHT_RPC, throwOnConnect: true, noInitWarn: true }),
      timeoutMs,
      'metadata handshake'
    );

    const [chain, nodeName, nodeVersion, health, finalizedHash] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version(),
      api.rpc.system.health(),
      api.rpc.chain.getFinalizedHead(),
    ]);

    const header = await api.rpc.chain.getHeader(finalizedHash);

    // The midnight_* methods are version-gated, so treat them as optional detail
    // rather than letting an older node fail the whole probe.
    const midnight = (api.rpc as unknown as { midnight: MidnightRpc }).midnight;
    const [ledgerVersion, apiVersions] = await Promise.all([
      optional(async () => (await midnight.ledgerVersion()).toString()),
      optional(async () => (await midnight.apiVersions()).toJSON() as number[]),
    ]);

    return {
      chain: chain.toString(),
      nodeName: nodeName.toString(),
      nodeVersion: nodeVersion.toString(),
      peers: health.peers.toNumber(),
      finalizedHeight: header.number.toBigInt(),
      finalizedHash: finalizedHash.toHex(),
      ledgerVersion,
      apiVersions,
      genesisHash: api.genesisHash.toHex(),
      specName: api.runtimeVersion.specName.toString(),
      specVersion: api.runtimeVersion.specVersion.toNumber(),
    };
  } finally {
    // Order matters: disconnecting the api also tears down the provider, but if the
    // api never got built we still own the socket.
    if (api) await api.disconnect().catch(() => undefined);
    else await provider.disconnect().catch(() => undefined);
  }
}

async function optional<T>(f: () => Promise<T>): Promise<T | null> {
  try {
    return await f();
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
    p.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
