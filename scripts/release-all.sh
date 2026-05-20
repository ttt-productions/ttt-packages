#!/usr/bin/env bash
set -euo pipefail

# release-all.sh — bump version, build, commit, tag, push for every package
# in the workspace. The actual `npm publish` happens in GitHub Actions
# (.github/workflows/publish.yml) when a tag matching `*-v*.*.*` is pushed.
#
# Each call to release-package.sh:
#   1. runs `npm run preflight` (nukes dist + node_modules @ttt-productions
#      shadows, then npm install + full workspace build)
#   2. bumps the package version
#   3. commits + tags + pushes to origin/main + pushes the tag
#   4. GitHub Actions takes the tag, builds, publishes with --access public
#
# Because preflight runs at the start of every release-package.sh call,
# there is NO need for explicit `npm install` calls between releases here —
# preflight already handles it.
#
# Order mirrors the root `package.json` build chain. When packages are added,
# renamed, or removed, update BOTH this file and root package.json build chain
# (and bump the count comment below).
#
# 21 packages total (as of Cut 3c Part 3a — added chat-schemas).
#
# Usage:
#   ./scripts/release-all.sh           # patch bump
#   ./scripts/release-all.sh minor     # minor bump
#   ./scripts/release-all.sh major     # major bump

BUMP="${1:-patch}"

# ---------------------------------------------------------------------------
# Tier 0 — generic, zero @ttt-productions/* deps
# ---------------------------------------------------------------------------
./scripts/release-package.sh @ttt-productions/firebase-helpers  packages/firebase-helpers  "$BUMP"
./scripts/release-package.sh @ttt-productions/ui-core           packages/ui-core           "$BUMP"
./scripts/release-package.sh @ttt-productions/theme-core        packages/theme-core        "$BUMP"
./scripts/release-package.sh @ttt-productions/query-core        packages/query-core        "$BUMP"
./scripts/release-package.sh @ttt-productions/monitoring-core   packages/monitoring-core   "$BUMP"
./scripts/release-package.sh @ttt-productions/media-schemas     packages/media-schemas     "$BUMP"
./scripts/release-package.sh @ttt-productions/chat-schemas      packages/chat-schemas      "$BUMP"

# ---------------------------------------------------------------------------
# report-core — must release BEFORE ttt-core (ttt-core depends on report-core)
# ---------------------------------------------------------------------------
./scripts/release-package.sh @ttt-productions/report-core       packages/report-core       "$BUMP"

# ---------------------------------------------------------------------------
# Application data
# ---------------------------------------------------------------------------
./scripts/release-package.sh @ttt-productions/ttt-core          packages/ttt-core          "$BUMP"

# ---------------------------------------------------------------------------
# Tier 1 — depend on Tier 0
# ---------------------------------------------------------------------------
./scripts/release-package.sh @ttt-productions/mobile-core       packages/mobile-core       "$BUMP"
./scripts/release-package.sh @ttt-productions/media-viewer      packages/media-viewer      "$BUMP"
./scripts/release-package.sh @ttt-productions/file-input        packages/file-input        "$BUMP"
./scripts/release-package.sh @ttt-productions/auth-core         packages/auth-core         "$BUMP"
./scripts/release-package.sh @ttt-productions/upload-core       packages/upload-core       "$BUMP"

# ---------------------------------------------------------------------------
# Tier 2 — depends on Tier 1
# ---------------------------------------------------------------------------
./scripts/release-package.sh @ttt-productions/upload-ui         packages/upload-ui         "$BUMP"
./scripts/release-package.sh @ttt-productions/media-processing-core packages/media-processing-core "$BUMP"

# ---------------------------------------------------------------------------
# Tier 3 — depends on Tier 2 (chat-core depends on upload-ui)
# ---------------------------------------------------------------------------
./scripts/release-package.sh @ttt-productions/chat-core         packages/chat-core         "$BUMP"

# ---------------------------------------------------------------------------
# Remaining packages — order matches root package.json build chain tail
# ---------------------------------------------------------------------------
./scripts/release-package.sh @ttt-productions/notification-core packages/notification-core "$BUMP"
./scripts/release-package.sh @ttt-productions/rate-limit-core   packages/rate-limit-core   "$BUMP"
./scripts/release-package.sh @ttt-productions/audit-core        packages/audit-core        "$BUMP"
./scripts/release-package.sh @ttt-productions/moderation-core   packages/moderation-core   "$BUMP"

echo "✅ Done: released all 21 packages ($BUMP)"