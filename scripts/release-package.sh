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

# Use packages/<folder> as the tag namespace, e.g. chat-core-v1.2.3
PKGSLUG="$(basename "$PKGDIR")"

tag_exists_remote () {
  local tag="$1"
  git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null 2>&1
}

version_exists_npm () {
  local pkg="$1"
  local ver="$2"
  # returns 0 if that exact version exists on npm
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

git tag "$TAG"

# Push just what we changed, plus the single new tag
git push origin main
git push origin "$TAG"

echo "✅ Released $PKG ($PKGSLUG) v$VER (tag: $TAG)"
