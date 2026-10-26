#!/bin/sh
# Builds and runs the host unit tests for lib/engine + lib/minijson and
# validates every preset in ../presets. Run from anywhere.
set -e
cd "$(dirname "$0")/.."
mkdir -p .pio/host

SYSROOT=""
if [ "$(uname)" = "Darwin" ]; then
  # SDKROOT / xcrun can point at an SDK that is no longer installed.
  SDK="${SDKROOT:-$(xcrun --show-sdk-path 2>/dev/null || true)}"
  if [ ! -d "$SDK" ]; then
    SDK=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk
  fi
  if [ -d "$SDK" ]; then
    export SDKROOT="$SDK"
    SYSROOT="-isysroot $SDK"
  fi
fi

${CXX:-c++} -std=c++17 -O1 -Wall -Wextra -Wno-unused-parameter $SYSROOT \
  -Ilib/engine/src -Ilib/minijson/src -Ilib/bleframe/src \
  test/host/test_main.cpp lib/engine/src/*.cpp lib/minijson/src/*.cpp lib/bleframe/src/*.cpp \
  -o .pio/host/engine_tests
./.pio/host/engine_tests ../presets
