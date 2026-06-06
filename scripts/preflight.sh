#!/usr/bin/env bash
set -euo pipefail

echo "preflight: removing stale nested @ttt-productions node_modules..."
find packages -path "*/node_modules/@ttt-productions" -prune -exec rm -rf {} + 2>/dev/null || true

echo "preflight: removing dist/ folders..."
find packages -name "dist" -type d -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true

echo "preflight: removing tsbuildinfo caches..."
find packages -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete 2>/dev/null || true

echo "preflight: npm install..."
npm install

echo "preflight: npm run test:quiet (lint + build + typecheck + tsc -b --noEmit + test + schema; concise output)..."
# test:quiet runs the same gate as test:all but with one-line-per-stage output, plus a final schema
# stage that checks docs/generated/firestore-schema.{md,mmd} and AUTO-REGENERATES them if stale (it
# prints "regenerated" and still exits 0 — commit the regenerated docs). That replaces the old
# separate `generate-schema-docs.mjs --check` step here.
npm run test:quiet

echo "preflight: done"
