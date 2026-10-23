#!/bin/bash
# Copies the built app to HIPPO_INSTALL_DIR (default: ~/Desktop) so it's easy to open.
set -e
APP="src-tauri/target/release/bundle/macos/Hippo.app"
DEST="${HIPPO_INSTALL_DIR:-$HOME/Desktop}"

if [ ! -d "$APP" ]; then
  echo "No build found at $APP"
  exit 1
fi

rm -rf "$DEST/Hippo.app"
cp -R "$APP" "$DEST/"
echo "Installed $DEST/Hippo.app"
