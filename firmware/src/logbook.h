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
  String token;          // the app's start token, "" = none
};

// How a session ended.
struct Closing {
  uint32_t logId = 0;
  uint32_t elapsedMs = 0;
  bool completed = false;
  const char* reason = "";
  float finalFieldUT = -1;  // the intensity at the end; < 0 = not known
  uint16_t fieldChanges = 0;
  uint16_t skips = 0;
};

// Creates the log file, reads it back and returns its id; 0 when the entry
// could not be stored (the session must then not start: a blind session's
// condition has to be on file before anything runs).
uint32_t open(const Entry& entry);
// Removes an entry whose session never started.
void discard(uint32_t id);
// Writes the end of a session. An entry that is closed already stays as it is.
bool close(const Closing& closing);
// For the check at start-up: the newest entries that were never closed
// (newest first, tests excluded). Only the last few can be: a session is
// closed when it ends, so only a restart leaves one open.
size_t unfinished(uint32_t* ids, size_t max);
// Stores a 0..10 rating + notes; returns the updated entry (condition revealed).
bool rate(uint32_t id, int rating, const String& notes, String& json, String& error);
// The experiment trial an entry belongs to (0 = none or unknown entry).
uint32_t trialOf(uint32_t id);
// Writes "total" and "items" (newest first) into an open JSON object.
void writeList(mj::Writer& w, size_t offset, size_t limit);

}  // namespace logbook
