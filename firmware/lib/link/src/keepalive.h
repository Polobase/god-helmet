// The keepalive setting: stop a session when no app has been present for
// keepaliveS seconds (0 = off: a session runs on without the app).
#pragma once
#include <cstdint>

namespace hlink {

constexpr uint32_t kKeepaliveMinS = 5;
constexpr uint32_t kKeepaliveMaxS = 3600;

// What the setting may be: 0 (off), or 5..3600 s. Anything below 5 would stop
// a session on an ordinary hiccup; NaN and negative values mean off.
uint32_t clampKeepaliveS(double seconds);

// True when more than `seconds` have passed since `lastMs` (millis() values;
// correct across the 49-day wrap). Never true when the setting is off.
bool keepaliveExpired(uint32_t nowMs, uint32_t lastMs, uint32_t seconds);

}  // namespace hlink
