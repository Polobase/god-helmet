#include "keepalive.h"

namespace hlink {

uint32_t clampKeepaliveS(double seconds) {
  if (!(seconds >= 1)) return 0;  // also NaN
  if (seconds < kKeepaliveMinS) return kKeepaliveMinS;
  if (seconds > kKeepaliveMaxS) return kKeepaliveMaxS;
  return static_cast<uint32_t>(seconds);
}

bool keepaliveExpired(uint32_t nowMs, uint32_t lastMs, uint32_t seconds) {
  if (seconds == 0) return false;
  const uint32_t elapsed = nowMs - lastMs;  // unsigned: right across the wrap
  return static_cast<uint64_t>(elapsed) > static_cast<uint64_t>(seconds) * 1000u;
}

}  // namespace hlink
