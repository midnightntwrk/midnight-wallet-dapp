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

import { useEffect, useState } from 'react';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MidnightWindow = Window & { midnight?: Record<string, any>; cardano?: unknown };

const POLL_INTERVAL_MS = 500;
const MAX_POLL_ATTEMPTS = 40;

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

export interface UseWalletDetectionReturn {
  availableAPIs: InitialAPI[];
  isDetecting: boolean;
}

export function useWalletDetection(onLog?: (msg: string) => void): UseWalletDetectionReturn {
  const [availableAPIs, setAvailableAPIs] = useState<InitialAPI[]>([]);
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    const w = window as MidnightWindow;
    onLog?.('window.cardano=' + (typeof w.cardano !== 'undefined'));
    onLog?.('window.midnight=' + (typeof w.midnight !== 'undefined'));

    let attempts = 0;
    const intervalId = setInterval(() => {
      const apis = findInitialAPIs();
      if (apis.length > 0) {
        clearInterval(intervalId);
        setAvailableAPIs(apis);
        setIsDetecting(false);
        onLog?.(`Found ${apis.length} wallet API(s): ${apis.map((a) => a.name).join(', ')}`);
      } else if (++attempts > MAX_POLL_ATTEMPTS) {
        clearInterval(intervalId);
        setIsDetecting(false);
        onLog?.('No Midnight wallet detected after polling');
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [onLog]);

  return { availableAPIs, isDetecting };
}
