#!/bin/bash
set -euo pipefail

VERSION=${1:?"Usage: ./scripts/release.sh 0.2.0 [release notes]"}
NOTES=${2:-"Release v$VERSION"}
APP_NAME="Claude Config"
REPO="gregdbanks/claude-config-ui"
TAG="v$VERSION"

echo "Releasing $APP_NAME $TAG..."
echo ""

# Sanity checks
if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI not installed. brew install gh"
  exit 1
fi
if [ ! -f ~/.tauri/claude-config.key ]; then
  echo "ERROR: Tauri signing key not found at ~/.tauri/claude-config.key"
  exit 1
fi
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "ERROR: Release $TAG already exists. Bump the version or delete the release."
  exit 1
fi

# Bump version in all three places
echo "Bumping version to $VERSION..."
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
sed -i '' "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

# Build the signed bundle
echo "Building signed Tauri bundle..."
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/claude-config.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npx tauri build

# Locate the signed artifacts
BUNDLE_DIR="src-tauri/target/release/bundle/macos"
TAR_GZ="$BUNDLE_DIR/$APP_NAME.app.tar.gz"
SIG_FILE="$BUNDLE_DIR/$APP_NAME.app.tar.gz.sig"
DMG=$(ls "src-tauri/target/release/bundle/dmg/"*.dmg 2>/dev/null | head -1 || echo "")

if [ ! -f "$TAR_GZ" ]; then
  echo "ERROR: Expected bundle not found: $TAR_GZ"
  exit 1
fi
if [ ! -f "$SIG_FILE" ]; then
  echo "ERROR: Expected signature not found: $SIG_FILE"
  exit 1
fi

SIGNATURE=$(cat "$SIG_FILE")
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Generate latest.json — this is what the updater fetches
LATEST_JSON=$(mktemp -t latest.XXXXXX.json)
cat > "$LATEST_JSON" <<EOF
{
  "version": "$VERSION",
  "notes": "$NOTES",
  "pub_date": "$PUB_DATE",
  "platforms": {
    "darwin-aarch64": {
      "url": "https://github.com/$REPO/releases/download/$TAG/$APP_NAME.app.tar.gz",
      "signature": "$SIGNATURE"
    }
  }
}
EOF

echo "Generated latest.json:"
cat "$LATEST_JSON"
echo ""

# Create the GitHub release and upload all assets in one shot
echo "Creating GitHub release $TAG..."
RELEASE_ARGS=("$TAG" "$TAR_GZ" "$LATEST_JSON")
[ -n "$DMG" ] && RELEASE_ARGS+=("$DMG")

gh release create "${RELEASE_ARGS[@]}" \
  --repo "$REPO" \
  --title "$APP_NAME $TAG" \
  --notes "$NOTES"

# Tag the source tree
git add -A
git commit -m "Release $TAG" || echo "(no changes to commit)"
git tag "$TAG" 2>/dev/null || true
git push origin main --tags

rm -f "$LATEST_JSON"

echo ""
echo "Released $TAG:"
echo "  https://github.com/$REPO/releases/tag/$TAG"
echo ""
echo "Updater endpoint will now serve $VERSION to all installed clients."
