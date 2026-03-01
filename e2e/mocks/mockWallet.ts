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

interface MockConnectedAPI {
  getConfiguration: () => Promise<{
    networkId: string;
    indexerUri: string;
    indexerWsUri: string;
    proverServerUri: string;
    substrateNodeUri: string;
  }>;
  getShieldedAddresses: () => Promise<{
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }>;
  getUnshieldedAddress: () => Promise<{ unshieldedAddress: string }>;
  getShieldedBalances: () => Promise<Record<string, bigint>>;
  getUnshieldedBalances: () => Promise<Record<string, bigint>>;
  getDustBalance: () => Promise<{ balance: bigint; cap: bigint }>;
  balanceUnsealedTransaction: (hexTx: string) => Promise<string>;
  submitTransaction: (hexTx: string) => Promise<string>;
}

interface MockInitialAPI {
  name: string;
  icon: string;
  apiVersion: string;
  connect: (networkId: string) => Promise<MockConnectedAPI>;
}

export function createMockWallet(): MockInitialAPI {
  return {
    name: 'Mock Wallet',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50%" font-size="80">🧪</text></svg>',
    apiVersion: '1.0.0',
    connect: async (networkId: string): Promise<MockConnectedAPI> => {
      return {
        getConfiguration: async () => ({
          networkId,
          indexerUri: 'http://localhost:8088/api/v1/graphql',
          indexerWsUri: 'ws://localhost:8088/api/v1/graphql/ws',
          proverServerUri: 'http://localhost:6300',
          substrateNodeUri: 'http://localhost:9944',
        }),
        getShieldedAddresses: async () => ({
          shieldedCoinPublicKey: '0x' + '00'.repeat(32),
          shieldedEncryptionPublicKey: '0x' + '00'.repeat(32),
        }),
        getUnshieldedAddress: async () => ({
          unshieldedAddress:
            'addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs68faae',
        }),
        getShieldedBalances: async () => ({
          tNIGHT: 1000000n,
        }),
        getUnshieldedBalances: async () => ({
          tNIGHT: 500000n,
        }),
        getDustBalance: async () => ({
          balance: 100000n,
          cap: 1000000n,
        }),
        balanceUnsealedTransaction: async (hexTx: string) => hexTx,
        submitTransaction: async () => '0x' + 'ab'.repeat(32),
      };
    },
  };
}

export function injectMockWalletScript(): string {
  return `
    window.midnight = window.midnight || {};
    window.midnight.mockWallet = {
      name: 'Mock Wallet',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50%" font-size="80">🧪</text></svg>',
      apiVersion: '1.0.0',
      connect: async (networkId) => ({
        getConfiguration: async () => ({
          networkId,
          indexerUri: 'http://localhost:8088/api/v1/graphql',
          indexerWsUri: 'ws://localhost:8088/api/v1/graphql/ws',
          proverServerUri: 'http://localhost:6300',
          substrateNodeUri: 'http://localhost:9944',
        }),
        getShieldedAddresses: async () => ({
          shieldedCoinPublicKey: '0x' + '00'.repeat(32),
          shieldedEncryptionPublicKey: '0x' + '00'.repeat(32),
        }),
        getUnshieldedAddress: async () => ({
          unshieldedAddress: 'addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs68faae',
        }),
        getShieldedBalances: async () => ({
          tNIGHT: 1000000n,
        }),
        getUnshieldedBalances: async () => ({
          tNIGHT: 500000n,
        }),
        getDustBalance: async () => ({
          balance: 100000n,
          cap: 1000000n,
        }),
        balanceUnsealedTransaction: async (hexTx) => hexTx,
        submitTransaction: async () => '0x' + 'ab'.repeat(32),
      }),
    };
  `;
}
