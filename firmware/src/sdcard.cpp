#include "sdcard.h"

#include "config.h"

#ifdef HAS_SD_CARD
#include <SD.h>
#include <SPI.h>

#include "dac.h"
#include "sequencer.h"

namespace sdcard {
namespace {

bool gMounted = false;
String gDescription = "no SD card";
// 10 MHz: SCK and MOSI also run through the header wires to the DAC module.
constexpr uint32_t kSdHz = 10000000;

bool idle(String& error) {
  if (!gMounted) {
    error = "no SD card";
    return false;
  }
  if (seq::busy()) {
    error = "the SD card is not read while a session runs";
    return false;
  }
  return true;
}

}  // namespace

bool begin() {
  if (seq::busy()) return false;
  // Shares the DAC's SPIClass, so the two never clash (transactions lock the bus).
  // Two file slots: each pre-allocates a 4 KB sector buffer.
  gMounted = SD.begin(pins::kSdCs, dac::spi(), kSdHz, "/sd", 2);
  if (gMounted) {
    const double gb = static_cast<double>(SD.cardSize()) / 1e9;
    gDescription = String(gb, gb < 10 ? 1 : 0) + " GB card" +
                   (SD.exists(String(kRoot) + "/index.tsv") ? "" : ", no program pack");
  }
  return gMounted;
}

bool remount() {
  if (seq::busy()) return false;
  if (gMounted) SD.end();  // leaves the shared SPI bus running
  gMounted = false;
  gDescription = "no SD card";
  return begin();
}

bool mounted() { return gMounted; }

String describe() { return gDescription; }

bool exists(const String& path) {
  String error;
  return idle(error) && SD.exists(path);
}

bool readFile(const String& path, std::string& out, size_t maxBytes, String& error) {
  if (!idle(error)) return false;
  File f = SD.open(path, FILE_READ);
  if (!f) {
    error = "not on the card: " + path;
    return false;
  }
  const size_t size = f.size();
  if (size > maxBytes) {
    f.close();
    error = "file too large: " + path;
    return false;
  }
  out.resize(size);
  const size_t got = f.read(reinterpret_cast<uint8_t*>(&out[0]), size);
  f.close();
  if (got != size) {
    error = "read error: " + path;
    return false;
  }
  return true;
}

bool forEachLine(const String& path, const std::function<bool(const String&)>& fn, String& error) {
  if (!idle(error)) return false;
  File f = SD.open(path, FILE_READ);
  if (!f) {
    error = "not on the card: " + path;
    return false;
  }
  String line;
  line.reserve(256);
  bool go = true;
  while (go && f.available()) {
    const int c = f.read();
    if (c == '\n') {
      if (line.endsWith("\r")) line.remove(line.length() - 1);
      go = fn(line);
      line = "";
    } else if (c >= 0) {
      line += static_cast<char>(c);
    }
  }
  if (go && line.length()) fn(line);
  f.close();
  return true;
}

}  // namespace sdcard

#else  // boards without an SD card

namespace sdcard {
bool begin() { return false; }
bool remount() { return false; }
bool mounted() { return false; }
String describe() { return "no SD card"; }
bool readFile(const String&, std::string&, size_t, String& error) {
  error = "no SD card";
  return false;
}
bool forEachLine(const String&, const std::function<bool(const String&)>&, String& error) {
  error = "no SD card";
  return false;
}
bool exists(const String&) { return false; }
}  // namespace sdcard

#endif
