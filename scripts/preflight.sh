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

echo "preflight: npm run build..."
npm run build

echo "preflight: done"
