#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/bundle-code.sh [output_filename]
# We treat this as the BASE filename.
DEFAULT_FILENAME="full_ttt_packages_code.txt"
BASE_OUTPUT="${1:-$DEFAULT_FILENAME}"

# --- Configuration ---

# 1. Chunking Configuration
CHUNK_SIZE=45

# 2. Extract extension and filename without extension for naming chunks
FILENAME_NO_EXT="${BASE_OUTPUT%.*}"
FILE_EXT="${BASE_OUTPUT##*.}"

echo "📦 Bundling monorepo code (Splitting every $CHUNK_SIZE files)..."

# 3. Context Directories (Always include these if they exist for full context)
BASE_DIRS=("scripts" ".github" ".vscode")

# 4. Root files to strictly include
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

# 5. Main Source Directories to Scan
SCAN_DIRS=("packages" "${BASE_DIRS[@]}")

# 6. Directories to ignore
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

# 7. File extensions to include
INCLUDE_EXTS=(
  "ts" "tsx" "js" "jsx" "mjs" "cjs" "json" "sh" "md" "css" "scss" "yaml" "yml" "env"
)

# --- CHUNKING LOGIC GLOBALS ---
CURRENT_CHUNK_INDEX=1
FILES_IN_CURRENT_CHUNK=0

# Determine current output filename based on chunk index
get_current_output_file() {
    echo "${FILENAME_NO_EXT}_${CURRENT_CHUNK_INDEX}.${FILE_EXT}"
}

# Initialize the first file (clear it if it exists)
FIRST_FILE=$(get_current_output_file)
: > "$FIRST_FILE"

# --- Functions ---

append_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    
    # Calculate which file we are writing to
    local output_file
    output_file=$(get_current_output_file)

    # Check if we reached the chunk limit
    if [ "$FILES_IN_CURRENT_CHUNK" -ge "$CHUNK_SIZE" ]; then
        # Increment Chunk Index (Use explicit math to avoid set -e failures)
        CURRENT_CHUNK_INDEX=$((CURRENT_CHUNK_INDEX + 1))
        FILES_IN_CURRENT_CHUNK=0
        
        # New Output File Name
        output_file=$(get_current_output_file)
        
        # Clear the new file before writing
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

    # Increment file counter for this chunk
    FILES_IN_CURRENT_CHUNK=$((FILES_IN_CURRENT_CHUNK + 1))
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
    
    # Use Process Substitution < <(find...) to maintain variable scope
    while IFS= read -r -d '' file; do

        # Clean up noise:
        # 1. In monorepos, per-package lockfiles are often mistakes/artifacts. 
        #    We only want the root one (handled above).
        if [[ "$file" == *"package-lock.json" && "$scan_dir" == "packages" ]]; then continue; fi
        
        # 2. Exclude binary assets
        if [[ "$file" == *.png || "$file" == *.jpg || "$file" == *.jpeg || "$file" == *.ico || "$file" == *.woff2 ]]; then continue; fi
        
        append_file "$file"
        
    done < <(find "$scan_dir" \
      -type d \( "${FIND_IGNORE_ARGS[@]}" \) -prune \
      -o \
      -type f \( "${FIND_INCLUDE_ARGS[@]}" \) \
      -print0 | sort -z)
      
  else
    # Only warn if the core 'packages' folder is missing. 
    # Context folders (.github, etc) are optional.
    if [[ "$scan_dir" == "packages" ]]; then
        echo "⚠️  Warning: Directory '$scan_dir' not found (skipping)."
    fi
  fi
done

echo "✅ Done! Code split into $CURRENT_CHUNK_INDEX files starting with: $(get_current_output_file)"