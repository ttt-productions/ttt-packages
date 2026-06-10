#!/usr/bin/env bash
set -euo pipefail

# Releases tag the COMMITTED tree; CI builds from the tag. If tracked files are
# dirty, the published package won't match the working copy. package-lock.json
# is exempt: the npm install below may legitimately refresh it, and
# release-package.sh commits it with the release.
echo "preflight: checking for uncommitted tracked changes..."
DIRTY=$(git status --porcelain --untracked-files=no | grep -v 'package-lock\.json' || true)
if [[ -n "$DIRTY" ]]; then
  echo "preflight: FAIL — tracked files have uncommitted changes; a release would tag a tree that doesn't match your working copy:"
  echo "$DIRTY"
  echo "Commit (or stash) these first, then re-run."
  exit 1
fi

echo "preflight: removing stale nested @ttt-productions node_modules..."
find packages -path "*/node_modules/@ttt-productions" -prune -exec rm -rf {} + 2>/dev/null || true

echo "preflight: removing dist/ folders..."
find packages -name "dist" -type d -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true

echo "preflight: removing tsbuildinfo caches..."
find packages -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete 2>/dev/null || true

echo "preflight: npm install (sync package-lock.json with the manifests)..."
npm install

# npm install makes node_modules work but does NOT prove the lockfile is in
# sync with the manifests — publish CI runs `npm ci`, which hard-fails on any
# package.json/package-lock.json desync (this exact failure shipped a broken
# release batch on 2026-06-10; npm install had silently left a stale graph in
# the lock). `npm ci --dry-run` runs the same validation phase CI fails on,
# in seconds, without touching node_modules.
echo "preflight: npm ci --dry-run (validates package-lock.json sync exactly like publish CI)..."
if ! npm ci --dry-run >/dev/null 2>&1; then
  echo ""
  npm ci --dry-run 2>&1 | head -15 || true
  echo ""
  echo "preflight: FAIL — package-lock.json is out of sync with the manifests (publish CI's npm ci would fail the same way)."
  echo "Remedy: rm -rf node_modules package-lock.json && npm install, review the lockfile diff, commit it, then re-run the release."
  exit 1
fi

echo "preflight: npm run test:quiet (lint + build + typecheck + tsc -b --noEmit + test + schema; concise output)..."
# test:quiet runs the same gate as test:all but with one-line-per-stage output, plus a final schema
# stage that checks docs/generated/firestore-schema.{md,mmd} and AUTO-REGENERATES them if stale (it
# prints "regenerated" and still exits 0 — commit the regenerated docs). That replaces the old
# separate `generate-schema-docs.mjs --check` step here.
npm run test:quiet

# License sweep over third-party production deps — informational (never blocks a release; `|| true`).
# Surfaces any incoming copyleft/unknown license before it lands silently. --excludePrivatePackages
# drops our own private monorepo root (license-checker reports any `private: true` package as
# UNLICENSED regardless of its license field), so the summary stays focused on redistributed deps.
# Accepted licenses for published @ttt-productions/* deps: MIT, ISC, Apache-2.0, BSD-2-Clause,
# BSD-3-Clause, 0BSD, CC0-1.0, Unlicense, Python-2.0, BlueOak-1.0.0. Anything outside that set warrants
# a look. To make this enforcing later, swap to: --onlyAllow '<semicolon-list>'.
echo "preflight: license sweep (npx license-checker --production --excludePrivatePackages --summary; informational)..."
npx license-checker --production --excludePrivatePackages --summary || true

echo "preflight: done"
