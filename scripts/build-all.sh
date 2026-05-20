#!/usr/bin/env bash
set -euo pipefail

# build-all.sh — clean rebuild of the entire workspace.
#
# Delegates the actual build order to root `package.json`'s `build` script
# so this file does NOT have to track the package list. Any time a package
# is added / renamed / removed, update the root build chain only; this
# script keeps working unchanged.

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

echo "🏗️  Building packages in dependency-safe order (per root package.json)..."
npm run build

echo "✅ All packages built successfully"