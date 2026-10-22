#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { scripts } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const order = [...scripts.build.matchAll(/npm run build -w @ttt-productions\/([a-z0-9-]+)/g)].map(
  (m) => m[1],
);

if (order.length === 0) {
  console.error(
    'package-order: the root package.json build chain names no @ttt-productions/* package',
  );
  process.exit(1);
}
console.log(order.join('\n'));
