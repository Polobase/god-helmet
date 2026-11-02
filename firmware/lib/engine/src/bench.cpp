#include "bench.h"

#include <cmath>
#include <cstdio>

namespace engine {

bool ledTestSession(Session& s, int channel, float blinkHz, uint32_t seconds, std::string* error) {
  auto fail = [&](const char* m) {
    if (error) *error = m;
    return false;
  };
  if (channel < -1 || channel >= kChannels) return fail("channel must be 0..7");
  const bool rising = blinkHz == 0.0f;
  if (!rising && !(blinkHz >= kLedMinHz && blinkHz <= kLedMaxHz)) return fail("blinkHz must be 0 (rising) or 0.1..20");
  if (seconds == 0) return fail("seconds must be at least 1");

  const bool all = channel < 0;
  const int steps = rising ? kLedRisingSteps : 1;
  // One whole blink of the slowest step. Every rising rate divides it, so a dwell
  // of whole blinks starts each output on its + pulse at every step.
  const double slowMs = 1000.0 / (rising ? kLedRisingHz[0] : blinkHz);
  const double dwellMs = slowMs * std::ceil(2000.0 / slowMs - 1e-6);
  const double roundMs = all ? kChannels * dwellMs : slowMs;
  double stepMs = seconds * 1000.0;
  if (rising) stepMs = std::fmax(1.0, std::floor(stepMs / steps / roundMs)) * roundMs;

  s.fadeInMs = 500;
  s.fadeOutMs = 500;
  s.layout = Layout::Temporal;
  s.geometry = Geometry();  // channel order AO1..AO8
  s.phaseCount = static_cast<uint8_t>(steps);
  std::snprintf(s.id, sizeof s.id, all ? "test-leds" : "test-led");
  if (all) std::snprintf(s.name, sizeof s.name, "LED test AO1-AO8");
  else std::snprintf(s.name, sizeof s.name, "LED test AO%d", channel + 1);

  for (int i = 0; i < steps; ++i) {
    const float hz = rising ? kLedRisingHz[i] : blinkHz;
    Phase& ph = s.phases[i];
    ph = Phase();
    ph.durationMs = static_cast<uint32_t>(stepMs);
    ph.pattern = patternDefaults(PatternType::Pulse);
    ph.pattern.pulseMs = 250.0f / hz;
    ph.pattern.gapMs = 250.0f / hz;
    ph.pattern.alternate = true;
    if (all) {
      ph.spatial.mode = SpatialMode::Rotate;
      ph.spatial.ccw = true;
      ph.spatial.dwellStartMs = ph.spatial.dwellEndMs = static_cast<float>(dwellMs);
      ph.spatial.dwellStepMs = 0;
      std::snprintf(ph.name, sizeof ph.name, "%g Hz, AO1-AO8 %g s each", hz, dwellMs / 1000.0);
    } else {
      ph.spatial.mode = SpatialMode::Single;
      ph.spatial.channel = static_cast<uint8_t>(channel);
      std::snprintf(ph.name, sizeof ph.name, "%g Hz on AO%d", hz, channel + 1);
    }
  }
  return true;
}

}  // namespace engine
