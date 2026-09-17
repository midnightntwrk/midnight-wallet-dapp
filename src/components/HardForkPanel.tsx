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
import type { ConnectedAPI } from '@midnightntwrk/dapp-connector-api';

import { readNetworkEra, type NetworkEra } from '../lib/era';
import { buildSessionProviders } from '../lib/session';
import { getErrorMessage } from '../utils/errors';

type Props = {
  readonly connectedAPI: ConnectedAPI | null;
  readonly appendLog: (message: string) => void;
};

/**
 * Which side of the ledger fork the network head is on.
 *
 * Read rather than assumed, and re-read on demand: the answer is wrong exactly at the boundary,
 * which is where it matters. It does not decide which artifact a contract is called with — that
 * follows from the contract — but it does say whether a pre-fork deploy is still possible.
 */
export function HardForkPanel({ connectedAPI, appendLog }: Props) {
  const [era, setEra] = useState<NetworkEra | null>(null);
  const [isReading, setIsReading] = useState<boolean>(false);

  const refreshEra = useCallback(async () => {
    if (connectedAPI === null) {
      setEra(null);
      return;
    }
    setIsReading(true);
    try {
      const providers = await buildSessionProviders(connectedAPI, 'ledger9');
      const read = await readNetworkEra(providers.publicDataProvider);
      setEra(read);
      appendLog(`Network head is ${read.ledgerVersion} (protocol version ${read.protocolVersion})`);
    } catch (error: unknown) {
      appendLog('Could not read the network era: ' + getErrorMessage(error));
    } finally {
      setIsReading(false);
    }
  }, [connectedAPI, appendLog]);

  useEffect(() => {
    void refreshEra();
  }, [refreshEra]);

  return (
    <section className="contract-card">
      <div className="contract-card-header">
        <h3>Network Era</h3>
        <span className="contract-card-badge badge-secondary">{era?.ledgerVersion ?? '—'}</span>
      </div>
      <div className="contract-card-content">
        <div className="info-box">
          <span className="info-label">Head:</span>
          <code className="address">
            {era === null ? 'unknown' : `${era.ledgerVersion} (protocol ${era.protocolVersion})`}
          </code>
        </div>
        <p className="hint">
          Pre-fork heads report <code>v8</code>. After <code>yarn env:fork</code> the head reports <code>v9</code>, and
          a contract deployed before the boundary keeps being called through its pre-fork artifact.
        </p>
        <button
          onClick={refreshEra}
          disabled={connectedAPI === null || isReading}
          className="btn btn-outline btn-block"
        >
          {isReading ? 'Reading...' : 'Re-read network era'}
        </button>
      </div>
    </section>
  );
}
