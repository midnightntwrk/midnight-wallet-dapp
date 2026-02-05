/*
 * This file is part of midnight-wallet-dapp.
 * Copyright (C) 2025 Midnight Foundation
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

import React, { useEffect, useState } from 'react';
import {
  deployContract,
  type DeployedContract,
  submitCallTx,
} from '@midnight-ntwrk/midnight-js-contracts';
import { buildProvidersFromConnectedAPI } from './lib/providers';
import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import './styles.css';
import {
  CompiledDemoContract,
  createSimpleContractInstance,
  DemoCircuits,
  DemoContract,
  DemoProviders,
} from './lib/types';
import { transferUnshieldedFromFaucet } from './lib/faucet';
import { bech32m } from 'bech32';
import {
  setNetworkId as setGlobalNetworkId,
  type NetworkId,
} from '@midnight-ntwrk/midnight-js-network-id';
import * as CompiledContract from './contract/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MidnightWindow = Window & { midnight?: Record<string, any>; cardano?: unknown };

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function findInitialAPIs(): InitialAPI[] {
  const midnight = (window as MidnightWindow).midnight;
  if (!midnight) return [];

  const apis: InitialAPI[] = [];
  for (const key of Object.keys(midnight)) {
    const candidate = midnight[key];
    if (
      candidate &&
      typeof candidate === 'object' &&
      typeof candidate.name === 'string' &&
      typeof candidate.icon === 'string' &&
      typeof candidate.apiVersion === 'string' &&
      typeof candidate.connect === 'function'
    ) {
      apis.push(candidate as InitialAPI);
    }
  }
  return apis;
}

export default function App() {
  const [availableAPIs, setAvailableAPIs] = useState<InitialAPI[]>([]);
  const [connectedAPI, setConnectedAPI] = useState<ConnectedAPI | null>(null);
  const [networkId, setNetworkIdState] = useState<string>('undeployed');
  const [providers, setProviders] = useState<DemoProviders | null>(null);

  const [deployed, setDeployed] = useState<DeployedContract<CompiledContract.Contract> | null>(
    null
  );
  const [contractInstance, setContractInstance] = useState<DemoContract | null>(null);

  const [mintAmount, setMintAmount] = useState<string>('1000');
  const [claimAmount, setClaimAmount] = useState<string>('500');
  const [receiveAmount, setReceiveAmount] = useState<string>('100');
  const [depositNightAmount, setDepositNightAmount] = useState<string>('50');
  const [withdrawNightAmount, setWithdrawNightAmount] = useState<string>('25');
  const [mintedColor, setMintedColor] = useState<string>('');
  const [txLog, setTxLog] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const appendLog = (msg: string) =>
    setTxLog((prev) => [new Date().toLocaleTimeString() + ': ' + msg, ...prev]);

  // Important: MidnightJS has a *global* network-id that must match the wallet/network.
  // If this is left at the default (often `undeployed`), transactions can be built for the
  // wrong network and Lace will fail when balancing/submitting.
  useEffect(() => {
    try {
      setGlobalNetworkId(networkId as NetworkId);
    } catch {
      // Ignore invalid values; the user may be mid-selection or running against older libs.
    }
  }, [networkId]);

  useEffect(() => {
    const w = window as MidnightWindow;
    appendLog('window.cardano=' + (typeof w.cardano !== 'undefined'));
    appendLog('window.midnight=' + (typeof w.midnight !== 'undefined'));

    let tries = 0;
    const iv = setInterval(() => {
      const apis = findInitialAPIs();
      if (apis.length > 0) {
        clearInterval(iv);
        setAvailableAPIs(apis);
        appendLog(`Found ${apis.length} wallet API(s): ${apis.map((a) => a.name).join(', ')}`);
      } else if (++tries > 40) {
        clearInterval(iv);
        appendLog('No Midnight wallet detected after polling');
      }
    }, 500);
    return () => clearInterval(iv);
  }, []);

  async function onConnectWallet() {
    if (availableAPIs.length === 0) {
      alert('No Midnight wallet detected');
      return;
    }

    const initialAPI = availableAPIs[0];
    appendLog(`Connecting to ${initialAPI.name} (API v${initialAPI.apiVersion})`);

    try {
      // Ensure MidnightJS global network id matches what we're asking the wallet for.
      // (Some SDK components use this global when serializing transactions.)
      try {
        setGlobalNetworkId(networkId as NetworkId);
      } catch {
        // ignore
      }

      const connected = await initialAPI.connect(networkId);
      setConnectedAPI(connected);
      appendLog('Wallet connected successfully');

      const config = await connected.getConfiguration();
      // Prefer the network id returned by the wallet config (source of truth)
      // and keep MidnightJS global network id aligned.
      try {
        setNetworkIdState(config.networkId);
        setGlobalNetworkId(config.networkId as NetworkId);
      } catch {
        // Fall back to UI state if the wallet returns an unexpected value.
      }
      appendLog(`Network: ${config.networkId}`);
      appendLog(`Indexer: ${config.indexerUri}`);

      const demoCircuitsMidnightProviders = await buildProvidersFromConnectedAPI(
        connected,
        'unshielded-demo'
      );

      setProviders(demoCircuitsMidnightProviders);
      appendLog('Providers initialized for Mint Contract');

      // Get and log wallet balances
      try {
        const shieldedBalances = await connected.getShieldedBalances();
        const unshieldedBalances = await connected.getUnshieldedBalances();
        const dustBalance = await connected.getDustBalance();

        const shieldedTotal = Object.values(shieldedBalances).reduce((sum, val) => sum + val, 0n);
        const unshieldedTotal = Object.values(unshieldedBalances).reduce(
          (sum, val) => sum + val,
          0n
        );

        appendLog(
          `Balances - Shielded: ${shieldedTotal.toString()}, Unshielded: ${unshieldedTotal.toString()}, Dust: ${dustBalance.balance.toString()} / ${dustBalance.cap.toString()}`
        );
      } catch (e: unknown) {
        appendLog('Failed to fetch balances: ' + getErrorMessage(e));
      }
    } catch (e: unknown) {
      console.error(e);
      appendLog('Connect error: ' + getErrorMessage(e));
      alert('Failed to connect: ' + getErrorMessage(e));
    }
  }

  function onDisconnect() {
    setConnectedAPI(null);
    setProviders(null);
    appendLog('Disconnected');
  }

  async function onRequestDustFromFaucet() {
    if (!connectedAPI || !providers) return alert('Connect wallet first');

    setIsLoading(true);
    try {
      appendLog('Requesting tokens from faucet...');

      const unshieldedAddress = await connectedAPI.getUnshieldedAddress();
      appendLog(`Your Unshielded Address: ${unshieldedAddress.unshieldedAddress}`);

      const config = await connectedAPI.getConfiguration();
      appendLog('Transferring 1000 Night tokens from faucet...');

      const txHash = await transferUnshieldedFromFaucet(
        unshieldedAddress.unshieldedAddress,
        1_000_000n,
        config.indexerUri,
        config.indexerWsUri,
        config.proverServerUri!,
        config.substrateNodeUri.replace('http://', 'ws://').replace('https://', 'wss://')
      );

      appendLog(`Transfer successful! TX Hash: ${txHash}`);
      appendLog('Waiting for transaction to be processed...');

      // Wait for indexer to process
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Refresh dust balance (dust is generated from Night balance)
      const dust = await connectedAPI.getDustBalance();
      appendLog(`Updated Dust Balance: ${dust.balance.toString()} / ${dust.cap.toString()}`);
      appendLog('Faucet transfer complete! You now have Night tokens and dust.');
    } catch (e: unknown) {
      console.error(e);
      appendLog('Error transferring from faucet: ' + getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function onDeploy() {
    if (!providers) return alert('Connect wallet first');

    setIsLoading(true);
    try {
      const demoContractInstance: DemoContract = createSimpleContractInstance();
      const deployed = await deployContract(providers, { compiledContract: CompiledDemoContract });
      setDeployed(deployed);
      setContractInstance(demoContractInstance);
      appendLog('Deployed Mint Contract at ' + deployed.deployTxData.public.contractAddress);
    } catch (e: unknown) {
      console.error(e);
      appendLog('Error deploying contract: ' + getErrorMessage(e));
      alert('Failed to deploy contract: ' + getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function onMint() {
    if (!deployed || !contractInstance) return alert('Deploy contract first');

    setIsLoading(true);
    try {
      const callTxOptions = {
        compiledContract: CompiledDemoContract,
        contractAddress: deployed.deployTxData.public.contractAddress,
        circuitId: 'mintAndReceive' as DemoCircuits,
        args: [BigInt(mintAmount)] as [bigint],
      } as const;
      const callTxData = await submitCallTx(providers!, callTxOptions);
      const colorBytes32 = callTxData.private.result as Uint8Array;
      const hex = Array.from(colorBytes32)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      setMintedColor('0x' + hex);
      appendLog(`Minted ${mintAmount} tokens with color 0x${hex}`);
    } catch (e: unknown) {
      console.error(e);
      appendLog('Error minting tokens: ' + getErrorMessage(e));
      alert('Failed to mint tokens: ' + getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function onClaim() {
    if (!deployed || !contractInstance) return alert('Deploy contract first');

    setIsLoading(true);
    try {
      const address = await connectedAPI?.getUnshieldedAddress();

      if (!address?.unshieldedAddress) {
        return alert('No unshielded address available');
      }

      appendLog(`Unshielded address: ${address.unshieldedAddress}`);

      // Decode bech32m address to get raw bytes
      const decoded = bech32m.decode(address.unshieldedAddress, 1000);
      const addressBytes = new Uint8Array(bech32m.fromWords(decoded.words));

      appendLog(`Decoded address bytes (${addressBytes.length} bytes)`);

      const callTxOptions = {
        compiledContract: CompiledDemoContract,
        contractAddress: deployed.deployTxData.public.contractAddress,
        circuitId: 'sendToUser' as DemoCircuits,
        args: [BigInt(claimAmount), { bytes: addressBytes }] as [bigint, { bytes: Uint8Array }],
      };

      await submitCallTx(providers!, callTxOptions);
      appendLog(`Claimed ${claimAmount} tokens to address ${address.unshieldedAddress}`);
    } catch (e: unknown) {
      console.error(e);
      appendLog('Error claiming tokens: ' + getErrorMessage(e));
      alert('Failed to claim tokens: ' + getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function onReceiveTokens() {
    if (!deployed || !contractInstance) return alert('Deploy contract first');

    setIsLoading(true);
    try {
      const callTxOptions = {
        compiledContract: CompiledDemoContract,
        contractAddress: deployed.deployTxData.public.contractAddress,
        circuitId: 'receiveTokens' as DemoCircuits,
        args: [BigInt(receiveAmount)] as [bigint],
      };

      await submitCallTx(providers!, callTxOptions);
      appendLog(`Received ${receiveAmount} tokens`);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(e);
      appendLog('Error receiving tokens: ' + errorMessage);
      alert('Failed to receive tokens: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function onDepositNight() {
    if (!deployed || !contractInstance) return alert('Deploy contract first');

    setIsLoading(true);
    try {
      const callTxOptions = {
        compiledContract: CompiledDemoContract,
        contractAddress: deployed.deployTxData.public.contractAddress,
        circuitId: 'receiveNightTokens' as DemoCircuits,
        args: [BigInt(depositNightAmount)] as [bigint],
      };

      await submitCallTx(providers!, callTxOptions);
      appendLog(`Deposited ${depositNightAmount} NIGHT tokens`);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(e);
      appendLog('Error depositing NIGHT tokens: ' + errorMessage);
      alert('Failed to deposit NIGHT tokens: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function onWithdrawNight() {
    if (!deployed || !contractInstance) return alert('Deploy contract first');

    setIsLoading(true);
    try {
      const address = await connectedAPI?.getUnshieldedAddress();

      if (!address?.unshieldedAddress) {
        return alert('No unshielded address available');
      }

      appendLog(`Withdrawing to unshielded address: ${address.unshieldedAddress}`);

      const decoded = bech32m.decode(address.unshieldedAddress, 1000);
      const addressBytes = new Uint8Array(bech32m.fromWords(decoded.words));

      const callTxOptions = {
        compiledContract: CompiledDemoContract,
        contractAddress: deployed.deployTxData.public.contractAddress,
        circuitId: 'sendNightTokensToUser' as DemoCircuits,
        args: [BigInt(withdrawNightAmount), { bytes: addressBytes }] as [
          bigint,
          { bytes: Uint8Array },
        ],
      };

      await submitCallTx(providers!, callTxOptions);
      appendLog(`Withdrew ${withdrawNightAmount} NIGHT tokens to ${address.unshieldedAddress}`);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(e);
      appendLog('Error withdrawing NIGHT tokens: ' + errorMessage);
      alert('Failed to withdraw NIGHT tokens: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🌙 Midnight dApp</h1>
          <p className="subtitle">Tokens operations</p>
        </div>
      </header>

      <main className="container">
        <section className="wallet-section">
          <div className="wallet-info">
            <div className="status-badge" data-connected={!!connectedAPI}>
              <span className="status-dot"></span>
              {connectedAPI
                ? 'Connected'
                : availableAPIs.length > 0
                  ? 'Wallet Detected'
                  : 'No Wallet'}
            </div>
            {connectedAPI && (
              <div className="network-info">
                <span className="info-label">Network:</span> {networkId}
                {availableAPIs[0] && (
                  <>
                    <span className="separator">•</span>
                    <span className="info-label">Wallet:</span> {availableAPIs[0].name}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="wallet-actions">
            {!connectedAPI ? (
              <>
                <select
                  id="networkSelect"
                  value={networkId}
                  onChange={(e) => setNetworkIdState(e.target.value)}
                  className="input"
                  disabled={!!connectedAPI}
                  style={{ maxWidth: '150px' }}
                >
                  <option value="undeployed">Undeployed</option>
                  <option value="preview">Preview</option>
                  <option value="qanet">QANet</option>
                </select>
                <button
                  onClick={onConnectWallet}
                  disabled={availableAPIs.length === 0}
                  className="btn btn-primary"
                >
                  {availableAPIs.length > 0 ? 'Connect Wallet' : 'No Wallet Detected'}
                </button>
              </>
            ) : (
              <>
                {networkId === 'undeployed' && (
                  <button
                    onClick={onRequestDustFromFaucet}
                    disabled={isLoading}
                    className="btn btn-accent"
                  >
                    {isLoading ? 'Processing...' : 'Get Tokens from Faucet'}
                  </button>
                )}
                {networkId === 'preview' && (
                  <a
                    href="https://faucet.preview.midnight.network/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-accent"
                    style={{ textDecoration: 'none' }}
                  >
                    Go to Faucet
                  </a>
                )}
                {networkId === 'qanet' && (
                  <a
                    href="https://faucet.qanet.midnight.network/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-accent"
                    style={{ textDecoration: 'none' }}
                  >
                    Go to Faucet
                  </a>
                )}
                <button disabled className="btn btn-secondary">
                  Connected
                </button>
                <button onClick={onDisconnect} className="btn btn-outline">
                  Disconnect
                </button>
              </>
            )}
          </div>
        </section>

        <section className="wallet-section">
          <div className="wallet-info">
            <div className="network-info">
              <span className="info-label">Contract Address:</span>
              <code className="address">
                {deployed?.deployTxData.public.contractAddress ?? '—'}
              </code>
            </div>
          </div>
          <div className="wallet-actions">
            <button
              onClick={onDeploy}
              disabled={!providers || isLoading}
              className="btn btn-primary"
            >
              {isLoading ? 'Processing...' : 'Deploy Contract'}
            </button>
          </div>
        </section>

        <section className="contracts-grid">
          <div className="card">
            <div className="card-header">
              <h2>Unshielded Tokens</h2>
            </div>
            <div className="card-content">
              <div className="form-group">
                <label htmlFor="mintAmount">Mint Amount</label>
                <input
                  id="mintAmount"
                  type="number"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  className="input"
                  placeholder="1000"
                />
              </div>
              <button
                onClick={onMint}
                disabled={!deployed || !providers || isLoading}
                className="btn btn-accent btn-block"
              >
                {isLoading ? 'Processing...' : 'Mint Tokens'}
              </button>
              <div className="info-box">
                <span className="info-label">Minted Color:</span>
                <code className="color-code">{mintedColor || '—'}</code>
              </div>

              <div className="divider"></div>

              <div className="form-group">
                <label htmlFor="claimAmount">Claim Amount</label>
                <input
                  id="claimAmount"
                  type="number"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  className="input"
                  placeholder="500"
                />
              </div>
              <button
                onClick={onClaim}
                disabled={!deployed || !mintedColor || !providers || isLoading}
                className="btn btn-accent btn-block"
              >
                {isLoading ? 'Processing...' : 'Claim Tokens'}
              </button>

              <div className="divider"></div>

              <div className="form-group">
                <label htmlFor="receiveAmount">Deposit Amount</label>
                <input
                  id="receiveAmount"
                  type="number"
                  value={receiveAmount}
                  onChange={(e) => setReceiveAmount(e.target.value)}
                  className="input"
                  placeholder="100"
                />
              </div>
              <button
                onClick={onReceiveTokens}
                disabled={!deployed || !providers || isLoading}
                className="btn btn-accent btn-block"
              >
                {isLoading ? 'Processing...' : 'Deposit Tokens'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>NIGHT Tokens</h2>
            </div>
            <div className="card-content">
              <div className="form-group">
                <label htmlFor="depositNightAmount">Deposit Amount</label>
                <input
                  id="depositNightAmount"
                  type="number"
                  value={depositNightAmount}
                  onChange={(e) => setDepositNightAmount(e.target.value)}
                  className="input"
                  placeholder="50"
                />
              </div>
              <button
                onClick={onDepositNight}
                disabled={!deployed || !providers || isLoading}
                className="btn btn-accent btn-block"
              >
                {isLoading ? 'Processing...' : 'Deposit NIGHT'}
              </button>

              <div className="divider"></div>

              <div className="form-group">
                <label htmlFor="withdrawNightAmount">Withdraw Amount</label>
                <input
                  id="withdrawNightAmount"
                  type="number"
                  value={withdrawNightAmount}
                  onChange={(e) => setWithdrawNightAmount(e.target.value)}
                  className="input"
                  placeholder="25"
                />
              </div>
              <button
                onClick={onWithdrawNight}
                disabled={!deployed || !providers || isLoading}
                className="btn btn-accent btn-block"
              >
                {isLoading ? 'Processing...' : 'Withdraw NIGHT'}
              </button>
            </div>
          </div>
        </section>

        <section className="activity-section">
          <h3 className="activity-title">📊 Activity Log</h3>
          <div className="activity-log">
            {txLog.length === 0 ? (
              <p className="empty-state">No activity yet</p>
            ) : (
              <ul className="log-list">
                {txLog.map((l, i) => (
                  <li key={i} className="log-item">
                    {l}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
