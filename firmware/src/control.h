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
  uint32_t trialId = 0;
  bool already = false;  // nothing was started: this start had been made before (same token)
};

float clampField(double uT);        // 0 / missing -> default; capped at the user ceiling
bool startAllowed(String& error);  // safety page accepted, nothing running
float maxReachableUT();             // field at full drive for the weakest coil
void markSessionTime();            // remembers the start of a real session (needs a clock)

// True random bytes. Without a running radio the hardware RNG is only
// pseudo-random, so the ADC noise source is switched on for the draw.
void fillRandom(void* buffer, size_t bytes);
bool coinFlip();

// Start tokens (lib/resume/start.h). An app sends a random token with every
// start; a start whose reply got lost is simply sent again, and the second
// one finds the first instead of starting anew.
enum class TokenCheck { Fresh, Already, Invalid };
// Already: `prior` holds the earlier start (already = true). Invalid: `prior` is the error.
TokenCheck checkToken(const String& token, Result& prior);
void rememberStart(const String& token, uint32_t logId, uint32_t trialId);

// One start, in two steps, so that everything that must be on file is on file
// before the outputs come on.
struct Launch {
  engine::Session* session = nullptr;  // stays the caller's unless launch() succeeds
  float fieldUT = 1.0f;
  bool blind = false;
  bool sham = false;
  float testMA = 0.0f;
  String presetId;
  String token;
  uint32_t trialId = 0;
};
// Step 1: writes the log entry and reads it back (tests have none: logId 0).
bool openLog(const Launch& launch, uint32_t& logId, String& error);
// Step 2: hands the session to the sequencer. If that fails the log entry is
// removed again and the session stays with the caller.
bool launch(const Launch& launch, uint32_t logId, String& error);

// Takes ownership of `session` (deleted on failure): both steps, then remembers the token.
Result startSession(engine::Session* session, float fieldUT, bool blind, bool sham, float testMA,
                    const String& presetId, const String& token = "");

// A program in the preset JSON format. fieldUT < 0 uses the program's own uT,
// 0 the default field.
// Blind: real or sham is drawn here and revealed only when the session is rated.
Result startFromDoc(const mj::Value& doc, const String& presetId, double fieldUT, bool blind,
                    const String& token = "");

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
  String token;             // see checkToken()
};
// Calibration and wiring checks; never logged.
Result startTest(const TestRequest& t);

// Stores a 0..10 rating; `json` gets the entry with its condition revealed.
// Refused while that session runs and, for a trial's session, until the trial is revealed.
bool rate(uint32_t logId, int rating, const String& notes, String& json, String& error);

}  // namespace control
