#!/usr/bin/env node
// Rewrite a package's internal @ttt-productions/* dependency ranges from "*"
// to a concrete range at PACK/PUBLISH time, across dependencies,
// peerDependencies, AND devDependencies:
//   - dependencies / devDependencies → EXACT current version ("1.2.3")
//   - peerDependencies               → CARET range ("^1.2.3")
//
// WHY exact for deps/devDeps: source manifests legitimately use "*" so workspace
// dev resolves to the local package. But a packed/published tarball with "*" lets
// a consumer resolve an incompatible newer internal version, so we pin those exact.
//
// WHY caret for peerDeps: a peer dependency is SUPPLIED by the consuming app, which
// hoists a single copy. Exact-pinning a peer means bumping that internal package in
// isolation trips a peerOptional version-mismatch warning in every dependent until it
// is also republished. A caret range (^x.y.z) lets the app provide a compatible
// patch/minor without the warning, while still rejecting a breaking major/minor (0.x
// caret pins the minor). Peer compatibility is a range by nature, not an exact match.
//
// This runs in the publish pipeline (.github/workflows/publish.yml) right
// before `npm publish`, where the checkout is ephemeral, so the rewrite is
// discarded after publish and committed source keeps "*". A `.pin-bak` backup
// is written so `--restore` can revert in a local/non-ephemeral run.
//
// Usage:
//   node scripts/pin-internal-deps.mjs <pkgDir>            # rewrite <pkgDir>/package.json in place
//   node scripts/pin-internal-deps.mjs <pkgDir> --check    # exit 1 if any internal "*" remains (no write)
//   node scripts/pin-internal-deps.mjs <pkgDir> --restore  # restore <pkgDir>/package.json from .pin-bak
//
// dependencies/devDependencies use exact pins ("1.2.3"); peerDependencies use caret
// ranges ("^1.2.3") so an app can supply a compatible patch/minor without a warning.

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

// Build a map of internal package name -> exact current version.
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

// mode === 'pin'
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
    // Peer deps are supplied by the consuming app and must tolerate a compatible
    // patch/minor; everything else pins exact.
    const pinnedRange = field === 'peerDependencies' ? `^${version}` : version;
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
// Preserve trailing newline; 2-space indent matches npm's own writes.
writeFileSync(pkgJsonPath, `${JSON.stringify(json, null, 2)}\n`);
console.log(`[pin-internal-deps] ${json.name}: pinned\n  ${pinned.join('\n  ')}`);
