#!/usr/bin/env bash
set -euo pipefail

# package-lock.json is exempt: the npm install below may refresh it, and release-package.sh commits it.
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

# npm install can leave a lockfile desync that publish CI's `npm ci` hard-fails on;
# `npm ci --dry-run` runs that same validation without touching node_modules.
echo "preflight: npm ci --dry-run (validates package-lock.json sync exactly like publish CI)..."
if ! npm ci --dry-run >/dev/null 2>&1; then
  echo ""
  npm ci --dry-run 2>&1 | head -15 || true
  echo ""
  echo "preflight: FAIL — package-lock.json is out of sync with the manifests (publish CI's npm ci would fail the same way)."
  echo "Remedy: rm -rf node_modules package-lock.json && npm install, review the lockfile diff, commit it, then re-run the release."
  exit 1
fi

echo "preflight: npm run test:quiet (the full quiet gate; concise output)..."
# Check-only: this tree is the commit being released, and a write would publish formatting it lacks.
npm run test:quiet -- --format-check-only

# license-checker reports any `private: true` package as UNLICENSED, hence --excludePrivatePackages.
echo "preflight: license sweep (npx license-checker --production --excludePrivatePackages --summary; informational)..."
npx license-checker --production --excludePrivatePackages --summary || true

echo "preflight: done"
