// Conversion between field targets, coil current and DAC codes.
//
// Signal chain per channel: AD5328 code -> module output (±vFullScale, mid-scale
// = 0 V) -> series resistor + coil -> current -> field. The series resistor is
// the hardware current ceiling: 10 V / (2200 + 4.2) Ω = 4.54 mA.
#pragma once
#include <cstdint>

namespace engine {

struct DriveConfig {
  float seriesOhm = 2200.0f;
  float coilOhm = 4.2f;
  float vFullScale = 10.0f;  // module output at code 0xFFF relative to mid-scale
};

constexpr float kMaxSwing = 2047.0f;  // codes above/below mid-scale 0x800

// Peak coil current with the full code swing.
float maxCurrentMA(const DriveConfig& cfg);

// Code swing (0..2047) that produces the requested peak current.
float swingForCurrentMA(const DriveConfig& cfg, float mA);

// Code swing for a peak field at the calibration depth (default 20 mm).
float swingForFieldUT(const DriveConfig& cfg, float uT, float uTperMA);

// Highest field reachable at the calibration depth.
float maxFieldUT(const DriveConfig& cfg, float uTperMA);

// v in [-1, 1] times the swing, around mid-scale, clamped to 0..4095.
uint16_t toCode(float v, float swing);

}  // namespace engine
