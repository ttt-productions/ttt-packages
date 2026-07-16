#!/usr/bin/env bash
set -euo pipefail

# release-multiple.sh — release a CHOSEN SUBSET of packages in one shot.
#
# Same machinery as release-all.sh, but you pass the packages you want by their
# short folder name (no @ttt-productions/ prefix, no packages/ prefix). The
# heavy preflight (npm run test:quiet — lint/build/typecheck/tsc -b/vitest) runs
# ONCE up front, then each package is released with SKIP_PREFLIGHT=1, so you
# don't pay the build/test cost per package.
#
# The bump (patch|minor|major) is optional and may be the LAST argument; it
# defaults to patch. The packages are ALWAYS released in the canonical
# dependency-safe order below (mirrors release-all.sh), regardless of the order
# you type them — so a dep always publishes before its dependents.
#
# Usage:
#   ./scripts/release-multiple.sh ttt-core auth-core notification-core         # patch
#   ./scripts/release-multiple.sh ttt-core auth-core notification-core minor
#   ./scripts/release-multiple.sh minor ttt-core auth-core                     # bump can lead too
#
# When packages are added/renamed/removed, update RELEASE_ORDER below to match
# release-all.sh / the root package.json build chain.

# ---------------------------------------------------------------------------
# Canonical dependency-safe release order (folder names under packages/).
# Keep in sync with scripts/release-all.sh.
# ---------------------------------------------------------------------------
RELEASE_ORDER=(
  # Tier 0 — generic, zero @ttt-productions/* deps
  edge-protocol-core
  realtime-core
  firebase-helpers
  ui-core
  theme-core
  query-core
  monitoring-core
  media-schemas
  chat-schemas
  # report-core + audit-core + notification-core — must release BEFORE ttt-core
  report-core
  audit-core
  notification-core
  # Application data
  ttt-core
  # Tier 1 — depend on Tier 0
  mobile-core
  media-viewer
  file-input
  auth-core
  upload-core
  # Tier 2 — depends on Tier 1
  upload-ui
  media-processing-core
  # Tier 3 — chat
  chat-core
  chat-react
  # Remaining
  rate-limit-core
  moderation-core
)

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
