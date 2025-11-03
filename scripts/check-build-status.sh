#!/usr/bin/env bash

# Check if TypeScript packages need rebuilding
# Exits with code 1 if any package needs rebuild, 0 if all are up to date

set -e

NEEDS_BUILD=0
PACKAGES=("core" "github" "gateway" "worker")

echo "🔍 Checking if packages need rebuilding..."
echo ""

for pkg in "${PACKAGES[@]}"; do
  PKG_DIR="packages/$pkg"
  SRC_DIR="$PKG_DIR/src"
  DIST_DIR="$PKG_DIR/dist"

  if [ ! -d "$DIST_DIR" ]; then
    echo "❌ $pkg: dist/ directory missing - NEEDS BUILD"
    NEEDS_BUILD=1
    continue
  fi

  # Find newest source file
  NEWEST_SRC=$(find "$SRC_DIR" -type f -name "*.ts" -exec stat -f "%m %N" {} \; 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2- || echo "")

  # Find oldest dist file
  OLDEST_DIST=$(find "$DIST_DIR" -type f -name "*.js" -exec stat -f "%m %N" {} \; 2>/dev/null | sort -n | head -1 | cut -d' ' -f2- || echo "")

  if [ -z "$NEWEST_SRC" ] || [ -z "$OLDEST_DIST" ]; then
    echo "⚠️  $pkg: Unable to check timestamps - assuming NEEDS BUILD"
    NEEDS_BUILD=1
    continue
  fi

  SRC_TIME=$(stat -f "%m" "$NEWEST_SRC" 2>/dev/null || echo 0)
  DIST_TIME=$(stat -f "%m" "$OLDEST_DIST" 2>/dev/null || echo 0)

  if [ "$SRC_TIME" -gt "$DIST_TIME" ]; then
    echo "❌ $pkg: Source files newer than dist - NEEDS BUILD"
    NEEDS_BUILD=1
  else
    echo "✅ $pkg: Up to date"
  fi
done

echo ""
if [ $NEEDS_BUILD -eq 1 ]; then
  echo "⚠️  Some packages need rebuilding. Run: make build-packages"
  exit 1
else
  echo "✅ All packages are up to date!"
  exit 0
fi
