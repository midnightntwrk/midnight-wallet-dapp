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

import { test, expect } from '@playwright/test';
import { injectMockWalletScript } from './mocks/mockWallet';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });
});

test.describe('App Load', () => {
  test('displays title and header', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Midnight/i);
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Wallet Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(injectMockWalletScript());
  });

  test('detects mock wallet', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.status-badge')).toContainText('Wallet Detected');
    await expect(page.locator('.activity-log')).toContainText('Found 1 wallet API(s): Mock Wallet');
  });

  test('connects to wallet successfully', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.status-badge')).toContainText('Wallet Detected');

    await page.click('button:has-text("Connect Wallet")');

    await expect(page.locator('.status-badge')).toHaveAttribute('data-connected', 'true');
    await expect(page.locator('.status-badge')).toContainText('Connected');
    await expect(page.locator('.activity-log')).toContainText('Wallet connected successfully');
  });

  test('displays wallet info after connection', async ({ page }) => {
    await page.goto('/');

    await page.click('button:has-text("Connect Wallet")');

    const walletInfo = page.locator('.wallet-section').first().locator('.network-info');
    await expect(walletInfo).toContainText('Network:');
    await expect(walletInfo).toContainText('Wallet: Mock Wallet');
  });

  test('can disconnect wallet', async ({ page }) => {
    await page.goto('/');

    await page.click('button:has-text("Connect Wallet")');
    await expect(page.locator('.status-badge')).toContainText('Connected');

    await page.click('button:has-text("Disconnect")');

    await expect(page.locator('.status-badge')).toContainText('Wallet Detected');
    await expect(page.locator('.activity-log')).toContainText('Disconnected');
  });
});

// The closest the contract path gets to testable without a chain: no indexer, no proof server and no
// funded wallet are involved in deciding whether an action is reachable at all. These pin the button
// gating, which is what actually stops a user calling a circuit before there is a contract to call.
test.describe('Contract action gating', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(injectMockWalletScript());
  });

  test('offers deploy only once a wallet is connected', async ({ page }) => {
    await page.goto('/');
    const deploy = page.locator('button:has-text("Deploy Contract")');

    await expect(deploy).toBeDisabled();

    await page.click('button:has-text("Connect Wallet")');
    await expect(page.locator('.status-badge')).toContainText('Connected');
    await expect(deploy).toBeEnabled();
  });

  test('refuses every circuit call while no contract is open', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Connect Wallet")');
    await expect(page.locator('.status-badge')).toContainText('Connected');

    // A connected wallet is not enough: each of these needs a deployed or joined contract, and the
    // contract address stays blank until there is one.
    const contractAddress = page.locator('.info-box', { hasText: 'Contract Address:' }).locator('code.address');
    await expect(contractAddress).toHaveText('—');
    // Every circuit-call button, found by the class they share rather than by label, so a new one
    // added to either card is covered without editing this test.
    const circuitButtons = page.locator('button.btn-accent');
    const count = await circuitButtons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(circuitButtons.nth(i)).toBeDisabled();
    }
  });

  test('keeps the era selector answerable before anything is deployed', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Connect Wallet")');

    // Both eras must remain offered: which one a user needs depends on when their contract was
    // deployed, not on where the network head is.
    const options = await page.locator('select#contractEra option').allTextContents();
    expect(options.join(' ')).toContain('ledger v9');
    expect(options.join(' ')).toContain('ledger v8');
  });
});
