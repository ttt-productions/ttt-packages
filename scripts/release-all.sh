#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:-patch}"
if [[ "$BUMP" != "patch" ]]; then
  echo "❌ Refusing '$BUMP': every release is a patch bump until v1 (RULE-STD-ARCH-208). Usage: ./scripts/release-all.sh [patch]"
  exit 1
fi

ALL=()
for manifest in packages/*/package.json; do
  ALL+=("$(basename "$(dirname "$manifest")")")
done

exec ./scripts/release-multiple.sh "${ALL[@]}" "$BUMP"
