#!/bin/sh
# Renders every touchscreen UI screen to PNG on the host (no board needed):
# builds the program pack, compiles src/ui against test/uisim stubs and
# LovyanGFX (its SDL platform; needs SDL2, e.g. `brew install sdl2`), then
# taps through the screens.
#   test/uisim/run.sh [out dir]          default: .pio/uisim/shots
set -e
cd "$(dirname "$0")/../.."
FW=$(pwd)
OUT=${1:-$FW/.pio/uisim/shots}
BUILD=$FW/.pio/uisim
LGFX=$FW/.pio/libdeps/esp32e_lcd28/LovyanGFX/src
mkdir -p "$BUILD/obj" "$OUT"

if [ ! -d "$LGFX" ]; then
  echo "LovyanGFX not downloaded yet: run 'pio pkg install -e esp32e_lcd28' first" >&2
  exit 1
fi

SYSROOT=""
if [ "$(uname)" = "Darwin" ]; then
  SDK="${SDKROOT:-$(xcrun --show-sdk-path 2>/dev/null || true)}"
  [ -d "$SDK" ] || SDK=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk
  [ -d "$SDK" ] && export SDKROOT="$SDK" && SYSROOT="-isysroot $SDK"
fi
SDL_CFLAGS=$(sdl2-config --cflags)
SDL_LIBS=$(sdl2-config --libs)

# LovyanGFX (compiled once, cached in .pio/uisim/obj).
export SYSROOT SDL_CFLAGS LGFX BUILD
ls "$LGFX"/lgfx/v1/*.cpp "$LGFX"/lgfx/v1/misc/*.cpp "$LGFX"/lgfx/v1/panel/*.cpp \
  "$LGFX"/lgfx/v1/platforms/sdl/*.cpp "$LGFX"/lgfx/utility/*.c "$LGFX"/lgfx/Fonts/*/*.c |
  xargs -P 8 -n 1 sh -c '
    src="$1"; obj="$BUILD/obj/$(basename "$src").o"
    [ "$obj" -nt "$src" ] && exit 0
    case "$src" in
      *.c) ${CC:-cc} -O1 -w $SYSROOT $SDL_CFLAGS -I"$LGFX" -c "$src" -o "$obj" ;;
      *) ${CXX:-c++} -std=c++17 -O1 -w $SYSROOT $SDL_CFLAGS -I"$LGFX" -c "$src" -o "$obj" ;;
    esac' _

# The UI, the engine library and the stubs.
${CXX:-c++} -std=c++17 -O1 -Wall -Wno-unused-parameter -Wno-unused-function -Wno-vla-cxx-extension $SYSROOT $SDL_CFLAGS \
  -DUI_SIM -DBOARD_ESP32E_LCD28 -DSTANDALONE_UI \
  -Itest/uisim -Isrc -Isrc/ui -Ilib/engine/src -Ilib/minijson/src -I"$LGFX" \
  test/uisim/main.cpp test/uisim/stubs.cpp src/ui/ui.cpp src/ui/widgets.cpp src/ui/pack.cpp \
  lib/engine/src/*.cpp lib/minijson/src/*.cpp "$BUILD"/obj/*.o $SDL_LIBS -o "$BUILD/uisim"

# Program pack (same command the user runs for the SD card).
(cd ../webapp && npm run -s sd-pack -- "$BUILD/pack" >/dev/null)
rm -f "$OUT"/*.png
"$BUILD/uisim" "$BUILD/pack" "$OUT"
