#!/usr/bin/env bash
set -euo pipefail

echo "🧹 Cleaning build artifacts (SAFE)..."

# Only remove build output folders:
# - dist anywhere under packages
# - lib ONLY when it's the compiled output folder at package root (packages/*/lib)
find packages -type d -name dist -prune -exec rm -rf {} +
find packages -maxdepth 2 -type d -name lib -prune -exec rm -rf {} +

# TS incremental artifacts
find packages -type f -name "*.tsbuildinfo" -delete

# Fresh install (safe when debugging build order)
rm -rf node_modules
rm -f package-lock.json

echo "📦 Installing dependencies fresh..."
npm install

echo "🏗️  Building packages in dependency-safe order..."

npm run build -w @ttt-productions/ui-core
npm run build -w @ttt-productions/theme-core
npm run build -w @ttt-productions/query-core
npm run build -w @ttt-productions/monitoring-core
npm run build -w @ttt-productions/firebase-helpers

npm run build -w @ttt-productions/media-contracts
npm run build -w @ttt-productions/media-viewer
npm run build -w @ttt-productions/chat-core
npm run build -w @ttt-productions/file-input

npm run build -w @ttt-productions/auth-core
npm run build -w @ttt-productions/mobile-core

npm run build -w @ttt-productions/upload-core
npm run build -w @ttt-productions/media-processing-core
npm run build -w @ttt-productions/notification-core
npm run build -w @ttt-productions/report-core

echo "✅ All packages built successfully"
