// Conversion between field targets, coil current and DAC codes.
//
// Voltage drive (the first build): AD5328 code -> module output (±vFullScale,
// mid-scale = 0 V) -> series resistor + coil -> current -> field. The series
// resistor is the hardware current ceiling: 10 V / (2200 + 4.2) Ω = 4.54 mA.
//
// Current drive (the helmet-driver board, lib/pcb): the code sets the coil
// current directly, ±fullScaleMA at full swing whatever the coil, and the
// board's ceiling switch limits it (ceilingMA).
#pragma once
#include <cstdint>

namespace engine {

struct DriveConfig {
  float seriesOhm = 2200.0f;
  float coilOhm = 4.2f;
  float vFullScale = 10.0f;  // module output at code 0xFFF relative to mid-scale
  float fullScaleMA = 0.0f;  // > 0: current drive, this many mA at full swing (seriesOhm etc. unused)
  float ceilingMA = 0.0f;    // > 0: the hardware's limit; no swing commands more
};

constexpr float kMaxSwing = 2047.0f;  // codes above/below mid-scale 0x800

// Coil current at the full code swing (before the ceiling).
float fullSwingMA(const DriveConfig& cfg);

// Peak coil current that can be commanded: the full swing, or the ceiling when that is lower.
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
