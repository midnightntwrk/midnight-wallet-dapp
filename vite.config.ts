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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      process: 'process/browser',
      buffer: 'buffer',
      util: 'util',
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
    },
  },
  // ❌ remove topLevelAwait() from plugins:
  plugins: [
    react(),
    wasm(),
    viteStaticCopy({
      targets: [
        {
          src: 'src/contract/*',
          dest: 'contract',
        },
      ],
    }),
    {
      name: 'custom-404',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Only apply to /contract/* paths - return 404 if file doesn't exist
          if (req.url?.startsWith('/contract/')) {
            const filePath = path.join(server.config.root, 'src', req.url);

            if (!fs.existsSync(filePath)) {
              res.statusCode = 404;
              res.end('404 Not Found');
              return;
            }
          }
          next();
        });
      },
    },
  ],
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },
  assetsInclude: ['**/*.wasm'],
  publicDir: 'public',
  server: {
    fs: {
      allow: ['..'],
    },
  },
});
