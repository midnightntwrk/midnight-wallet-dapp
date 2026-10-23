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

import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { ZkArtifactIntegrityError } from '@midnight-ntwrk/midnight-js/utils';

// The two artifacts are served the way the dApp serves them — over HTTP, from the directory the
// compiler wrote — so these exercise the real integrity path rather than re-implementing the hash
// check. `verify` is set to what `buildProvidersFromConnectedAPI` passes for each era.
const COMPILED_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../contract/compiled');

const CIRCUITS = [
  'mintAndReceive',
  'sendToUser',
  'receiveTokens',
  'receiveNightTokens',
  'sendNightTokensToUser',
  'receiveShieldedTokens',
  'sendShieldedToUser',
  'mintShieldedToSelf',
  'mintAndSendShielded',
] as const;

/** Flips one byte of whatever this path serves, to prove verification is not vacuous. */
let corrupt: string | undefined;

let server: Server;
let origin: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = path.join(COMPILED_ROOT, rel);
    if (!file.startsWith(COMPILED_ROOT) || !existsSync(file)) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    if (corrupt !== undefined && rel.endsWith(corrupt)) {
      const bytes = readFileSync(file);
      bytes[0] ^= 0xff;
      res.end(bytes);
      return;
    }
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const providerFor = (artifact: string, verify: 'require' | 'require-if-present') =>
  new FetchZkConfigProvider<string>(`${origin}/${artifact}`, { verify });

describe('current-era artifact', () => {
  test('declares the runtime its compiler is paired with', async () => {
    const runtimeVersion = await providerFor('token-transfers', 'require').getArtifactRuntimeVersion();

    expect(runtimeVersion).toBe('0.20.0');
  });

  test('serves every circuit a verifier key the manifest vouches for', async () => {
    const provider = providerFor('token-transfers', 'require');

    const keys = await Promise.all(CIRCUITS.map((circuitId) => provider.getVerifierKey(circuitId)));

    expect(keys.every((key) => key.length > 0)).toBe(true);
  });

  test('refuses a verifier key the manifest does not vouch for', async () => {
    corrupt = 'mintAndReceive.verifier';
    try {
      await expect(providerFor('token-transfers', 'require').getVerifierKey('mintAndReceive')).rejects.toThrow(
        ZkArtifactIntegrityError
      );
    } finally {
      corrupt = undefined;
    }
  });
});

describe('retained-era artifact', () => {
  test('declares the pre-fork runtime, which the current one cannot run', async () => {
    const runtimeVersion = await providerFor('token-transfers-v8', 'require-if-present').getArtifactRuntimeVersion();

    expect(runtimeVersion).toBe('0.16.0');
  });

  test('serves every circuit a verifier key once the absent manifest is waived', async () => {
    const provider = providerFor('token-transfers-v8', 'require-if-present');

    const keys = await Promise.all(CIRCUITS.map((circuitId) => provider.getVerifierKey(circuitId)));

    expect(keys.every((key) => key.length > 0)).toBe(true);
  });

  test('is refused under the fail-closed default, which is why the waiver exists', async () => {
    await expect(providerFor('token-transfers-v8', 'require').getVerifierKey('mintAndReceive')).rejects.toThrow(
      ZkArtifactIntegrityError
    );
  });
});
