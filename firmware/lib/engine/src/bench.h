// Bench sessions for checking the outputs with LEDs in place of the coils.
#pragma once
#include <cstdint>
#include <string>

#include "session.h"

namespace engine {

// Blink rates of the rising LED test (blinkHz 0), lowest first.
constexpr float kLedRisingHz[] = {0.5f, 1.0f, 2.0f, 5.0f, 10.0f};
constexpr int kLedRisingSteps = 5;
constexpr float kLedMinHz = 0.1f;
constexpr float kLedMaxHz = 20.0f;

// LED test: two LEDs, one each way round, in place of a coil. Each LED flashes
// blinkHz times a second (+ pulse, pause, - pulse, pause, a quarter of the
// blink each), so a blink rate that follows the choice shows the board drives
// that output; an LED that stays lit does not follow the board at all.
// blinkHz 0 = rising: kLedRisingHz in turn, seconds / 5 each.
// channel 0..7 = that output; -1 = AO1..AO8 in turn, 2 s each (or one whole
// blink when that is longer), and each rising step is whole rounds of AO1..AO8.
// Replaces s's phases, fades and names; s.phaseCount is 1 or kLedRisingSteps.
bool ledTestSession(Session& s, int channel, float blinkHz, uint32_t seconds, std::string* error);

}  // namespace engine
