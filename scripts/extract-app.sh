#!/bin/bash
# Extract .app from DMG after build so the desktop shortcut stays current
VERSION=$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
DMG="src-tauri/target/release/bundle/dmg/Claude Config_${VERSION}_aarch64.dmg"
APP_DEST="Claude Config.app"

if [ ! -f "$DMG" ]; then
  echo "No DMG found, skipping extract"
  exit 0
fi

# Remove old .app if exists
rm -rf "$APP_DEST"

# Mount, copy, unmount
hdiutil attach "$DMG" -nobrowse -quiet
cp -R "/Volumes/Claude Config/Claude Config.app" "$APP_DEST"
hdiutil detach "/Volumes/Claude Config" -quiet

echo "Extracted Claude Config.app"
