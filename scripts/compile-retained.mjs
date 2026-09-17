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

// Builds the retained-era twin: the same `.compact` source the current artifact is built from,
// compiled with the PRE-fork toolchain, so the dApp can call a contract deployed before the fork.
//
// The twin is a second artifact rather than a replacement because the two eras' contract modules
// demand different Compact runtimes. midnight-js solves that with isolated installs per era; a
// browser bundle has one install, so the twin is pointed at the runtime copy the framework already
// carries under the `compact-runtime-ledger8` alias. That rewrite is the whole reason this script
// exists rather than a second `run-compactc` line in package.json: without it the twin's types
// resolve to the current runtime, its circuits appear to return the current era's `CircuitResults`,
// and the retained overloads of `findDeployedContract` / `submitCallTx` stop matching.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const RETAINED_COMPILER = '0.31.1';
const SOURCE = 'src/contract/contracts/token-transfers.compact';
const TARGET = 'src/contract/compiled/token-transfers-v8';
const REWRITTEN_FILES = ['contract/index.js', 'contract/index.d.ts'];

const CURRENT_RUNTIME_SPECIFIER = "'@midnight-ntwrk/compact-runtime'";
const RETAINED_RUNTIME_SPECIFIER = "'compact-runtime-ledger8'";

// The release coordinates are the ones `.envrc` sets for the current compiler; they are the same
// for 0.31.1.
const compilerEnv = { ...process.env, COMPACTC_VERSION: RETAINED_COMPILER };

const run = (args) => execFileSync('yarn', args, { stdio: 'inherit', env: compilerEnv });

run(['fetch-compactc']);
run(['run-compactc', SOURCE, TARGET]);

for (const file of REWRITTEN_FILES) {
  const target = path.join(TARGET, file);
  const before = readFileSync(target, 'utf8');
  const after = before.replaceAll(CURRENT_RUNTIME_SPECIFIER, RETAINED_RUNTIME_SPECIFIER);
  if (after === before) {
    throw new Error(`${target} does not import ${CURRENT_RUNTIME_SPECIFIER}; the generated shape changed`);
  }
  writeFileSync(target, after);
}

process.stdout.write(`Retained twin built with compactc ${RETAINED_COMPILER} and pinned to the retained runtime\n`);
