#include "drive.h"

#include <cmath>

namespace engine {

float fullSwingMA(const DriveConfig& cfg) {
  if (cfg.fullScaleMA > 0.0f) return cfg.fullScaleMA;
  const float ohm = cfg.seriesOhm + cfg.coilOhm;
  return ohm > 0.0f ? cfg.vFullScale / ohm * 1000.0f : 0.0f;
}

float maxCurrentMA(const DriveConfig& cfg) {
  const float full = fullSwingMA(cfg);
  return cfg.ceilingMA > 0.0f && cfg.ceilingMA < full ? cfg.ceilingMA : full;
}

float swingForCurrentMA(const DriveConfig& cfg, float mA) {
  const float full = fullSwingMA(cfg);
  if (full <= 0.0f) return 0.0f;
  const float limit = maxCurrentMA(cfg) / full * kMaxSwing;
  const float swing = std::fabs(mA) / full * kMaxSwing;
  return swing > limit ? limit : swing;
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
