#!/usr/bin/env bash
set -euo pipefail

# Never pin internal deps here: publish CI pins them at pack time, and a pin here would commit it.

PKG="${1:?Usage: ./release-package.sh <pkgName> <pkgDir> [patch]}"
PKGDIR="${2:?Usage: ./release-package.sh <pkgName> <pkgDir> [patch]}"
BUMP="${3:-patch}"
if [[ "$BUMP" != "patch" ]]; then
  echo "❌ Refusing '$BUMP': every release is a patch bump until v1 (RULE-STD-ARCH-208)."
  exit 1
fi

# Stale nested node_modules or a cached dist can shadow the workspace symlinks.
if [[ "${SKIP_PREFLIGHT:-0}" != "1" ]]; then
  npm run preflight
fi

git fetch --tags origin

[[ -f "$PKGDIR/package.json" ]] || { echo "Bad PKGDIR: $PKGDIR (missing package.json)"; exit 1; }
NAME=$(node -p "require('./$PKGDIR/package.json').name")
[[ "$NAME" == "$PKG" ]] || { echo "PKG mismatch: PKGDIR has $NAME but you passed $PKG"; exit 1; }

PKGSLUG="$(basename "$PKGDIR")"

tag_exists_remote () {
  local tag="$1"
  git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null 2>&1
}

version_exists_npm () {
  local pkg="$1"
  local ver="$2"
  npm view "${pkg}@${ver}" version >/dev/null 2>&1
}

bump_once () {
  npm version "$BUMP" -w "$PKG" --no-git-tag-version >/dev/null
  VER=$(node -p "require('./$PKGDIR/package.json').version")
  TAG="${PKGSLUG}-v${VER}"
}

bump_once
while tag_exists_remote "$TAG" || version_exists_npm "$PKG" "$VER"; do
  bump_once
done

git add "$PKGDIR/package.json" package-lock.json
git commit -m "Release $PKGSLUG v$VER"

git fetch --tags origin

if tag_exists_remote "$TAG"; then
  echo "⚠️  Tag $TAG was just created remotely. Skipping push."
  git reset --soft HEAD~1
  exit 0
fi

git tag "$TAG"

git push origin main
git push origin "$TAG"

echo "✅ Released $PKG ($PKGSLUG) v$VER (tag: $TAG)"