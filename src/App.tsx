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

import React, { useEffect, useState } from 'react';
import { setNetworkId as setGlobalNetworkId, type NetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { deploySessionContract, joinSessionContract, type ContractEra, type ContractSession } from './lib/session';
import { HardForkPanel } from './components/HardForkPanel';
import type { ConnectedAPI } from '@midnightntwrk/dapp-connector-api';
import { bech32m } from 'bech32';
import { MidnightBech32m, ShieldedCoinPublicKey } from '@midnightntwrk/wallet-sdk-address-format';

import { useActivityLog } from './hooks/useActivityLog';
import { useWalletDetection } from './hooks/useWalletDetection';
import { getErrorMessage } from './utils/errors';
import { uint8ArrayToHex } from './lib/walletAdapter';

import './styles.css';

/** The raw bytes behind a bech32m-encoded unshielded address. */
function decodeUnshieldedAddress(address: string): Uint8Array {
  return new Uint8Array(bech32m.fromWords(bech32m.decode(address, 1000).words));
}

export default function App() {
  const { logs, appendLog } = useActivityLog();
  const { availableAPIs } = useWalletDetection(appendLog);

  const [selectedWalletIndex, setSelectedWalletIndex] = useState<number>(0);
  const [connectedAPI, setConnectedAPI] = useState<ConnectedAPI | null>(null);
  const [networkId, setNetworkIdState] = useState<string>('undeployed');
  const [customNetworkId, setCustomNetworkId] = useState<string>('');
  const [session, setSession] = useState<ContractSession | null>(null);
  const [contractEra, setContractEra] = useState<ContractEra>('ledger9');
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

      appendLog('Wallet connected; providers are built per contract era on deploy or join');

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

  /**
   * Runs one user action: raises the loading flag for its duration, and on failure reports it in one
   * place — to the console, the activity log and the user.
   *
   * `what` is the action as an infinitive phrase ("mint tokens"), so log and alert read alike. Guards
   * belong OUTSIDE the call, so a refused action never raises the flag.
   */
  async function runAction(what: string, action: () => Promise<void>) {
    setIsLoading(true);
    try {
      await action();
    } catch (e: unknown) {
      console.error(e);
      const message = `Failed to ${what}: ${getErrorMessage(e)}`;
      appendLog(message);
      alert(message);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Throws rather than alerting on its own: it runs inside `runAction`, whose catch is the one place
   * a failed action is reported.
   */
  async function requireUnshieldedAddress(): Promise<string> {
    const address = await connectedAPI?.getUnshieldedAddress();
    if (!address?.unshieldedAddress) {
      throw new Error('the connected wallet supplied no unshielded address');
    }
    return address.unshieldedAddress;
  }

  function clearSession() {
    // The provider set owns an indexer WebSocket; dropping the reference alone would leak it. The
    // rejection is caught here rather than left to float: this runs inside `runAction`, but `void`
    // detaches the promise, so an unguarded failure would surface as an unhandled rejection and reach
    // neither the activity log nor the user.
    if (session) {
      void session.dispose().catch((error: unknown) => {
        console.error('[App] could not release the providers when clearing the session', error);
      });
    }
    setSession(null);
    setMintedColor('');
    setShieldedColor(null);
  }

  function onDisconnect() {
    setConnectedAPI(null);
    clearSession();
    appendLog('Disconnected');
  }

  function onDeploy() {
    if (!connectedAPI) return alert('Connect wallet first');

    void runAction('deploy contract', async () => {
      clearSession();
      const deployed = await deploySessionContract(connectedAPI, contractEra);
      setSession(deployed);
      appendLog(`Deployed ${deployed.handle.era} contract at ${deployed.handle.contractAddress}`);
    });
  }

  function onJoinContract() {
    if (!connectedAPI) return alert('Connect wallet first');
    if (!joinAddress.trim()) return alert('Enter a contract address');

    void runAction('join contract', async () => {
      clearSession();
      const joined = await joinSessionContract(connectedAPI, contractEra, joinAddress.trim());
      setSession(joined);
      appendLog(`Joined ${joined.handle.era} contract at ${joined.handle.contractAddress}`);
    });
  }

  function onMint() {
    if (!session) return alert('Deploy or join a contract first');

    void runAction('mint tokens', async () => {
      const callTxData = await session.handle.callTx.mintAndReceive(BigInt(mintAmount));
      const hex = uint8ArrayToHex(callTxData.private.result as Uint8Array);
      setMintedColor('0x' + hex);
      appendLog(`Minted ${mintAmount} tokens with color 0x${hex}`);
    });
  }

  function onClaim() {
    if (!session) return alert('Deploy or join a contract first');

    void runAction('claim tokens', async () => {
      const unshieldedAddress = await requireUnshieldedAddress();
      appendLog(`Unshielded address: ${unshieldedAddress}`);

      const addressBytes = decodeUnshieldedAddress(unshieldedAddress);
      appendLog(`Decoded address bytes (${addressBytes.length} bytes)`);

      await session.handle.callTx.sendToUser(BigInt(claimAmount), { bytes: addressBytes });
      appendLog(`Claimed ${claimAmount} tokens to address ${unshieldedAddress}`);
    });
  }

  function onReceiveTokens() {
    if (!session) return alert('Deploy or join a contract first');

    void runAction('receive tokens', async () => {
      await session.handle.callTx.receiveTokens(BigInt(receiveAmount));
      appendLog(`Received ${receiveAmount} tokens`);
    });
  }

  function onDepositNight() {
    if (!session) return alert('Deploy or join a contract first');

    void runAction('deposit NIGHT tokens', async () => {
      await session.handle.callTx.receiveNightTokens(BigInt(depositNightAmount));
      appendLog(`Deposited ${depositNightAmount} STAR (${Number(depositNightAmount) / 1_000_000} NIGHT)`);
    });
  }

  function onWithdrawNight() {
    if (!session) return alert('Deploy or join a contract first');

    void runAction('withdraw NIGHT tokens', async () => {
      const unshieldedAddress = await requireUnshieldedAddress();
      appendLog(`Withdrawing to unshielded address: ${unshieldedAddress}`);

      const addressBytes = decodeUnshieldedAddress(unshieldedAddress);
      await session.handle.callTx.sendNightTokensToUser(BigInt(withdrawNightAmount), { bytes: addressBytes });
      appendLog(
        `Withdrew ${withdrawNightAmount} STAR (${Number(withdrawNightAmount) / 1_000_000} NIGHT) to ${unshieldedAddress}`
      );
    });
  }

  function onDepositShielded() {
    if (!session) return alert('Deploy or join a contract first');
    if (!shieldedColor) return alert('Mint & claim shielded tokens first to obtain a color');

    void runAction('deposit shielded tokens', async () => {
      const coin = {
        nonce: crypto.getRandomValues(new Uint8Array(32)),
        color: shieldedColor,
        value: BigInt(shieldedDepositAmount),
      };

      await session.handle.callTx.receiveShieldedTokens(coin);
      appendLog(`Deposited ${shieldedDepositAmount} shielded tokens`);
    });
  }

  function onMintAndClaimShielded() {
    if (!session) return alert('Deploy or join a contract first');
    if (!connectedAPI) return alert('Connect wallet first');

    void runAction('mint & claim shielded', async () => {
      const { shieldedCoinPublicKey } = await connectedAPI.getShieldedAddresses();
      // Typed as a required string, but it crosses an extension boundary. Without this the empty and
      // undefined cases reach bech32 and are reported as "bech32.decode input: string expected",
      // which names a library the user has never heard of instead of the wallet.
      if (!shieldedCoinPublicKey) {
        throw new Error('the connected wallet supplied no shielded coin public key');
      }

      // shieldedCoinPublicKey is bech32m-encoded (per dapp-connector API spec) — decode to raw 32 bytes
      const publicKeyBytes = new Uint8Array(
        ShieldedCoinPublicKey.codec.decode(effectiveNetworkId, MidnightBech32m.parse(shieldedCoinPublicKey)).data
      );

      const callTxData = await session.handle.callTx.mintAndSendShielded(
        crypto.getRandomValues(new Uint8Array(32)),
        BigInt(shieldedMintAmount),
        crypto.getRandomValues(new Uint8Array(32)),
        { bytes: publicKeyBytes },
        BigInt(shieldedClaimAmount)
      );
      const result = callTxData.private.result as {
        change: { is_some: boolean; value: { nonce: Uint8Array; color: Uint8Array; value: bigint } };
        sent: { nonce: Uint8Array; color: Uint8Array; value: bigint };
      };

      setShieldedColor(result.sent.color);
      appendLog(
        `Minted ${shieldedMintAmount} and claimed ${shieldedClaimAmount} shielded tokens (color: 0x${uint8ArrayToHex(result.sent.color)})`
      );
      appendLog(`  Claimed coin value: ${result.sent.value}`);
      if (result.change.is_some) {
        appendLog(`  Change coin value: ${result.change.value.value}`);
      }
    });
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
              <h3>Contract Era</h3>
              <span className="contract-card-badge badge-secondary">{contractEra === 'ledger9' ? 'v9' : 'v8'}</span>
            </div>
            <div className="contract-card-content">
              <div className="form-group">
                <label htmlFor="contractEra">Which toolchain built the contract</label>
                <select
                  id="contractEra"
                  value={contractEra}
                  onChange={(e) => setContractEra(e.target.value as ContractEra)}
                  className="input"
                  disabled={!!session || isLoading}
                >
                  <option value="ledger9">Current (compactc 0.35.0, ledger v9)</option>
                  <option value="ledger8">Pre-fork (compactc 0.31.1, ledger v8)</option>
                </select>
              </div>
              <p className="hint">
                A contract keeps the era it was deployed with, the fork included. Pick pre-fork to deploy on a ledger-v8
                chain, or to call a contract that was deployed there.
              </p>
            </div>
          </section>
          <section className="contract-card">
            <div className="contract-card-header">
              <h3>Deploy New Contract</h3>
              <span className="contract-card-badge">New</span>
            </div>
            <div className="contract-card-content">
              <button
                onClick={onDeploy}
                disabled={!connectedAPI || !!session || isLoading}
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
                  disabled={!!session || isLoading}
                />
              </div>
              <button
                onClick={onJoinContract}
                disabled={!connectedAPI || !joinAddress.trim() || !!session || isLoading}
                className="btn btn-primary btn-block"
              >
                {isLoading ? 'Processing...' : 'Join Contract'}
              </button>
            </div>
          </section>
        </div>
        <div className="contract-setup-grid">
          <HardForkPanel connectedAPI={connectedAPI} appendLog={appendLog} />
        </div>
        <div className="info-box" style={{ marginBottom: '1.25rem' }}>
          <span className="info-label">Contract Address:</span>
          <code className="address">{session?.handle.contractAddress ?? '—'}</code>
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
              <button onClick={onMint} disabled={!session || isLoading} className="btn btn-accent btn-block">
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
                disabled={!session || !mintedColor || isLoading}
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
              <button onClick={onReceiveTokens} disabled={!session || isLoading} className="btn btn-accent btn-block">
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
              <button onClick={onDepositNight} disabled={!session || isLoading} className="btn btn-accent btn-block">
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
              <button onClick={onWithdrawNight} disabled={!session || isLoading} className="btn btn-accent btn-block">
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
                disabled={!session || isLoading}
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
                disabled={!session || !shieldedColor || isLoading}
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
