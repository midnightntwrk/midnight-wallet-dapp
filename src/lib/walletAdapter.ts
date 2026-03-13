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

import {
  ProofProvider,
  UnboundTransaction,
  WalletProvider,
  type ZKConfigProvider,
} from '@midnight-ntwrk/midnight-js-types';
import {
  Binding,
  CoinPublicKey,
  EncPublicKey,
  FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
} from '@midnight-ntwrk/ledger-v8';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { ShieldedAddress } from './providers';

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
  connectedAPI: ConnectedAPI,
  proofProvider: ProofProvider,
  zkConfigProvider: ZKConfigProvider<string>,
  shieldedAddress: ShieldedAddress,
  unshieldedAddress: string
) {
  console.log('[WalletAdapter] Creating wallet providers');
  console.log('[WalletAdapter] Shielded address:', shieldedAddress.shieldedAddress);
  console.log('[WalletAdapter] Unshielded address:', unshieldedAddress);

  const walletProvider: WalletProvider = {
    getCoinPublicKey(): CoinPublicKey {
      console.log('[WalletAdapter] getCoinPublicKey called');
      return shieldedAddress.shieldedCoinPublicKey;
    },
    getEncryptionPublicKey(): EncPublicKey {
      console.log('[WalletAdapter] getEncryptionPublicKey called');
      return shieldedAddress.shieldedEncryptionPublicKey;
    },
    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      try {
        console.log('[WalletAdapter] balanceTx: Starting transaction balancing');

        console.log('[WalletAdapter] balanceTx: Serializing unsealed transaction');
        const serialized = tx.serialize();
        console.log('[WalletAdapter] balanceTx: Serialized transaction length:', serialized.length);

        const serializedStr = uint8ArrayToHex(serialized);
        console.log(`[WalletAdapter] balanceTx: Converted to hex string length: ${serializedStr.length}`);
        console.log(`[WalletAdapter] balanceTx: Converted to hex string beginning128=[${serializedStr.slice(0, 128)}]`);
        console.log(
          `[WalletAdapter] balanceTx: as String first 128 chars: ${new TextDecoder().decode(tx.serialize()).slice(0, 128)}]`
        );
        console.log(`[WalletAdapter] balanceTx: toString: ${tx.toString()}]`);

        console.log('[WalletAdapter] balanceTx: Balancing with wallet');
        const result = await connectedAPI.balanceUnsealedTransaction(serializedStr);

        console.log(`[WalletAdapter] balanceTx: toString: ${result.toString()}]`);

        console.log('[WalletAdapter] balanceTx: Received response from wallet, tx string length:', result.tx.length);

        console.log('[WalletAdapter] balanceTx: Deserializing balanced transaction');
        const resultBytes = hexToUint8Array(result.tx);
        console.log('[WalletAdapter] balanceTx: Converted response to Uint8Array length:', resultBytes.length);

        console.log('[WalletAdapter] balanceTx: Deserializing transaction');
        const deserializedTx = Transaction.deserialize('signature', 'proof', 'binding', resultBytes) as Transaction<
          SignatureEnabled,
          Proof,
          Binding
        >;
        console.log('[WalletAdapter] balanceTx: Successfully deserialized transaction');

        return deserializedTx;
      } catch (error) {
        console.error('[WalletAdapter] balanceTx: Error during transaction balancing:', error);
        throw error;
      }
    },
  };

  const midnightProvider = {
    async submitTx(tx: FinalizedTransaction): Promise<string> {
      try {
        console.log('[WalletAdapter] submitTx: Starting transaction submission');
        const serialized = tx.serialize();
        console.log('[WalletAdapter] submitTx: Serialized transaction length:', serialized.length);

        const serializedStr = uint8ArrayToHex(serialized);
        console.log('[WalletAdapter] submitTx: Converted to hex string length:', serializedStr.length);

        console.log(`[WalletAdapter] submitTx: Submitting transaction to wallet: ${tx.toString()}`);
        await connectedAPI.submitTransaction(serializedStr);
        console.log('[WalletAdapter] submitTx: Transaction submitted successfully to wallet');

        const txId = tx.identifiers()[0];
        console.log('[WalletAdapter] submitTx: Transaction ID:', txId);

        return txId;
      } catch (error) {
        console.error('[WalletAdapter] submitTx: Error during transaction submission:', error);
        throw error;
      }
    },
  };

  return { walletProvider, midnightProvider };
}
