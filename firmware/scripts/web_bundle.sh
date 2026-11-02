#!/bin/sh
# Files for the web app's firmware installer (webapp/src/components/FirmwareInstall.vue,
# ESP Web Tools): one merged flash image per board (bootloader, partition
# table, boot_app0 and the app at their offsets) and two manifests.
#   firmware/scripts/web_bundle.sh <out dir> [--no-build]
# e.g. firmware/scripts/web_bundle.sh webapp/public/firmware
set -e
OUT=${1:?usage: web_bundle.sh <out dir> [--no-build]}
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)
cd "$(dirname "$0")/.."

ENVS="esp32dev esp32s3 esp32c3 esp32c6 esp32e_lcd28"
if [ "$2" != "--no-build" ]; then
  # shellcheck disable=SC2046
  pio run $(for e in $ENVS; do printf -- '-e %s ' "$e"; done)
fi

PIO_HOME=${PLATFORMIO_CORE_DIR:-$HOME/.platformio}
# The Python PlatformIO runs esptool with: its own (installer) or the one pip put it in (CI).
PY=python3
[ -x "$PIO_HOME/penv/bin/python" ] && PY="$PIO_HOME/penv/bin/python"
ESPTOOL="$PIO_HOME/packages/tool-esptoolpy/esptool.py"
BOOT_APP0="$PIO_HOME/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin"
VERSION=$(sed -n 's/.*kFirmwareVersion = "\(.*\)";.*/\1/p' src/config.h)

# merge <env> <chip> <bootloader offset> <flash size>
# DIO works on every board (QIO ones too); the flash speed stays as built.
merge() {
  "$PY" "$ESPTOOL" --chip "$2" merge_bin -o "$OUT/$1.bin" \
    --flash_mode dio --flash_freq keep --flash_size "$4" \
    "$3" ".pio/build/$1/bootloader.bin" \
    0x8000 ".pio/build/$1/partitions.bin" \
    0xe000 "$BOOT_APP0" \
    0x10000 ".pio/build/$1/firmware.bin"
}
merge esp32dev esp32 0x1000 4MB
merge esp32s3 esp32s3 0x0 8MB
merge esp32c3 esp32c3 0x0 4MB
merge esp32c6 esp32c6 0x0 4MB
merge esp32e_lcd28 esp32 0x1000 4MB

# The installer picks the build whose chipFamily matches the chip it finds.
cat > "$OUT/manifest.json" <<EOF
{
  "name": "God helmet controller",
  "version": "$VERSION",
  "new_install_prompt_erase": true,
  "new_install_improv_wait_time": 0,
  "builds": [
    { "chipFamily": "ESP32", "parts": [{ "path": "esp32dev.bin", "offset": 0 }] },
    { "chipFamily": "ESP32-S3", "parts": [{ "path": "esp32s3.bin", "offset": 0 }] },
    { "chipFamily": "ESP32-C3", "parts": [{ "path": "esp32c3.bin", "offset": 0 }] },
    { "chipFamily": "ESP32-C6", "parts": [{ "path": "esp32c6.bin", "offset": 0 }] }
  ]
}
EOF
cat > "$OUT/manifest-lcd28.json" <<EOF
{
  "name": "God helmet 2.8in display board",
  "version": "$VERSION",
  "new_install_prompt_erase": true,
  "new_install_improv_wait_time": 0,
  "builds": [
    { "chipFamily": "ESP32", "parts": [{ "path": "esp32e_lcd28.bin", "offset": 0 }] }
  ]
}
EOF
ls -l "$OUT"
