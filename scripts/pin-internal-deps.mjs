#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'devDependencies'];
const SCOPE = '@ttt-productions/';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`[pin-internal-deps] ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const pkgDirArg = args.find((a) => !a.startsWith('--'));
const mode = args.includes('--check') ? 'check' : args.includes('--restore') ? 'restore' : 'pin';

if (!pkgDirArg) fail('Usage: pin-internal-deps.mjs <pkgDir> [--check|--restore]');

const pkgDir = resolve(REPO_ROOT, pkgDirArg);
const pkgJsonPath = join(pkgDir, 'package.json');
const bakPath = join(pkgDir, 'package.json.pin-bak');
if (!existsSync(pkgJsonPath)) fail(`No package.json at ${pkgDir}`);

function loadInternalVersions() {
  const map = new Map();
  const pkgsDir = join(REPO_ROOT, 'packages');
  for (const folder of readdirSync(pkgsDir)) {
    const pj = join(pkgsDir, folder, 'package.json');
    if (!existsSync(pj)) continue;
    const json = JSON.parse(readFileSync(pj, 'utf8'));
    if (json.name && json.version) map.set(json.name, json.version);
  }
  return map;
}

if (mode === 'restore') {
  if (!existsSync(bakPath)) fail(`No backup at ${bakPath}; nothing to restore`);
  copyFileSync(bakPath, pkgJsonPath);
  console.log(`[pin-internal-deps] restored ${pkgJsonPath} from backup`);
  process.exit(0);
}

const raw = readFileSync(pkgJsonPath, 'utf8');
const json = JSON.parse(raw);
const versions = loadInternalVersions();

if (mode === 'check') {
  const survivors = [];
  for (const field of DEP_FIELDS) {
    const deps = json[field];
    if (!deps) continue;
    for (const [dep, range] of Object.entries(deps)) {
      if (dep.startsWith(SCOPE) && range === '*') survivors.push(`${field} › ${dep}`);
    }
  }
  if (survivors.length > 0) {
    fail(`internal "*" ranges survived into ${json.name} manifest:\n  ${survivors.join('\n  ')}`);
  }
  console.log(`[pin-internal-deps] ${json.name}: OK — no internal "*" ranges`);
  process.exit(0);
}

const pinned = [];
const missing = [];
for (const field of DEP_FIELDS) {
  const deps = json[field];
  if (!deps) continue;
  for (const [dep, range] of Object.entries(deps)) {
    if (!dep.startsWith(SCOPE) || range !== '*') continue;
    const version = versions.get(dep);
    if (!version) {
      missing.push(`${field} › ${dep}`);
      continue;
    }
    const pinnedRange = `^${version}`;
    deps[dep] = pinnedRange;
    pinned.push(`${field} › ${dep} -> ${pinnedRange}`);
  }
}

if (missing.length > 0) {
  fail(`could not resolve internal version for:\n  ${missing.join('\n  ')}`);
}

if (pinned.length === 0) {
  console.log(`[pin-internal-deps] ${json.name}: no internal "*" ranges to pin`);
  process.exit(0);
}

copyFileSync(pkgJsonPath, bakPath);
// 2-space indent and a trailing newline match npm's own writes.
writeFileSync(pkgJsonPath, `${JSON.stringify(json, null, 2)}\n`);
console.log(`[pin-internal-deps] ${json.name}: pinned\n  ${pinned.join('\n  ')}`);
