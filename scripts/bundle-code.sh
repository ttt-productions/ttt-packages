#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/bundle-code.sh [output_filename]
OUTPUT="${1:-full_project_code.txt}"

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
)

# File extensions to include (add more if needed)
INCLUDE_EXTS=(
  "ts"
  "tsx"
  "js"
  "jsx"
  "json"
  "sh"
  "md"
)

# --- Functions ---

# Function to format and append a file to the output
append_file() {
  local file="$1"
  
  if [[ -f "$file" ]]; then
    echo "  -> Adding: $file"
    echo "" >> "$OUTPUT"
    echo "================================================================================" >> "$OUTPUT"
    echo "FILE PATH: $file"
    echo "================================================================================" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
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

  # Construct find command arguments to ignore directories
  FIND_IGNORE_ARGS=()
  for dir in "${IGNORE_DIRS[@]}"; do
    FIND_IGNORE_ARGS+=( -name "$dir" -prune -o )
  done

  # Construct find command arguments to include extensions
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

  # Run find command
  # Logic: find in packages/ -> (ignore bad dirs) -> OR -> (if file matches ext -> print)
  find packages \
    \( "${FIND_IGNORE_ARGS[@]}" \) \
    -type f \( "${FIND_INCLUDE_ARGS[@]}" \) \
    -print0 | sort -z | while IFS= read -r -d '' file; do
      # Exclude package-lock.json files explicitly if desired (usually noise for AI)
      if [[ "$file" == *"package-lock.json" ]]; then continue; fi
      append_file "$file"
    done
else
  echo "⚠️  Warning: 'packages' directory not found."
fi

echo "✅ Done! All code is in: $OUTPUT"