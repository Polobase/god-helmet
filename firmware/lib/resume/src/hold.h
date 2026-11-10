// A button that only counts when it is held.
//
// The BOOT button doubles as a STOP input, but its pin is also pulled low for
// a few milliseconds when a computer opens the board's USB port (the
// auto-reset circuit of the USB-serial chip). So BOOT stops a session only
// when it has been low for kHoldMs, seen on several samples in a row; a
// finger takes far longer than that, a port opening far less.
#pragma once
#include <cstdint>

namespace resume {

class HoldDetector {
 public:
  explicit HoldDetector(uint32_t holdMs = 40, uint32_t minSamples = 3) : holdMs_(holdMs), minSamples_(minSamples) {}

  // Feed the pin (pressed = low) with a millisecond clock. True exactly once
  // per press, when it has been held long enough; released re-arms it.
  bool sample(bool pressed, uint32_t nowMs);

 private:
  uint32_t holdMs_;
  uint32_t minSamples_;
  bool down_ = false;
  bool fired_ = false;
  uint32_t sinceMs_ = 0;
  uint32_t samples_ = 0;
};

}  // namespace resume
