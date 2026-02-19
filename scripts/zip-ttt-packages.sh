#!/usr/bin/env bash
set -euo pipefail

# ===== Colors =====
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

OUT_DIR="/tmp/ttt-productions-zips"
mkdir -p "$OUT_DIR"

PKG_ROOT="packages"

# Global excludes (safe)
EXCLUDES=(
  "**/node_modules/**"
  "**/.git/**"
  "**/*.log"
  "**/.DS_Store"
  "**/*.tsbuildinfo"
)

# dist handling (toggle)
DIST_EXCLUDE=( "**/dist/**" )

exclude_args=()
for ex in "${EXCLUDES[@]}"; do
  exclude_args+=("-x" "$ex")
done

exclude_with_dist=("${exclude_args[@]}")
for ex in "${DIST_EXCLUDE[@]}"; do
  exclude_with_dist+=("-x" "$ex")
done

echo -e "${BLUE}=== TTT Productions Packages Zipper ===${NC}"
echo ""

# Gather package folders
if [[ ! -d "$PKG_ROOT" ]]; then
  echo -e "${RED}Missing '$PKG_ROOT' folder. Run from repo root.${NC}"
  exit 1
fi

mapfile -t PKG_DIRS < <(find "$PKG_ROOT" -mindepth 1 -maxdepth 1 -type d -print | sort)

if [[ ${#PKG_DIRS[@]} -eq 0 ]]; then
  echo -e "${RED}No packages found in '$PKG_ROOT'.${NC}"
  exit 1
fi

echo "Packages found:"
i=1
for d in "${PKG_DIRS[@]}"; do
  echo "  $i) $(basename "$d")"
  i=$((i+1))
done
echo ""

echo "1) Zip ONE package (exclude dist/)"
echo "2) Zip ONE package (include dist/)"
echo "3) Zip ALL packages (exclude dist/)"
echo "4) Zip ALL packages (include dist/)"
echo "5) Zip everthing (exclude dist/)"
echo ""

read -p "Choose (1-5): " choice

case "$choice" in
  1|2)
    read -p "Enter package number (1-${#PKG_DIRS[@]}): " n
    if ! [[ "$n" =~ ^[0-9]+$ ]] || (( n < 1 || n > ${#PKG_DIRS[@]} )); then
      echo -e "${RED}Invalid package number.${NC}"
      exit 1
    fi
    PKG_DIR="${PKG_DIRS[$((n-1))]}"
    PKG_NAME="$(basename "$PKG_DIR")"

    if [[ "$choice" == "1" ]]; then
      echo -e "${GREEN}Zipping $PKG_NAME (excluding dist)...${NC}"
      zip -r "$OUT_DIR/ttt-packages-$PKG_NAME-no-dist.zip" \
        "$PKG_DIR" \
        "${exclude_with_dist[@]}"
    else
      echo -e "${GREEN}Zipping $PKG_NAME (including dist)...${NC}"
      zip -r "$OUT_DIR/ttt-packages-$PKG_NAME-with-dist.zip" \
        "$PKG_DIR" \
        "${exclude_args[@]}"
    fi
    ;;

  3)
    echo -e "${GREEN}Zipping ALL packages (excluding dist)...${NC}"
    zip -r "$OUT_DIR/ttt-packages-all-no-dist.zip" \
      "$PKG_ROOT" \
      "${exclude_with_dist[@]}"
    ;;

  4)
    echo -e "${GREEN}Zipping ALL packages (including dist)...${NC}"
    zip -r "$OUT_DIR/ttt-packages-all-with-dist.zip" \
      "$PKG_ROOT" \
      "${exclude_args[@]}"
    ;;

  5)
    echo -e "${GREEN}Zipping everything (excluding dist)...${NC}"
    zip -r "$OUT_DIR/ttt-packages-full-no-dist.zip" \
      package.json \
      package-lock.json \
      tsconfig.json \
      scripts \
      .github/workflows/publish.yml \
      "$PKG_ROOT" \
      "${exclude_with_dist[@]}"
    ;;

  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${BLUE}=== ZIP FILES READY ===${NC}"
ls -lh "$OUT_DIR" | sed -n '1,200p'

echo ""
read -p "Copy zip to repo root for upload? (y/n): " copy
if [[ "$copy" == "y" || "$copy" == "Y" ]]; then
  cp "$OUT_DIR"/*.zip .
  rm -f "$OUT_DIR"/*.zip
  rmdir "$OUT_DIR"
  echo -e "${GREEN}Copied zip(s) to repo root and cleaned up temp directory.${NC}"
else
  echo "Leaving zip(s) in $OUT_DIR"
fi

