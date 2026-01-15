#!/usr/bin/env bash
set -euo pipefail

PKG="${1:?Usage: ./release-package.sh <pkgName> <pkgDir> [patch|minor|major]}"
PKGDIR="${2:?Usage: ./release-package.sh <pkgName> <pkgDir> [patch|minor|major]}"
BUMP="${3:-patch}"

git fetch --tags origin

# Guard: ensure PKGDIR points to the correct workspace package
[[ -f "$PKGDIR/package.json" ]] || { echo "Bad PKGDIR: $PKGDIR (missing package.json)"; exit 1; }
NAME=$(node -p "require('./$PKGDIR/package.json').name")
[[ "$NAME" == "$PKG" ]] || { echo "PKG mismatch: PKGDIR has $NAME but you passed $PKG"; exit 1; }

bump_once () {
  npm version "$BUMP" -w "$PKG" --no-git-tag-version >/dev/null
  VER=$(node -p "require('./$PKGDIR/package.json').version")
  TAG="v${VER}"
}

bump_once
while git ls-remote --tags origin "refs/tags/$TAG" | grep -q "refs/tags/$TAG"; do
  bump_once
done

git add "$PKGDIR/package.json" package-lock.json
git commit -m "Release $PKG v$VER"

git tag "$TAG"
git push origin main --tags

echo "✅ Released $PKG v$VER (tag: $TAG)"
