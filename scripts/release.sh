#!/bin/bash
set -e

VERSION=${1:?"Usage: ./scripts/release.sh 0.2.0"}
APP_NAME="Claude Config"

echo "Building $APP_NAME v$VERSION..."

# Update version in tauri.conf.json
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json

# Update version in package.json
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json

# Update version in Cargo.toml
sed -i '' "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

# Build
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/claude-config.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run vite:build
cd src-tauri && cargo tauri build
cd ..

# Show artifacts
echo ""
echo "Build complete! Artifacts:"
ls -la src-tauri/target/release/bundle/macos/*.tar.gz* 2>/dev/null || echo "  (check src-tauri/target/release/bundle/)"

echo ""
echo "Next steps:"
echo "  1. Upload the .tar.gz to your update Gist"
echo "  2. Copy the .sig file contents"
echo "  3. Update update.json Gist with version=$VERSION and the signature"
echo "  4. git add -A && git commit -m 'Release v$VERSION'"
echo "  5. git tag v$VERSION && git push origin main --tags"
