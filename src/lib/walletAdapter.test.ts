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

import { PayloadNotATransactionError } from '@midnight-ntwrk/midnight-js-protocol/errors';
import { LEDGER_TRANSACTION_TAGS } from '@midnight-ntwrk/midnight-js-protocol/version';
import { LedgerTransaction } from '@midnight-ntwrk/midnight-js/types';

import { createWalletProvidersFromConnectedAPI, hexToUint8Array, uint8ArrayToHex } from './walletAdapter';

const RETAINED_TX_ID = 'retained-tx-id';

// The retained id is read off the transaction bytes by the v8 ledger. Stubbing the deserializer
// keeps this a test of the adapter's ordering rather than of ledger decoding, which would otherwise
// demand a genuinely valid pre-fork transaction.
const { deserializeRetained } = vi.hoisted(() => ({ deserializeRetained: vi.fn() }));

vi.mock('@midnight-ntwrk/midnight-js-protocol/v8', () => ({
  Transaction: { deserialize: deserializeRetained },
}));

/**
 * A retained-era handle over `payload`, headed the way the v8 ledger heads a transaction at `stage`.
 * The header is what `LedgerTransaction.fromBytes` checks, so these are handles the providers accept.
 */
const retainedTx = <S extends 'Unbound' | 'Finalized'>(stage: S, payload: number[]) =>
  LedgerTransaction.fromBytes(
    'v8',
    stage,
    new Uint8Array([...new TextEncoder().encode(`${LEDGER_TRANSACTION_TAGS.v8[stage]}:`), ...payload])
  );

const shieldedAddress = {
  shieldedAddress: 'mn_shield-addr_test',
  shieldedCoinPublicKey: 'coin-public-key',
  shieldedEncryptionPublicKey: 'encryption-public-key',
};

/** Only the two connector methods the adapter reaches for; the rest is not exercised here. */
const connectorSpy = (balancedHex: string) => ({
  balanceUnsealedTransaction: vi.fn(() => Promise.resolve({ tx: balancedHex })),
  submitTransaction: vi.fn(() => Promise.resolve()),
});

const buildProviders = (connector: ReturnType<typeof connectorSpy>) =>
  createWalletProvidersFromConnectedAPI(connector, shieldedAddress, 'mn_addr_test');

describe('hex conversion', () => {
  test('round-trips the bytes the connector exchanges', () => {
    const bytes = new Uint8Array([0x00, 0x0f, 0x7a, 0xff]);

    const restored = hexToUint8Array(uint8ArrayToHex(bytes));

    expect(restored).toEqual(bytes);
  });

  test('encodes each byte as two lower-case hex digits', () => {
    const bytes = new Uint8Array([0, 15, 255]);

    const hex = uint8ArrayToHex(bytes);

    expect(hex).toBe('000fff');
  });
});

describe('retained-era wallet provider', () => {
  test('hands the pre-fork bytes to the connector unchanged', async () => {
    const unbound = retainedTx('Unbound', [0x01, 0x02]);
    const connector = connectorSpy(uint8ArrayToHex(retainedTx('Finalized', [0x0a, 0xff]).serialize()));
    const { walletProvider } = buildProviders(connector);

    // Rejects because the framework decodes the wallet's answer with the real v8 ledger, and these
    // bytes carry a valid header over a body no ledger wrote. Asserted rather than worked around:
    // only a genuine pre-fork transaction would get past it, and the forwarding this seam is
    // responsible for has already happened by then.
    await expect(walletProvider.balanceTx(unbound)).rejects.toBeInstanceOf(PayloadNotATransactionError);

    // The retained arm was the one that ran, and it passed the handle's bytes through untouched.
    expect(connector.balanceUnsealedTransaction).toHaveBeenCalledWith(uint8ArrayToHex(unbound.serialize()));
  });
});

describe('retained-era midnight provider', () => {
  beforeEach(() => {
    deserializeRetained.mockReset();
  });

  test('submits pre-fork bytes and answers with the transaction id', async () => {
    deserializeRetained.mockReturnValue({ identifiers: () => [RETAINED_TX_ID] });
    const connector = connectorSpy('');
    const { midnightProvider } = buildProviders(connector);
    const tx = retainedTx('Finalized', [0xde, 0xad]);

    const txId = await midnightProvider.submitTx(tx);

    expect(connector.submitTransaction).toHaveBeenCalledWith(uint8ArrayToHex(tx.serialize()));
    expect(txId).toBe(RETAINED_TX_ID);
  });

  test('reads the transaction id before handing the bytes to the wallet', async () => {
    // Ordering is the point: past `submitTransaction` the transaction is gone, so a failure to read
    // the id would otherwise reach the user as a failed submission they should retry.
    deserializeRetained.mockReturnValue({ identifiers: () => [RETAINED_TX_ID] });
    const connector = connectorSpy('');
    const { midnightProvider } = buildProviders(connector);

    await midnightProvider.submitTx(retainedTx('Finalized', [0x01]));

    expect(deserializeRetained.mock.invocationCallOrder[0]).toBeLessThan(
      connector.submitTransaction.mock.invocationCallOrder[0]
    );
  });
});
