#!/usr/bin/env bash
set -euo pipefail

# release-all.sh — release every package. It hands every package folder to
# release-multiple.sh, which preflights once and releases them in
# dependency-safe order.
#
# Usage:
#   ./scripts/release-all.sh           # patch bump
#   ./scripts/release-all.sh minor     # minor bump
#   ./scripts/release-all.sh major     # major bump

BUMP="${1:-patch}"

ALL=()
for manifest in packages/*/package.json; do
  ALL+=("$(basename "$(dirname "$manifest")")")
done

exec ./scripts/release-multiple.sh "${ALL[@]}" "$BUMP"
