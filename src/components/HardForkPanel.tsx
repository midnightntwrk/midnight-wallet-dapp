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

import { useCallback, useEffect, useState } from 'react';
import {
  deployContract,
  findDeployedContract,
  isLedger8Result,
  submitCallTx,
} from '@midnight-ntwrk/midnight-js/contracts';
import type { ConnectedAPI } from '@midnightntwrk/dapp-connector-api';

import { buildProvidersFromConnectedAPI } from '../lib/providers';
import { readNetworkEra, type NetworkEra } from '../lib/era';
import { createRetainedContractInstance, type RetainedCircuits, type RetainedProviders } from '../lib/types';
import { getErrorMessage } from '../utils/errors';

const RETAINED_ARTIFACT = 'token-transfers-v8';
const RETAINED_CIRCUIT = 'mintAndReceive';
const RETAINED_MINT_AMOUNT = 10_000n;

type Props = {
  readonly connectedAPI: ConnectedAPI | null;
  readonly appendLog: (message: string) => void;
};

/**
 * The ledger v8 -> v9 crossing, driven by hand.
 *
 * Deploy while the chain is pre-fork, enact the fork outside the dApp (`yarn env:fork`), then call
 * the same contract again. The post-fork call is the keep-state path: an ordinary current-era
 * transaction carrying a retained-era call, which is why it needs no separate call site here.
 */
export function HardForkPanel({ connectedAPI, appendLog }: Props) {
  const [providers, setProviders] = useState<RetainedProviders | null>(null);
  const [era, setEra] = useState<NetworkEra | null>(null);
  const [contractAddress, setContractAddress] = useState<string>('');
  const [joined, setJoined] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  useEffect(() => {
    if (connectedAPI === null) {
      setProviders(null);
      return;
    }
    let cancelled = false;
    buildProvidersFromConnectedAPI<RetainedCircuits>(connectedAPI, RETAINED_ARTIFACT, 'warn')
      .then((built) => {
        if (!cancelled) setProviders(built);
      })
      .catch((error: unknown) => appendLog('Retained providers failed: ' + getErrorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [connectedAPI, appendLog]);

  const refreshEra = useCallback(async () => {
    if (providers === null) return;
    try {
      const read = await readNetworkEra(providers.publicDataProvider);
      setEra(read);
      appendLog(`Network head is ${read.ledgerVersion} (protocol version ${read.protocolVersion})`);
    } catch (error: unknown) {
      appendLog('Could not read the network era: ' + getErrorMessage(error));
    }
  }, [providers, appendLog]);

  useEffect(() => {
    void refreshEra();
  }, [refreshEra]);

  const run = async (label: string, action: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await action();
    } catch (error: unknown) {
      console.error(error);
      appendLog(`${label} failed: ` + getErrorMessage(error));
    } finally {
      setIsBusy(false);
      void refreshEra();
    }
  };

  const onDeployRetained = () =>
    run('Pre-fork deploy', async () => {
      if (providers === null) return;
      const deployed = await deployContract(providers, {
        compiledContract: createRetainedContractInstance(),
      });
      setContractAddress(deployed.contractAddress);
      setJoined(true);
      appendLog(`Deployed pre-fork contract at ${deployed.contractAddress}`);
    });

  const onJoinRetained = () =>
    run('Pre-fork join', async () => {
      if (providers === null) return;
      const found = await findDeployedContract(providers, {
        compiledContract: createRetainedContractInstance(),
        contractAddress,
      });
      setJoined(true);
      appendLog(`Joined pre-fork contract at ${found.contractAddress}`);
    });

  const onCallRetained = () =>
    run('Pre-fork contract call', async () => {
      if (providers === null) return;
      const result = await submitCallTx(providers, {
        compiledContract: createRetainedContractInstance(),
        contractAddress,
        circuitId: RETAINED_CIRCUIT,
        args: [RETAINED_MINT_AMOUNT],
      });
      const pipeline = isLedger8Result(result) ? 'retained pipeline' : 'current pipeline';
      appendLog(
        `Called ${RETAINED_CIRCUIT} via the ${pipeline}; recorded on ${result.public.version}, tx ${result.public.txId}`
      );
    });

  const preFork = era?.ledgerVersion === 'v8';

  return (
    <section className="contract-card">
      <div className="contract-card-header">
        <h3>Hard fork (ledger v8 → v9)</h3>
        <span className="contract-card-badge badge-secondary">{era?.ledgerVersion ?? '—'}</span>
      </div>
      <div className="contract-card-content">
        <div className="info-box">
          <span className="info-label">Network head:</span>
          <code className="address">
            {era === null ? 'unknown' : `${era.ledgerVersion} (protocol ${era.protocolVersion})`}
          </code>
        </div>

        <button
          onClick={onDeployRetained}
          disabled={providers === null || !preFork || isBusy}
          className="btn btn-primary btn-block"
        >
          {isBusy ? 'Processing...' : 'Deploy pre-fork contract'}
        </button>

        <div className="form-group">
          <input
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            className="input"
            placeholder="Pre-fork contract address..."
            disabled={isBusy}
          />
        </div>
        <button
          onClick={onJoinRetained}
          disabled={providers === null || contractAddress.trim() === '' || isBusy}
          className="btn btn-outline btn-block"
        >
          {isBusy ? 'Processing...' : 'Join pre-fork contract'}
        </button>

        <button
          onClick={onCallRetained}
          disabled={providers === null || !joined || isBusy}
          className="btn btn-accent btn-block"
        >
          {isBusy ? 'Processing...' : `Call ${RETAINED_CIRCUIT} on the pre-fork contract`}
        </button>
      </div>
    </section>
  );
}
