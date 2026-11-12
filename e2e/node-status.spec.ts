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

import { test, expect, type Page } from '@playwright/test';
import { injectMockWalletScript } from './mocks/mockWallet';

/**
 * The happy path needs a real node, because `ApiPromise` performs a full metadata
 * handshake that cannot be meaningfully faked. Bring one up with `yarn env:up`.
 * Without it those tests skip; the degradation tests always run, which is what CI
 * (no node - see .github/workflows/ci.yml) actually exercises.
 */
const NODE_HEALTH_URL = 'http://localhost:9944/health';

async function nodeIsUp(): Promise<boolean> {
  try {
    const res = await fetch(NODE_HEALTH_URL, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function connect(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.status-badge')).toContainText('Wallet Detected');
  await page.click('button:has-text("Connect Wallet")');
  await expect(page.locator('.status-badge')).toHaveAttribute('data-connected', 'true');
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  await page.addInitScript(injectMockWalletScript());
});

test.describe('Node direct access', () => {
  test('surfaces the node URI the wallet advertised', async ({ page }) => {
    await connect(page);

    // substrateNodeUri is part of the connector Configuration but no dapp has ever
    // consumed it; showing it is the first half of proving it is real.
    await expect(page.getByTestId('node-uri')).toContainText('localhost:9944');
    await expect(page.getByTestId('node-status')).toHaveText('idle');
  });

  test('degrades to unreachable rather than throwing when no node answers', async ({ page }) => {
    test.skip(await nodeIsUp(), 'a real node is running, so it cannot be unreachable');

    await connect(page);
    await page.click('button:has-text("Query Node")');

    await expect(page.getByTestId('node-status')).toHaveText('unreachable', { timeout: 30_000 });
    await expect(page.locator('.activity-log')).toContainText('Node unreachable');
    await expect(page.getByTestId('node-chain')).toHaveText('—');
  });

  test('reads chain, version, peers and finalized height straight from the node', async ({ page }) => {
    test.skip(!(await nodeIsUp()), 'needs a local node: yarn env:up');

    await connect(page);
    await page.click('button:has-text("Query Node")');

    await expect(page.getByTestId('node-status')).toHaveText('connected', { timeout: 60_000 });
    await expect(page.getByTestId('node-chain')).not.toHaveText('—');
    await expect(page.getByTestId('node-version')).not.toHaveText('—');
    await expect(page.getByTestId('node-finalized')).toHaveText(/^[\d,]+$/);
    await expect(page.getByTestId('node-peers')).toHaveText(/^\d+$/);
  });

  test('reads the midnight-specific RPC methods', async ({ page }) => {
    test.skip(!(await nodeIsUp()), 'needs a local node: yarn env:up');

    await connect(page);
    await page.click('button:has-text("Query Node")');

    await expect(page.getByTestId('node-status')).toHaveText('connected', { timeout: 60_000 });
    // midnight_ledgerVersion / midnight_apiVersions are custom RPCs, so they only
    // resolve if the custom `rpc` definitions were registered with ApiPromise.
    await expect(page.getByTestId('node-ledger-version')).not.toHaveText('—');
    await expect(page.getByTestId('node-api-versions')).not.toHaveText('—');
  });
});
