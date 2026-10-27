// Session log: one JSON file per session in /log. In blind sessions the
// active/sham condition stays hidden until the user has rated the session.
#pragma once
#include <Arduino.h>

#include "minijson.h"
#include "sequencer.h"

namespace logbook {

struct Entry {
  String presetId;
  String presetName;
  bool blind = false;
  bool sham = false;
  bool test = false;
  float fieldUT = 0;
  uint32_t plannedMs = 0;
  uint32_t trialId = 0;  // linked experiment trial, 0 = none
};

// Creates the log file and returns its id.
uint32_t open(const Entry& entry);
void close(const seq::Finished& finished);
// Stores a 0..10 rating + notes; returns the updated entry (condition revealed).
bool rate(uint32_t id, int rating, const String& notes, String& json, String& error);
// The experiment trial an entry belongs to (0 = none or unknown entry).
uint32_t trialOf(uint32_t id);
// Writes "total" and "items" (newest first) into an open JSON object.
void writeList(mj::Writer& w, size_t offset, size_t limit);

}  // namespace logbook
