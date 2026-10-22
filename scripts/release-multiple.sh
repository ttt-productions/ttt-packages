#!/usr/bin/env bash
set -euo pipefail

RELEASE_ORDER=()
while IFS= read -r name; do
  RELEASE_ORDER+=("${name%$'\r'}")
done < <(node scripts/package-order.mjs)
if [[ ${#RELEASE_ORDER[@]} -eq 0 ]]; then
  echo "❌ Could not read the package order from scripts/package-order.mjs."
  exit 1
fi

BUMP="patch"
REQUESTED=()
for arg in "$@"; do
  case "$arg" in
    patch) BUMP="$arg" ;;
    minor|major)
      echo "❌ Refusing '$arg': every release is a patch bump until v1 (RULE-STD-ARCH-208)."
      exit 1
      ;;
    *) REQUESTED+=("$arg") ;;
  esac
done

if [[ ${#REQUESTED[@]} -eq 0 ]]; then
  echo "Usage: ./scripts/release-multiple.sh <pkg> [<pkg> ...] patch"
  echo "  e.g. ./scripts/release-multiple.sh ttt-core auth-core notification-core patch"
  exit 1
fi

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

npm run preflight
export SKIP_PREFLIGHT=1

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
