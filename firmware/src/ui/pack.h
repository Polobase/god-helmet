// Reads the program pack on the SD card (written by `npm run sd-pack`, see
// docs/STANDALONE.md). Only while no session runs (sdcard refuses otherwise).
#pragma once
#include <Arduino.h>

#include <vector>

#include "tape.h"

namespace pack {

constexpr int kVersion = 1;

struct Category {
  String key, label;
  int count = 0;
};

struct Program {
  int num = -1;            // file number: p/NNN.json, t/NNN.txt
  String id, category, evidence;
  uint32_t seconds = 0;
  int coils = 0;
  String sites[8];         // 10-10 / 10-5 site per channel, "" = unused
  String name, placement;  // placement: name of the shared coil layout
};

struct SitePos {
  char name[8] = {0};
  float x = 0, y = 0;  // top view, unit band circle: x to your right, y to the back
  bool tenTen = false;
};

// Checks the index header; false (with a message) if there is no usable pack.
bool check(int& programs, String& error);
bool categories(std::vector<Category>& out, String& error);
bool programs(const String& category, std::vector<Program>& out, String& error);
String programPath(int num);
String textPath(int num);
bool sites(std::vector<SitePos>& out, String& error);
bool tapeTemplate(engine::tape::Template& out, String& error);

}  // namespace pack
