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

import { describe, expect, test } from 'vitest';

import { uint8ArrayToHex } from './hex';

describe('uint8ArrayToHex', () => {
  test('pads each byte to two lower-case digits', () => {
    const bytes = new Uint8Array([0x00, 0x0f, 0x7a, 0xff]);

    const hex = uint8ArrayToHex(bytes);

    // Without the pad, 0x0f would render as "f" and shift every digit after it.
    expect(hex).toBe('000f7aff');
  });
});
