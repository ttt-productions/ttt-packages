#!/usr/bin/env bash
set -euo pipefail

DEFAULT_FILENAME="full_ttt_packages_code.txt"
BASE_OUTPUT="${1:-$DEFAULT_FILENAME}"

CHUNK_SIZE=45

FILENAME_NO_EXT="${BASE_OUTPUT%.*}"
FILE_EXT="${BASE_OUTPUT##*.}"

echo "📦 Bundling monorepo code (Splitting every $CHUNK_SIZE files)..."

BASE_DIRS=("scripts" ".github" ".vscode")

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

SCAN_DIRS=("packages" "${BASE_DIRS[@]}")

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

INCLUDE_EXTS=(
  "ts" "tsx" "js" "jsx" "mjs" "cjs" "json" "sh" "md" "css" "scss" "yaml" "yml" "env"
)

CURRENT_CHUNK_INDEX=1
FILES_IN_CURRENT_CHUNK=0

get_current_output_file() {
    echo "${FILENAME_NO_EXT}_${CURRENT_CHUNK_INDEX}.${FILE_EXT}"
}

FIRST_FILE=$(get_current_output_file)
: > "$FIRST_FILE"

append_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    
    local output_file
    output_file=$(get_current_output_file)

    if [ "$FILES_IN_CURRENT_CHUNK" -ge "$CHUNK_SIZE" ]; then
        # Explicit arithmetic: ((x++)) returns 1 when x is 0, which set -e treats as a failure.
        CURRENT_CHUNK_INDEX=$((CURRENT_CHUNK_INDEX + 1))
        FILES_IN_CURRENT_CHUNK=0
        
        output_file=$(get_current_output_file)
        
        : > "$output_file" 
        echo "📝 Starting new chunk: $output_file"
    fi

    echo "  -> Adding: $file (to $output_file)"
    {
      echo ""
      echo "================================================================================"
      echo "FILE PATH: $file"
      echo "================================================================================"
      cat "$file"
      echo ""
    } >> "$output_file"

    FILES_IN_CURRENT_CHUNK=$((FILES_IN_CURRENT_CHUNK + 1))
  fi
}

echo "🔍 Processing root config files..."
for root_file in "${ROOT_FILES[@]}"; do
  [[ -f "$root_file" ]] && append_file "$root_file"
done

echo "🔍 Scanning directories: ${SCAN_DIRS[*]}..."

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

for scan_dir in "${SCAN_DIRS[@]}"; do
  if [[ -d "$scan_dir" ]]; then
    echo "   - Scanning $scan_dir..."
    
    while IFS= read -r -d '' file; do

        if [[ "$file" == *"package-lock.json" && "$scan_dir" == "packages" ]]; then continue; fi
        
        if [[ "$file" == *.png || "$file" == *.jpg || "$file" == *.jpeg || "$file" == *.ico || "$file" == *.woff2 ]]; then continue; fi
        
        append_file "$file"
        
    done < <(find "$scan_dir" \
      -type d \( "${FIND_IGNORE_ARGS[@]}" \) -prune \
      -o \
      -type f \( "${FIND_INCLUDE_ARGS[@]}" \) \
      -print0 | sort -z)
      
  else
    if [[ "$scan_dir" == "packages" ]]; then
        echo "⚠️  Warning: Directory '$scan_dir' not found (skipping)."
    fi
  fi
done

echo "✅ Done! Code split into $CURRENT_CHUNK_INDEX files starting with: $(get_current_output_file)"