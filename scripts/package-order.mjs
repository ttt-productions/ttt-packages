#!/usr/bin/env node
// Prints every package folder, one per line, in dependency-safe order: each package after every
// internal @ttt-productions/* package it declares. The root package.json `build` chain is the one
// place that order is written. release-multiple.sh and release-all.sh release in the order this
// prints, and test/boundary/package-order.test.ts proves the chain against every package manifest.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { scripts } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const order = [...scripts.build.matchAll(/npm run build -w @ttt-productions\/([a-z0-9-]+)/g)].map((m) => m[1]);

if (order.length === 0) {
  console.error('package-order: the root package.json build chain names no @ttt-productions/* package');
  process.exit(1);
}
console.log(order.join('\n'));
