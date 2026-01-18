#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/bundle-code.sh [output_filename]
OUTPUT="${1:-full_ttt_packages_code.txt}"

# Clear or create the output file
: > "$OUTPUT"

echo "📦 Bundling project code into $OUTPUT..."

# --- Configuration ---

# Root files to strictly include
ROOT_FILES=(
  "package.json"
  "tsconfig.json"
  "lerna.json"
  "pnpm-workspace.yaml"
)

# Directories to ignore
IGNORE_DIRS=(
  "node_modules"
  "dist"
  "build"
  "coverage"
  ".git"
  ".turbo"
  ".firebase"
)

# File extensions to include
INCLUDE_EXTS=(
  "ts"
  "tsx"
  "js"
  "jsx"
  "json"
  "sh"
  "md"
  "css"
)

# --- Functions ---

append_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    echo "  -> Adding: $file"
    {
      echo ""
      echo "================================================================================"
      echo "FILE PATH: $file"
      echo "================================================================================"
      cat "$file"
      echo ""
    } >> "$OUTPUT"
  fi
}

# --- Execution ---

# 1. Add specific Root Files
echo "🔍 Processing root config files..."
for root_file in "${ROOT_FILES[@]}"; do
  if [[ -f "$root_file" ]]; then
    append_file "$root_file"
  fi
done

# 2. Add Package Files (Scanning 'packages/' directory)
if [[ -d "packages" ]]; then
  echo "🔍 Scanning 'packages/' directory..."

  # A. Construct Ignore Arguments: ( -name "dir1" -o -name "dir2" ... )
  FIND_IGNORE_ARGS=()
  first=true
  for dir in "${IGNORE_DIRS[@]}"; do
    if [ "$first" = true ]; then
      FIND_IGNORE_ARGS+=( -name "$dir" )
      first=false
    else
      FIND_IGNORE_ARGS+=( -o -name "$dir" )
    fi
  done

  # B. Construct Include Arguments: ( -name "*.ts" -o -name "*.tsx" ... )
  FIND_INCLUDE_ARGS=()
  first=true
  for ext in "${INCLUDE_EXTS[@]}"; do
    if [ "$first" = true ]; then
      FIND_INCLUDE_ARGS+=( -name "*.$ext" )
      first=false
    else
      FIND_INCLUDE_ARGS+=( -o -name "*.$ext" )
    fi
  done

  # C. Run find command
  # Logic: If dir matches IGNORE -> prune. ELSE if file matches INCLUDE -> print.
  find packages \
    -type d \( "${FIND_IGNORE_ARGS[@]}" \) -prune \
    -o \
    -type f \( "${FIND_INCLUDE_ARGS[@]}" \) \
    -print0 | sort -z | while IFS= read -r -d '' file; do
      
      # Exclude package-lock.json explicitly
      if [[ "$file" == *"package-lock.json" ]]; then continue; fi
      
      append_file "$file"
    done
else
  echo "⚠️  Warning: 'packages' directory not found."
fi

echo "✅ Done! All code is in: $OUTPUT"