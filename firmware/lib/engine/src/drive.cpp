#include "drive.h"

#include <cmath>

namespace engine {

float maxCurrentMA(const DriveConfig& cfg) {
  const float ohm = cfg.seriesOhm + cfg.coilOhm;
  return ohm > 0.0f ? cfg.vFullScale / ohm * 1000.0f : 0.0f;
}

float swingForCurrentMA(const DriveConfig& cfg, float mA) {
  const float maxMA = maxCurrentMA(cfg);
  if (maxMA <= 0.0f) return 0.0f;
  const float swing = std::fabs(mA) / maxMA * kMaxSwing;
  return swing > kMaxSwing ? kMaxSwing : swing;
}

float swingForFieldUT(const DriveConfig& cfg, float uT, float uTperMA) {
  if (uTperMA <= 0.0f) return 0.0f;
  return swingForCurrentMA(cfg, uT / uTperMA);
}

float maxFieldUT(const DriveConfig& cfg, float uTperMA) { return maxCurrentMA(cfg) * uTperMA; }

uint16_t toCode(float v, float swing) {
  long code = 2048L + std::lround(static_cast<double>(v) * swing);
  if (code < 0) code = 0;
  if (code > 4095) code = 4095;
  return static_cast<uint16_t>(code);
}

}  // namespace engine
