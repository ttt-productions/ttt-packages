#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:-patch}"

# Install dependencies
npm install

# Clean all packages
npm run clean

# Build in dependency-safe order (lowest-level first)
npm run build -w @ttt-productions/ui-core
npm run build -w @ttt-productions/theme-core
npm run build -w @ttt-productions/query-core
npm run build -w @ttt-productions/monitoring-core
npm run build -w @ttt-productions/firebase-helpers
npm run build -w @ttt-productions/mobile-core

# Media + chat (depend on firebase-helpers, mobile-core)
npm run build -w @ttt-productions/media-contracts
npm run build -w @ttt-productions/media-viewer
npm run build -w @ttt-productions/chat-core
npm run build -w @ttt-productions/file-input

# Auth (depends on previous)
npm run build -w @ttt-productions/auth-core

# Advanced packages
npm run build -w @ttt-productions/upload-core
npm run build -w @ttt-productions/media-processing-core
npm run build -w @ttt-productions/notification-core
npm run build -w @ttt-productions/report-core

# Release foundational packages first
./scripts/release-package.sh @ttt-productions/ui-core packages/ui-core "$BUMP"
./scripts/release-package.sh @ttt-productions/theme-core packages/theme-core "$BUMP"
./scripts/release-package.sh @ttt-productions/query-core packages/query-core "$BUMP"
./scripts/release-package.sh @ttt-productions/monitoring-core packages/monitoring-core "$BUMP"
./scripts/release-package.sh @ttt-productions/firebase-helpers packages/firebase-helpers "$BUMP"
./scripts/release-package.sh @ttt-productions/mobile-core packages/mobile-core "$BUMP"

# Install newly published packages before continuing
npm install

./scripts/release-package.sh @ttt-productions/media-contracts packages/media-contracts "$BUMP"

# Install media-contracts before packages that depend on it
npm install

./scripts/release-package.sh @ttt-productions/media-viewer packages/media-viewer "$BUMP"
./scripts/release-package.sh @ttt-productions/chat-core packages/chat-core "$BUMP"
./scripts/release-package.sh @ttt-productions/file-input packages/file-input "$BUMP"

./scripts/release-package.sh @ttt-productions/auth-core packages/auth-core "$BUMP"

./scripts/release-package.sh @ttt-productions/upload-core packages/upload-core "$BUMP"
./scripts/release-package.sh @ttt-productions/media-processing-core packages/media-processing-core "$BUMP"
./scripts/release-package.sh @ttt-productions/notification-core packages/notification-core "$BUMP"
./scripts/release-package.sh @ttt-productions/report-core packages/report-core "$BUMP"

echo "✅ Done: released all packages ($BUMP)"