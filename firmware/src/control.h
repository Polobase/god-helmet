// Session control shared by the RPC (Bluetooth app) and the on-device UI, so
// both start, test and rate sessions through exactly the same checks.
#pragma once
#include <Arduino.h>

#include "minijson.h"
#include "session.h"

namespace control {

struct Result {
  bool ok = true;
  String error;
  uint32_t logId = 0;
};

float clampField(double uT);        // 0 / missing -> default; capped at the user ceiling
bool startAllowed(String& error);  // safety page accepted, nothing running
float maxReachableUT();             // field at full drive for the weakest coil
void markSessionTime();            // remembers the start of a real session (needs a clock)

// A true random bit. Without a running radio the hardware RNG is only
// pseudo-random, so the ADC noise source is switched on for the draw.
bool coinFlip();

// Takes ownership of `session` (deleted on failure). Opens the log entry
// (not for tests) and hands the session to the sequencer.
Result startSession(engine::Session* session, float fieldUT, bool blind, bool sham, float testMA,
                    const String& presetId);

// A program in the preset JSON format. fieldUT < 0 uses the program's own uT,
// 0 the default field.
// Blind: real or sham is drawn here and revealed only when the session is rated.
Result startFromDoc(const mj::Value& doc, const String& presetId, double fieldUT, bool blind);

struct TestRequest {
  String mode = "dc";       // "dc" (one coil), "rotate" (slow rotation), "led" (one output
                            // flashing + then -, for LEDs in place of a coil), "leds" (AO1..AO8 in turn)
  float mA = 1.0f;          // |mA| <= limits::kMaxTestMA
  uint32_t seconds = 30;    // 1..limits::kMaxTestSeconds
  int channel = 0;          // dc: 0..7
  String layout = "temporal";
  bool ccw = true;          // rotate
  float dwellMs = 1000;     // rotate
  float blinkHz = 1.0f;     // led/leds: flashes per second of each LED, 0.1..20; 0 = rising 0.5 to 10 Hz
};
// Calibration and wiring checks; never logged.
Result startTest(const TestRequest& t);

// Stores a 0..10 rating; `json` gets the entry with its condition revealed.
// Refused while that session runs and, for a trial's session, until the trial is revealed.
bool rate(uint32_t logId, int rating, const String& notes, String& json, String& error);

}  // namespace control
