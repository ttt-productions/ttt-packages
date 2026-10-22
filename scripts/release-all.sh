#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:-patch}"

ALL=()
for manifest in packages/*/package.json; do
  ALL+=("$(basename "$(dirname "$manifest")")")
done

exec ./scripts/release-multiple.sh "${ALL[@]}" "$BUMP"
