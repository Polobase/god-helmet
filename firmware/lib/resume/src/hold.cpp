#include "hold.h"

namespace resume {

bool HoldDetector::sample(bool pressed, uint32_t nowMs) {
  if (!pressed) {
    down_ = false;
    fired_ = false;
    samples_ = 0;
    return false;
  }
  if (!down_) {
    down_ = true;
    sinceMs_ = nowMs;
    samples_ = 1;
    return false;
  }
  ++samples_;
  if (fired_ || samples_ < minSamples_ || nowMs - sinceMs_ < holdMs_) return false;
  fired_ = true;
  return true;
}

}  // namespace resume
