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

import React, { useEffect, useState } from 'react';
import { deployContract, findDeployedContract, type FoundContract, submitCallTx } from '@midnight-ntwrk/midnight-js/contracts';
import { setNetworkId as setGlobalNetworkId, type NetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { buildProvidersFromConnectedAPI } from './lib/providers';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { bech32m } from 'bech32';

import { useActivityLog } from './hooks/useActivityLog';
import { useWalletDetection } from './hooks/useWalletDetection';
import { getErrorMessage } from './utils/errors';

import {
  CompiledDemoContract,
  createSimpleContractInstance,
  DemoCircuits,
  DemoContract,
  DemoProviders,
} from './lib/types';
import './styles.css';

export default function App() {
  const { logs, appendLog } = useActivityLog();
  const { availableAPIs } = useWalletDetection(appendLog);

  const [selectedWalletIndex, setSelectedWalletIndex] = useState<number>(0);
  const [connectedAPI, setConnectedAPI] = useState<ConnectedAPI | null>(null);
  const [networkId, setNetworkIdState] = useState<string>('undeployed');
  const [customNetworkId, setCustomNetworkId] = useState<string>('');
  const [providers, setProviders] = useState<DemoProviders | null>(null);

  const [deployed, setDeployed] = useState<FoundContract<DemoContract> | null>(null);
  const [contractInstance, setContractInstance] = useState<DemoContract | null>(null);
  const [joinAddress, setJoinAddress] = useState<string>('');

  const [mintAmount, setMintAmount] = useState<string>('10000');
  const [claimAmount, setClaimAmount] = useState<string>('6000');
  const [receiveAmount, setReceiveAmount] = useState<string>('1500');
  const [depositNightAmount, setDepositNightAmount] = useState<string>('5000');
  const [withdrawNightAmount, setWithdrawNightAmount] = useState<string>('2501');
  const [mintedColor, setMintedColor] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [shieldedMintAmount, setShieldedMintAmount] = useState<string>('10000');
  const [shieldedClaimAmount, setShieldedSendAmount] = useState<string>('6000');
  const [shieldedDepositAmount, setShieldedDepositAmount] = useState<string>('1500');
  const [shieldedColor, setShieldedColor] = useState<Uint8Array | null>(null);

  const effectiveNetworkId = networkId === 'custom' ? customNetworkId : networkId;

  useEffect(() => {
    try {
      setGlobalNetworkId(effectiveNetworkId as NetworkId);
    } catch {
      // Ignore invalid values
    }
  }, [effectiveNetworkId]);

  async function onConnectWallet() {
    if (availableAPIs.length === 0) {
      alert('No Midnight wallet detected');
      return;
    }

    const initialAPI = availableAPIs[selectedWalletIndex];
    appendLog(`Connecting to ${initialAPI.name} (API v${initialAPI.apiVersion})`);

    try {
      try {
        setGlobalNetworkId(effectiveNetworkId as NetworkId);
      } catch {
        // ignore
      }

      const connected = await initialAPI.connect(effectiveNetworkId);
      setConnectedAPI(connected);
      appendLog('Wallet connected successfully');

      const config = await connected.getConfiguration();
      try {
        const presetNetworks = ['undeployed', 'preview', 'qanet'];
        if (presetNetworks.includes(config.networkId)) {
          setNetworkIdState(config.networkId);
        } else {
          setNetworkIdState('custom');
          setCustomNetworkId(config.networkId);
        }
        setGlobalNetworkId(config.networkId as NetworkId);
      } catch {
        // Fall back to UI state
      }
      appendLog(`Network: ${config.networkId}`);
      appendLog(`Indexer: ${config.indexerUri}`);

      const demoCircuitsMidnightProviders = await buildProvidersFromConnectedAPI(connected, 'token-transfers');
      setProviders(demoCircuitsMidnightProviders);
      appendLog('Providers initialized for Mint Contract');

      try {
        const shieldedBalances = await connected.getShieldedBalances();
        const unshieldedBalances = await connected.getUnshieldedBalances();
        const dustBalance = await connected.getDustBalance();

        const shieldedTotal = Object.values(shieldedBalances).reduce((sum, val) => sum + val, 0n);
        const unshieldedTotal = Object.values(unshieldedBalances).reduce((sum, val) => sum + val, 0n);

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

  async function onDeploy() {
    if (!providers) return alert('Connect wallet first');

    setIsLoading(true);
    try {
      const demoContractInstance: DemoContract = createSimpleContractInstance();
      const deployedContract = await deployContract(providers, { compiledContract: CompiledDemoContract });
      setDeployed(deployedContract);
      setContractInstance(demoContractInstance);
      appendLog('Deployed Mint Contract at ' + deployedContract.deployTxData.public.contractAddress);
    } catch (e: unknown) {
      console.error(e);
      appendLog('Error deploying contract: ' + getErrorMessage(e));
      alert('Failed to deploy contract: ' + getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function onJoinContract() {
    if (!providers) return alert('Connect wallet first');
    if (!joinAddress.trim()) return alert('Enter a contract address');

    setIsLoading(true);
    try {
      const demoContractInstance: DemoContract = createSimpleContractInstance();
      const foundContract = await findDeployedContract(providers, {
        compiledContract: CompiledDemoContract,
        contractAddress: joinAddress.trim(),
      });
      setDeployed(foundContract);
      setContractInstance(demoContractInstance);
      appendLog('Joined contract at ' + foundContract.deployTxData.public.contractAddress);
    } catch (e: unknown) {
      console.error(e);
      appendLog('Error joining contract: ' + getErrorMessage(e));
      alert('Failed to join contract: ' + getErrorMessage(e));
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
      console.error(e);
      appendLog('Error receiving tokens: ' + getErrorMessage(e));
      alert('Failed to receive tokens: ' + getErrorMessage(e));
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
      appendLog(`Deposited ${depositNightAmount} STAR (${Number(depositNightAmount) / 1_000_000} NIGHT)`);
    } catch (e: unknown) {
      console.error(e);
      appendLog('Error depositing NIGHT tokens: ' + getErrorMessage(e));
      alert('Failed to deposit NIGHT tokens: ' + getErrorMessage(e));
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
        args: [BigInt(withdrawNightAmount), { bytes: addressBytes }] as [bigint, { bytes: Uint8Array }],
      };

      await submitCallTx(providers!, callTxOptions);
      appendLog(
        `Withdrew ${withdrawNightAmount} STAR (${Number(withdrawNightAmount) / 1_000_000} NIGHT) to ${address.unshieldedAddress}`
      );
    } catch (e: unknown) {
      console.error(e);
      appendLog('Error withdrawing NIGHT tokens: ' + getErrorMessage(e));
      alert('Failed to withdraw NIGHT tokens: ' + getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function onDepositShielded() {
    if (!deployed || !contractInstance) return alert('Deploy contract first');
    if (!shieldedColor) return alert('Mint & claim shielded tokens first to obtain a color');

    setIsLoading(true);
    try {
      const nonce = crypto.getRandomValues(new Uint8Array(32));

      const coin = {
        nonce,
        color: shieldedColor,
        value: BigInt(shieldedDepositAmount),
      };

      const callTxOptions = {
        compiledContract: CompiledDemoContract,
        contractAddress: deployed.deployTxData.public.contractAddress,
        circuitId: 'receiveShieldedTokens' as DemoCircuits,
        args: [coin] as [{ nonce: Uint8Array; color: Uint8Array; value: bigint }],
      };

      await submitCallTx(providers!, callTxOptions);
      appendLog(`Deposited ${shieldedDepositAmount} shielded tokens`);
    } catch (e: unknown) {
      console.error(e);
      appendLog('Error depositing shielded tokens: ' + getErrorMessage(e));
      alert('Failed to deposit shielded tokens: ' + getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function onMintAndClaimShielded() {
    if (!deployed || !contractInstance) return alert('Deploy contract first');

    setIsLoading(true);
    try {
      const shieldedAddress = await connectedAPI?.getShieldedAddresses();
      if (!shieldedAddress?.shieldedCoinPublicKey) {
        return alert('No shielded coin public key available');
      }

      const publicKeyBytes = new Uint8Array(
        shieldedAddress.shieldedCoinPublicKey.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
      );

      const domainSep = crypto.getRandomValues(new Uint8Array(32));
      const nonce = crypto.getRandomValues(new Uint8Array(32));

      const callTxOptions = {
        compiledContract: CompiledDemoContract,
        contractAddress: deployed.deployTxData.public.contractAddress,
        circuitId: 'mintAndSendShielded' as DemoCircuits,
        args: [
          domainSep,
          BigInt(shieldedMintAmount),
          nonce,
          { bytes: publicKeyBytes },
          BigInt(shieldedClaimAmount),
        ] as [Uint8Array, bigint, Uint8Array, { bytes: Uint8Array }, bigint],
      };

      const callTxData = await submitCallTx(providers!, callTxOptions);
      const result = callTxData.private.result as {
        change: { is_some: boolean; value: { nonce: Uint8Array; color: Uint8Array; value: bigint } };
        sent: { nonce: Uint8Array; color: Uint8Array; value: bigint };
      };

      setShieldedColor(result.sent.color);
      const colorHex = Array.from(result.sent.color)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      appendLog(
        `Minted ${shieldedMintAmount} and claimed ${shieldedClaimAmount} shielded tokens (color: 0x${colorHex})`
      );
      appendLog(`  Claimed coin value: ${result.sent.value}`);
      if (result.change.is_some) {
        appendLog(`  Change coin value: ${result.change.value.value}`);
      }
    } catch (e: unknown) {
      console.error(e);
      appendLog('Error in mint & claim shielded: ' + getErrorMessage(e));
      alert('Failed to mint & claim shielded: ' + getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>Midnight Wallet dApp</h1>
          <p className="subtitle">Tokens operations</p>
        </div>
      </header>

      <main className="container">
        {/* Wallet Connection Section */}
        <section className="wallet-section">
          <div className="wallet-info">
            <div className="status-badge" data-connected={!!connectedAPI}>
              <span className="status-dot"></span>
              {connectedAPI ? 'Connected' : availableAPIs.length > 0 ? 'Wallet Detected' : 'No Wallet'}
            </div>
            {connectedAPI && (
              <div className="network-info">
                <span className="info-label">Network:</span> {effectiveNetworkId}
                {availableAPIs[selectedWalletIndex] && (
                  <>
                    <span className="separator">|</span>
                    <span className="info-label">Wallet:</span> {availableAPIs[selectedWalletIndex].name}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="wallet-actions">
            {!connectedAPI ? (
              <>
                {availableAPIs.length > 1 && (
                  <select
                    id="walletSelect"
                    value={selectedWalletIndex}
                    onChange={(e) => setSelectedWalletIndex(Number(e.target.value))}
                    className="input"
                    style={{ maxWidth: '200px' }}
                  >
                    {availableAPIs.map((api, index) => (
                      <option key={api.name} value={index}>
                        {api.name}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  id="networkSelect"
                  value={networkId === 'custom' ? 'custom' : networkId}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'custom') {
                      setNetworkIdState('custom');
                    } else {
                      setNetworkIdState(value);
                      setCustomNetworkId('');
                    }
                  }}
                  className="input"
                  disabled={!!connectedAPI}
                  style={{ maxWidth: '150px' }}
                >
                  <option value="undeployed">Undeployed</option>
                  <option value="qanet">QANet</option>
                  <option value="preview">Preview</option>
                  <option value="preprod">PreProd</option>
                  <option value="custom">Custom</option>
                </select>
                {networkId === 'custom' && (
                  <input
                    type="text"
                    value={customNetworkId}
                    onChange={(e) => setCustomNetworkId(e.target.value)}
                    className="input"
                    placeholder="Enter network ID..."
                    disabled={!!connectedAPI}
                    style={{ maxWidth: '200px' }}
                  />
                )}
                <button onClick={onConnectWallet} disabled={availableAPIs.length === 0} className="btn btn-primary">
                  {availableAPIs.length > 0 ? 'Connect Wallet' : 'No Wallet Detected'}
                </button>
              </>
            ) : (
              <>
                {(['preview', 'qanet', 'preprod'] as const).includes(
                  effectiveNetworkId as 'preview' | 'qanet' | 'preprod'
                ) && (
                  <a
                    href={`https://faucet.${effectiveNetworkId}.midnight.network/`}
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

        {/* Contract Section */}
        <div className="contract-setup-grid">
          <section className="contract-card">
            <div className="contract-card-header">
              <h3>Deploy New Contract</h3>
              <span className="contract-card-badge">New</span>
            </div>
            <div className="contract-card-content">
              <button
                onClick={onDeploy}
                disabled={!providers || !!deployed || isLoading}
                className="btn btn-primary btn-block"
              >
                {isLoading ? 'Processing...' : 'Deploy Contract'}
              </button>
            </div>
          </section>
          <section className="contract-card">
            <div className="contract-card-header">
              <h3>Join Existing Contract</h3>
              <span className="contract-card-badge badge-secondary">Join</span>
            </div>
            <div className="contract-card-content">
              <div className="form-group">
                <input
                  type="text"
                  value={joinAddress}
                  onChange={(e) => setJoinAddress(e.target.value)}
                  className="input"
                  placeholder="Enter contract address..."
                  disabled={!!deployed || isLoading}
                />
              </div>
              <button
                onClick={onJoinContract}
                disabled={!providers || !joinAddress.trim() || !!deployed || isLoading}
                className="btn btn-primary btn-block"
              >
                {isLoading ? 'Processing...' : 'Join Contract'}
              </button>
            </div>
          </section>
        </div>
        <div className="info-box" style={{ marginBottom: '1.25rem' }}>
          <span className="info-label">Contract Address:</span>
          <code className="address">{deployed?.deployTxData.public.contractAddress ?? '—'}</code>
        </div>

        {/* Token Operations */}
        <section className="contracts-grid">
          {/* Unshielded Tokens Card */}
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

          {/* NIGHT Tokens Card */}
          <div className="card">
            <div className="card-header">
              <h2>NIGHT Tokens</h2>
            </div>
            <div className="card-content">
              <p className="info-text" style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1rem' }}>
                1,000,000 STAR = 1 NIGHT
              </p>
              <div className="form-group">
                <label htmlFor="depositNightAmount">Deposit Amount (STAR)</label>
                <input
                  id="depositNightAmount"
                  type="number"
                  value={depositNightAmount}
                  onChange={(e) => setDepositNightAmount(e.target.value)}
                  className="input"
                  placeholder="1500"
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
                <label htmlFor="withdrawNightAmount">Withdraw Amount (STAR)</label>
                <input
                  id="withdrawNightAmount"
                  type="number"
                  value={withdrawNightAmount}
                  onChange={(e) => setWithdrawNightAmount(e.target.value)}
                  className="input"
                  placeholder="500"
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

          {/* Shielded Tokens Card */}
          <div className="card">
            <div className="card-header">
              <h2>Shielded Tokens</h2>
            </div>
            <div className="card-content">
              <div className="form-group">
                <label htmlFor="shieldedMintAmount">Mint Amount</label>
                <input
                  id="shieldedMintAmount"
                  type="number"
                  value={shieldedMintAmount}
                  onChange={(e) => setShieldedMintAmount(e.target.value)}
                  className="input"
                  placeholder="10000"
                />
              </div>

              <div className="form-group">
                <label htmlFor="shieldedClaimAmount">Claim Amount</label>
                <input
                  id="shieldedClaimAmount"
                  type="number"
                  value={shieldedClaimAmount}
                  onChange={(e) => setShieldedSendAmount(e.target.value)}
                  className="input"
                  placeholder="6000"
                />
              </div>
              <button
                onClick={onMintAndClaimShielded}
                disabled={!deployed || !providers || isLoading}
                className="btn btn-accent btn-block"
              >
                {isLoading ? 'Processing...' : 'Mint & Claim Shielded'}
              </button>

              <div className="info-box">
                <span className="info-label">Token Color:</span>
                <code className="color-code">
                  {shieldedColor
                    ? '0x' +
                      Array.from(shieldedColor)
                        .map((b) => b.toString(16).padStart(2, '0'))
                        .join('')
                    : '—'}
                </code>
              </div>

              <div className="divider"></div>

              <div className="form-group">
                <label htmlFor="shieldedDepositAmount">Deposit Amount</label>
                <input
                  id="shieldedDepositAmount"
                  type="number"
                  value={shieldedDepositAmount}
                  onChange={(e) => setShieldedDepositAmount(e.target.value)}
                  className="input"
                  placeholder="1500"
                />
              </div>
              <button
                onClick={onDepositShielded}
                disabled={!deployed || !providers || !shieldedColor || isLoading}
                className="btn btn-accent btn-block"
              >
                {isLoading ? 'Processing...' : 'Deposit Shielded'}
              </button>
            </div>
          </div>
        </section>

        {/* Activity Log */}
        <section className="activity-section">
          <h3 className="activity-title">Activity Log</h3>
          <div className="activity-log">
            {logs.length === 0 ? (
              <p className="empty-state">No activity yet</p>
            ) : (
              <ul className="log-list">
                {logs.map((log, index) => (
                  <li key={index} className="log-item">
                    {log}
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
