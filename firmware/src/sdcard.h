// microSD card with the program library (display board). The card shares the
// AD5328's SPI bus, so it is only touched while no session or test runs: a
// card transfer would hold the bus lock and stall the 2 kHz coil updates.
//
// Card layout (written by `npm run sd-pack` in webapp/, docs/STANDALONE.md):
//   /godhelmet/index.tsv        one line per program (header line first)
//   /godhelmet/p/<id>.json      the program in compact preset JSON (base64 tables)
//   /godhelmet/t/<id>.txt       readable text for the Details screen
//   /godhelmet/tape.json        template head arcs for the tape-measure directions
//   /godhelmet/sites.tsv        10-10 site positions for the coil map
//   /godhelmet/wifi.txt         optional: ssid=, password=, tz= (clock sync)
#pragma once
#include <Arduino.h>

#include <functional>
#include <string>

namespace sdcard {

constexpr const char* kRoot = "/godhelmet";

// Mounts the card (call once at boot, before any session).
bool begin();
// Unmounts and mounts again (a card swapped while idle). Refused while a session runs.
bool remount();
bool mounted();
// A short description of the card state for the UI ("no card", "16 GB, 198 programs").
String describe();

// Reads a whole file (at most maxBytes). Fails while a session runs.
bool readFile(const String& path, std::string& out, size_t maxBytes, String& error);
// Calls fn for every line (without the newline); stops early when fn returns false.
bool forEachLine(const String& path, const std::function<bool(const String&)>& fn, String& error);
bool exists(const String& path);

}  // namespace sdcard
