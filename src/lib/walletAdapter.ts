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
  createMidnightProviderFromArms,
  createWalletProviderFromArms,
  UnboundTransaction,
} from '@midnight-ntwrk/midnight-js/types';
import {
  Binding,
  CoinPublicKey,
  EncPublicKey,
  FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
} from '@midnightntwrk/ledger-v9';
import type { ConnectedAPI } from '@midnightntwrk/dapp-connector-api';
import { ShieldedAddress } from './providers';

/**
 * The transaction identifier of a retained-era transaction.
 *
 * The connector answers `submitTransaction` with nothing, so the id has to come from the bytes.
 * Reading them needs the retained ledger, which is acquired here rather than imported at module
 * scope so a session that never crosses the fork never pays for it.
 */
async function retainedTransactionId(txBytes: Uint8Array): Promise<string> {
  const { Transaction: RetainedTransaction } = await import('@midnight-ntwrk/midnight-js-protocol/v8');
  const [txId] = RetainedTransaction.deserialize('signature', 'proof', 'binding', txBytes).identifiers();
  if (txId === undefined) {
    throw new Error('The retained-era transaction carries no identifier, so it cannot be tracked once submitted.');
  }
  return txId;
}

/** Logs the seam a failure came from before rethrowing; without it a rejected arm is anonymous. */
function traced<A extends unknown[], R>(seam: string, fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`[WalletAdapter] ${seam}: failed`, error);
      throw error;
    }
  };
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToUint8Array(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/, '');
  const matches = cleaned.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

export function createWalletProvidersFromConnectedAPI(
  // Narrowed to the two methods the seams actually reach for, so the dependency is honest and a
  // caller (or a test) need not stand up a whole connector.
  connectedAPI: Pick<ConnectedAPI, 'balanceUnsealedTransaction' | 'submitTransaction'>,
  shieldedAddress: ShieldedAddress,
  unshieldedAddress: string
) {
  console.log('[WalletAdapter] Creating wallet providers for', shieldedAddress.shieldedAddress, unshieldedAddress);

  const walletProvider = createWalletProviderFromArms({
    getCoinPublicKey(): CoinPublicKey {
      return shieldedAddress.shieldedCoinPublicKey;
    },
    getEncryptionPublicKey(): EncPublicKey {
      return shieldedAddress.shieldedEncryptionPublicKey;
    },
    currentEra: traced('balanceTx', async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
      const serializedStr = uint8ArrayToHex(tx.serialize());
      console.log('[WalletAdapter] balanceTx: balancing, hex length:', serializedStr.length);

      const result = await connectedAPI.balanceUnsealedTransaction(serializedStr);
      const resultBytes = hexToUint8Array(result.tx);
      console.log('[WalletAdapter] balanceTx: wallet returned bytes:', resultBytes.length);

      return Transaction.deserialize('signature', 'proof', 'binding', resultBytes) as Transaction<
        SignatureEnabled,
        Proof,
        Binding
      >;
    }),
    // The retained arm never builds a ledger object: bytes go to the wallet and bytes come back.
    // Which era the wallet deserializes them as follows from the protocol version of the chain it
    // is on, so the connector needs no era parameter and offers none.
    retainedEras: {
      v8: traced('balanceTx(v8)', async (txBytes: Uint8Array): Promise<Uint8Array> => {
        console.log('[WalletAdapter] balanceTx(v8): balancing retained-era bytes:', txBytes.length);
        const result = await connectedAPI.balanceUnsealedTransaction(uint8ArrayToHex(txBytes));
        return hexToUint8Array(result.tx);
      }),
    },
  });

  const midnightProvider = createMidnightProviderFromArms({
    currentEra: traced('submitTx', async (tx: FinalizedTransaction): Promise<string> => {
      // Read the id before submitting: past that call the transaction is on its way, and a failure
      // here would otherwise be reported to the user as a failed submission they should retry.
      const [txId] = tx.identifiers();
      if (txId === undefined) {
        throw new Error('The transaction carries no identifier, so it cannot be tracked once submitted.');
      }

      await connectedAPI.submitTransaction(uint8ArrayToHex(tx.serialize()));
      console.log('[WalletAdapter] submitTx: submitted', txId);
      return txId;
    }),
    retainedEras: {
      v8: traced('submitTx(v8)', async (txBytes: Uint8Array): Promise<string> => {
        // Same ordering as the current era, and for the same reason: deserializing these bytes can
        // fail, and after `submitTransaction` that failure is no longer the caller's to retry.
        const txId = await retainedTransactionId(txBytes);

        await connectedAPI.submitTransaction(uint8ArrayToHex(txBytes));
        console.log('[WalletAdapter] submitTx(v8): submitted', txId);
        return txId;
      }),
    },
  });

  return { walletProvider, midnightProvider };
}
