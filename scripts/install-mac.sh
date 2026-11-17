#!/bin/bash
# Builds Clipbo from this checkout and installs it as the ONE copy in /Applications,
# replacing any older version. Your history and vault are kept (they live in
# ~/Library/Application Support/Clipbo, outside the app).
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME="Clipbo"
INSTALL_PATH="/Applications/${APP_NAME}.app"
ARCH_FLAG="--x64"
[ "$(uname -m)" = "arm64" ] && ARCH_FLAG="--arm64"

echo "Building ${APP_NAME}..."
npx electron-builder --mac zip "${ARCH_FLAG}" --publish never

BUILT_APP="$(find dist -maxdepth 2 -name "${APP_NAME}.app" -type d | head -n 1)"
[ -n "${BUILT_APP}" ] || { echo "Build failed: ${APP_NAME}.app not found in dist/"; exit 1; }

echo "Closing any running ${APP_NAME}..."
osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true
for _ in 1 2 3 4 5 6 7 8 9 10; do
  pgrep -f "${INSTALL_PATH}/Contents/MacOS/${APP_NAME}" >/dev/null || break
  sleep 0.5
done
pkill -f "${INSTALL_PATH}/Contents/MacOS/${APP_NAME}" 2>/dev/null || true

echo "Replacing ${INSTALL_PATH}..."
rm -rf "${INSTALL_PATH}"
ditto "${BUILT_APP}" "${INSTALL_PATH}"

# Leave no second runnable copy behind (Spotlight and Launchpad would list it).
find dist -maxdepth 2 -name "${APP_NAME}.app" -type d -prune -exec rm -rf {} +

open "${INSTALL_PATH}"
echo "Installed $(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "${INSTALL_PATH}/Contents/Info.plist") to ${INSTALL_PATH}"
