#!/usr/bin/env bash
set -euo pipefail

echo "🧹 Cleaning build artifacts (SAFE)..."

find packages -type d -name dist -prune -exec rm -rf {} +
find packages -maxdepth 2 -type d -name lib -prune -exec rm -rf {} +

find packages -type f -name "*.tsbuildinfo" -delete

rm -rf node_modules
rm -f package-lock.json

echo "📦 Installing dependencies fresh..."
npm install

echo "🏗️  Building packages in dependency-safe order (per root package.json)..."
npm run build

echo "✅ All packages built successfully"