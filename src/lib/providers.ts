import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider'
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider'
import type { ConnectedAPI, KeyMaterialProvider } from '@midnight-ntwrk/dapp-connector-api'
import type { ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types'

import { createWalletProvidersFromConnectedAPI } from './walletAdapter'
import { DemoCircuits, DemoProviders } from './types';

export type ShieldedAddress = {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
}

export async function buildProvidersFromConnectedAPI(
  connectedAPI: ConnectedAPI,
  contractName: string
): Promise<DemoProviders> {
  const zkConfigHttpBase = window.location.origin + '/contract/build/' + contractName
  const zkConfigProvider = new FetchZkConfigProvider<DemoCircuits>(zkConfigHttpBase, fetch.bind(window))

  const config = await connectedAPI.getConfiguration()
  const publicDataProvider = indexerPublicDataProvider(config.indexerUri, config.indexerWsUri)
  const proofProvider = httpClientProofProvider(config.proverServerUri!, zkConfigProvider)

  const shieldedAddress:ShieldedAddress = await connectedAPI.getShieldedAddresses();
  const unshieldedAddress = await connectedAPI.getUnshieldedAddress();

  const { walletProvider, midnightProvider } = createWalletProvidersFromConnectedAPI(connectedAPI, proofProvider, zkConfigProvider, shieldedAddress, unshieldedAddress.unshieldedAddress)
  const privateStateProvider = levelPrivateStateProvider( { walletProvider } )

  return {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider
  }
}
