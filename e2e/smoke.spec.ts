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

import { test, expect } from '@playwright/test';
import { injectMockWalletScript } from './mocks/mockWallet';

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
    await expect(page.locator('.activity-log')).toContainText('Providers initialized');
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
