#!/bin/sh
# Builds and runs the Bluetooth checks (macOS: Swift and CoreBluetooth, nothing
# to install). macOS asks once whether the terminal may use Bluetooth.
#   firmware/test/hw/ble/run.sh [cycles=20] [cleanup logFrom=<n> trialFrom=<n> lastSession=<epoch>]
set -e
cd "$(dirname "$0")"
OUT=../../../.pio/hw
mkdir -p "$OUT"
SDK="${SDKROOT:-$(xcrun --show-sdk-path 2>/dev/null || true)}"
[ -d "$SDK" ] || SDK=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk
[ -d "$SDK" ] && export SDKROOT="$SDK"
swiftc -swift-version 5 -O -suppress-warnings main.swift -o "$OUT/bletest" \
  -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker Info.plist
exec "$OUT/bletest" "$@"
