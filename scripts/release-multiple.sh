#!/usr/bin/env bash
set -euo pipefail

# release-multiple.sh — release a CHOSEN SUBSET of packages in one shot.
#
# Pass the packages you want by their short folder name (no @ttt-productions/
# prefix, no packages/ prefix). The heavy preflight (scripts/preflight.sh, which
# ends with the full npm run test:quiet gate) runs ONCE up front, then each
# package is released with SKIP_PREFLIGHT=1, so you don't pay the build/test
# cost per package.
#
# The bump (patch|minor|major) is optional and may appear anywhere in the
# argument list; it defaults to patch. The packages are ALWAYS released in the
# dependency-safe order scripts/package-order.mjs prints, regardless of the
# order you type them — so a dep always publishes before its dependents.
#
# Usage:
#   ./scripts/release-multiple.sh ttt-core auth-core notification-core         # patch
#   ./scripts/release-multiple.sh ttt-core auth-core notification-core minor
#   ./scripts/release-multiple.sh minor ttt-core auth-core                     # bump can lead too

# ---------------------------------------------------------------------------
# Canonical dependency-safe release order (folder names under packages/).
# ---------------------------------------------------------------------------
RELEASE_ORDER=()
while IFS= read -r name; do
  RELEASE_ORDER+=("${name%$'\r'}")
done < <(node scripts/package-order.mjs)
if [[ ${#RELEASE_ORDER[@]} -eq 0 ]]; then
  echo "❌ Could not read the package order from scripts/package-order.mjs."
  exit 1
fi

# ---------------------------------------------------------------------------
# Parse args: collect package short-names, pull out an optional bump keyword
# (patch|minor|major) from anywhere in the list.
# ---------------------------------------------------------------------------
BUMP="patch"
REQUESTED=()
for arg in "$@"; do
  case "$arg" in
    patch|minor|major) BUMP="$arg" ;;
    *) REQUESTED+=("$arg") ;;
  esac
done

if [[ ${#REQUESTED[@]} -eq 0 ]]; then
  echo "Usage: ./scripts/release-multiple.sh <pkg> [<pkg> ...] [patch|minor|major]"
  echo "  e.g. ./scripts/release-multiple.sh ttt-core auth-core notification-core patch"
  exit 1
fi

# ---------------------------------------------------------------------------
# Validate every requested name: must be a known package folder with a
# package.json. Fail fast (before any release) on a typo.
# ---------------------------------------------------------------------------
in_release_order () {
  local needle="$1"
  for p in "${RELEASE_ORDER[@]}"; do
    [[ "$p" == "$needle" ]] && return 0
  done
  return 1
}

for name in "${REQUESTED[@]}"; do
  if ! in_release_order "$name"; then
    echo "❌ Unknown package: '$name' (not in the release order list)."
    echo "   Pass the folder name under packages/, e.g. ttt-core, auth-core, notification-core."
    exit 1
  fi
  [[ -f "packages/$name/package.json" ]] || {
    echo "❌ packages/$name/package.json not found."
    exit 1
  }
done

# ---------------------------------------------------------------------------
# Preflight ONCE for the whole run; each release-package.sh below skips its own.
# ---------------------------------------------------------------------------
npm run preflight
export SKIP_PREFLIGHT=1

# ---------------------------------------------------------------------------
# Release the requested packages, walking the canonical order so dependencies
# go before dependents no matter how they were typed.
# ---------------------------------------------------------------------------
RELEASED=()
for name in "${RELEASE_ORDER[@]}"; do
  for want in "${REQUESTED[@]}"; do
    if [[ "$name" == "$want" ]]; then
      ./scripts/release-package.sh "@ttt-productions/$name" "packages/$name" "$BUMP"
      RELEASED+=("$name")
      break
    fi
  done
done

echo "✅ Done: released ${#RELEASED[@]} package(s) ($BUMP): ${RELEASED[*]}"
