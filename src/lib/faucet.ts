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

import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import {
  PublicKey,
  createKeystore,
  UnshieldedWallet,
  InMemoryTransactionHistoryStorage,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import * as Rx from 'rxjs';

// This is a well-known, PUBLIC seed used only for the local "undeployed" testnet.
// It is NOT secret — anyone can derive its keys. Never fund this seed on a public network.
const FAUCET_SEED = '0000000000000000000000000000000000000000000000000000000000000002';

const getShieldedSeed = (seed: string): Uint8Array => {
  const seedBuffer = Buffer.from(seed, 'hex');
  const hdWalletResult = HDWallet.fromSeed(seedBuffer);

  const { hdWallet } = hdWalletResult as {
    type: 'seedOk';
    hdWallet: HDWallet;
  };

  const derivationResult = hdWallet.selectAccount(0).selectRole(Roles.Zswap).deriveKeyAt(0);

  if (derivationResult.type === 'keyOutOfBounds') {
    throw new Error('Key derivation out of bounds');
  }

  return Buffer.from(derivationResult.key);
};

const getUnshieldedSeed = (seed: string): Uint8Array => {
  const seedBuffer = Buffer.from(seed, 'hex');
  const hdWalletResult = HDWallet.fromSeed(seedBuffer);

  const { hdWallet } = hdWalletResult as {
    type: 'seedOk';
    hdWallet: HDWallet;
  };

  const derivationResult = hdWallet.selectAccount(0).selectRole(Roles.NightExternal).deriveKeyAt(0);

  if (derivationResult.type === 'keyOutOfBounds') {
    throw new Error('Key derivation out of bounds');
  }

  return derivationResult.key;
};

const getDustSeed = (seed: string): Uint8Array => {
  const seedBuffer = Buffer.from(seed, 'hex');
  const hdWalletResult = HDWallet.fromSeed(seedBuffer);

  const { hdWallet } = hdWalletResult as {
    type: 'seedOk';
    hdWallet: HDWallet;
  };

  const derivationResult = hdWallet.selectAccount(0).selectRole(Roles.Dust).deriveKeyAt(0);

  if (derivationResult.type === 'keyOutOfBounds') {
    throw new Error('Key derivation out of bounds');
  }

  return derivationResult.key;
};

const tokenValue = (value: bigint): bigint => value * 10n ** 6n;

const waitForFullySynced = async (facade: WalletFacade): Promise<void> => {
  await Rx.firstValueFrom(facade.state().pipe(Rx.filter((s) => s.isSynced)));
};

export async function transferUnshieldedFromFaucet(
  receiverUnshieldedAddress: string,
  amount: bigint,
  indexerUri: string,
  indexerWsUri: string,
  proverServerUri: string,
  nodeWsUrl: string
): Promise<string> {
  const faucetShieldedSeed = getShieldedSeed(FAUCET_SEED);
  const faucetUnshieldedSeed = getUnshieldedSeed(FAUCET_SEED);
  const faucetDustSeed = getDustSeed(FAUCET_SEED);

  const configuration = {
    indexerClientConnection: {
      indexerHttpUrl: indexerUri,
      indexerWsUrl: indexerWsUri,
    },
    provingServerUrl: new URL(proverServerUri),
    relayURL: new URL(nodeWsUrl),
    networkId: NetworkId.NetworkId.Undeployed,
  };
  console.log('transferUnshieldedFromFaucet: configuration=', configuration);

  const Shielded = ShieldedWallet(configuration);
  const faucetShielded = Shielded.startWithSeed(faucetShieldedSeed);

  const Dust = DustWallet({
    ...configuration,
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
  });
  const dustParameters = ledger.LedgerParameters.initialParameters().dust;
  const faucetDust = Dust.startWithSeed(faucetDustSeed, dustParameters);

  const faucetUnshieldedKeystore = createKeystore(faucetUnshieldedSeed, NetworkId.NetworkId.Undeployed);
  const faucetUnshielded = UnshieldedWallet({
    ...configuration,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  }).startWithPublicKey(PublicKey.fromKeyStore(faucetUnshieldedKeystore));

  const faucetFacade = await WalletFacade.init({
    configuration: {
      ...configuration,
      txHistoryStorage: new InMemoryTransactionHistoryStorage(),
      costParameters: {
        additionalFeeOverhead: 300_000_000_000_000n,
        feeBlocksMargin: 5,
      },
    },
    shielded: () => faucetShielded,
    unshielded: () => faucetUnshielded,
    dust: () => faucetDust,
  });

  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(faucetShieldedSeed);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(faucetDustSeed);

  await faucetFacade.start(shieldedSecretKeys, dustSecretKey);

  console.log('transferUnshieldedFromFaucet: waiting for sync...');
  await waitForFullySynced(faucetFacade);
  console.log('transferUnshieldedFromFaucet: synced.');

  console.log('transferUnshieldedFromFaucet: creating transfer transaction...');
  try {
    const ttl = new Date(Date.now() + 30 * 60 * 1000);
    const parsedAddress = MidnightBech32m.parse(receiverUnshieldedAddress);
    const unshieldedAddress = parsedAddress.decode(UnshieldedAddress, NetworkId.NetworkId.Undeployed);
    const transfer = await faucetFacade.transferTransaction(
      [
        {
          type: 'unshielded',
          outputs: [
            {
              type: ledger.unshieldedToken().raw,
              receiverAddress: unshieldedAddress,
              amount: tokenValue(amount),
            },
          ],
        },
      ],
      { shieldedSecretKeys, dustSecretKey },
      { ttl }
    );

    console.log('transferUnshieldedFromFaucet: signing transaction...');
    const signedTx = await faucetFacade.signRecipe(transfer, (payload: Uint8Array) =>
      faucetUnshieldedKeystore.signData(payload)
    );

    console.log('transferUnshieldedFromFaucet: finalizing transaction...');
    const finalizedTx = await faucetFacade.finalizeRecipe(signedTx);

    console.log('transferUnshieldedFromFaucet: submitting transaction...');
    return await faucetFacade.submitTransaction(finalizedTx);
  } finally {
    await faucetFacade.stop();
  }
}
