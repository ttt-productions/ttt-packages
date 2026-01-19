#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:-patch}"

# Build once (recommended)
npm install
npm run clean
npm run build

# Release in dependency-safe order (lowest-level first)
./scripts/release-package.sh @ttt-productions/ui-core packages/ui-core "$BUMP"
./scripts/release-package.sh @ttt-productions/theme-core packages/theme-core "$BUMP"
./scripts/release-package.sh @ttt-productions/query-core packages/query-core "$BUMP"
./scripts/release-package.sh @ttt-productions/monitoring-core packages/monitoring-core "$BUMP"
./scripts/release-package.sh @ttt-productions/firebase-helpers packages/firebase-helpers "$BUMP"

# Media + chat
./scripts/release-package.sh @ttt-productions/media-contracts packages/media-contracts "$BUMP"
./scripts/release-package.sh @ttt-productions/media-viewer packages/media-viewer "$BUMP"
./scripts/release-package.sh @ttt-productions/chat-core packages/chat-core "$BUMP"
./scripts/release-package.sh @ttt-productions/file-input packages/file-input "$BUMP"

# Auth + mobile
./scripts/release-package.sh @ttt-productions/auth-core packages/auth-core "$BUMP"
./scripts/release-package.sh @ttt-productions/mobile-core packages/mobile-core "$BUMP"

# Future packages (uncomment once they exist)
./scripts/release-package.sh @ttt-productions/upload-core packages/upload-core "$BUMP"
./scripts/release-package.sh @ttt-productions/media-processing-core packages/media-processing-core "$BUMP"

echo "✅ Done: released all packages ($BUMP)"
