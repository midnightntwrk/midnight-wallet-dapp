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

import { createWalletProvidersFromConnectedAPI, hexToUint8Array, uint8ArrayToHex } from './walletAdapter';

const RETAINED_TX_ID = 'retained-tx-id';

// The retained id is read off the transaction bytes by the v8 ledger. Stubbing the deserializer
// keeps this a test of the adapter's ordering rather than of ledger decoding, which would otherwise
// demand a genuinely valid pre-fork transaction.
const { deserializeRetained } = vi.hoisted(() => ({ deserializeRetained: vi.fn() }));

vi.mock('@midnight-ntwrk/midnight-js-protocol/v8', () => ({
  Transaction: { deserialize: deserializeRetained },
}));

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
  test('balances pre-fork bytes through the connector and stays tagged as the retained era', async () => {
    const connector = connectorSpy('0aff');
    const { walletProvider } = buildProviders(connector);
    const txBytes = new Uint8Array([0x01, 0x02]);

    const balanced = await walletProvider.balanceTx({ version: 'v8', txBytes });

    expect(connector.balanceUnsealedTransaction).toHaveBeenCalledWith('0102');
    // The seam hands the balanced bytes back still tagged, so the era survives the round trip.
    expect(balanced).toEqual({ version: 'v8', txBytes: new Uint8Array([0x0a, 0xff]) });
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
    const txBytes = new Uint8Array([0xde, 0xad]);

    const txId = await midnightProvider.submitTx({ version: 'v8', txBytes });

    expect(connector.submitTransaction).toHaveBeenCalledWith('dead');
    expect(txId).toBe(RETAINED_TX_ID);
  });

  test('reads the transaction id before handing the bytes to the wallet', async () => {
    // Ordering is the point: past `submitTransaction` the transaction is gone, so a failure to read
    // the id would otherwise reach the user as a failed submission they should retry.
    deserializeRetained.mockReturnValue({ identifiers: () => [RETAINED_TX_ID] });
    const connector = connectorSpy('');
    const { midnightProvider } = buildProviders(connector);

    await midnightProvider.submitTx({ version: 'v8', txBytes: new Uint8Array([0x01]) });

    expect(deserializeRetained.mock.invocationCallOrder[0]).toBeLessThan(
      connector.submitTransaction.mock.invocationCallOrder[0]
    );
  });
});
