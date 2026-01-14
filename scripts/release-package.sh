#!/usr/bin/env bash
set -e

PKG="$1"
PKGDIR="$2"
BUMP="${3:-patch}"

git fetch --tags origin

bump_once () {
  npm version "$BUMP" -w "$PKG" --no-git-tag-version >/dev/null
  VER=$(node -p "require('./$PKGDIR/package.json').version")
}

bump_once
while git ls-remote --tags origin "refs/tags/v$VER" | grep -q "refs/tags/v$VER"; do
  bump_once
done

git add "$PKGDIR/package.json" package-lock.json
git commit -m "Release $PKG v$VER"

git tag "v$VER"
git push origin main
git push origin "v$VER"

echo "✅ Released $PKG v$VER"
