#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/bundle-code.sh [output_filename]
OUTPUT="${1:-full_ttt_packages_code.txt}"

# Clear or create the output file
: > "$OUTPUT"

echo "📦 Bundling monorepo code into $OUTPUT..."

# --- Configuration ---

# 1. Context Directories (Always include these if they exist for full context)
BASE_DIRS=("scripts" ".github" ".vscode")

# 2. Root files to strictly include
# Expanded to include common monorepo/build tools
ROOT_FILES=(
  "package.json"
  "package-lock.json"
  "yarn.lock"
  "pnpm-lock.yaml"
  "tsconfig.json"
  "tsconfig.base.json"
  "lerna.json"
  "pnpm-workspace.yaml"
  "turbo.json"
  "nx.json"
  "README.md"
  ".gitignore"
  ".eslintrc.json"
  ".eslintrc.js"
  ".prettierrc"
  ".npmrc"
  ".env.example"
)

# 3. Main Source Directories to Scan
# Scans 'packages' plus the operations folders defined above
SCAN_DIRS=("packages" "${BASE_DIRS[@]}")

# 4. Directories to ignore
IGNORE_DIRS=(
  "node_modules"
  "dist"
  "build"
  "coverage"
  ".git"
  ".turbo"
  ".next"
  ".firebase"
  ".swc"
  ".cache"
)

# 5. File extensions to include
INCLUDE_EXTS=(
  "ts"
  "tsx"
  "js"
  "jsx"
  "mjs"
  "cjs"
  "json"
  "sh"
  "md"
  "css"
  "scss"
  "yaml"
  "yml"
  "env"
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

# 1. Process Root Files
echo "🔍 Processing root config files..."
for root_file in "${ROOT_FILES[@]}"; do
  [[ -f "$root_file" ]] && append_file "$root_file"
done

echo "🔍 Scanning directories: ${SCAN_DIRS[*]}..."

# Construct FIND arguments for Ignore Dirs
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

# Construct FIND arguments for Include Extensions
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

# Run the scan
for scan_dir in "${SCAN_DIRS[@]}"; do
  if [[ -d "$scan_dir" ]]; then
    echo "   - Scanning $scan_dir..."
    find "$scan_dir" \
      -type d \( "${FIND_IGNORE_ARGS[@]}" \) -prune \
      -o \
      -type f \( "${FIND_INCLUDE_ARGS[@]}" \) \
      -print0 | sort -z | while IFS= read -r -d '' file; do

        # Clean up noise:
        # 1. In monorepos, per-package lockfiles are often mistakes/artifacts. 
        #    We only want the root one (handled above).
        if [[ "$file" == *"package-lock.json" && "$scan_dir" == "packages" ]]; then continue; fi
        
        # 2. Exclude binary assets
        if [[ "$file" == *.png || "$file" == *.jpg || "$file" == *.jpeg || "$file" == *.ico || "$file" == *.woff2 ]]; then continue; fi
        
        append_file "$file"
      done
  else
    # Only warn if the core 'packages' folder is missing. 
    # Context folders (.github, etc) are optional.
    if [[ "$scan_dir" == "packages" ]]; then
        echo "⚠️  Warning: Directory '$scan_dir' not found (skipping)."
    fi
  fi
done

echo "✅ Done! All code is in: $OUTPUT"