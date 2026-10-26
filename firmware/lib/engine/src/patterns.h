// Temporal signal library: s(t) in [-1, 1].
//
// The Persinger/Koren lab built its fields from lists of numbers (0..255 ->
// -5..+5 V) held for a fixed "point duration" (1-10 ms, 3 ms most cited). The
// original data files were never published, so the generators below are
// approximations of the published *descriptions*; every parameter is editable.
#pragma once
#include <cstdint>

namespace engine {

enum class PatternType : uint8_t {
  Off,         // zero output (also used for sham)
  DC,          // constant +1 (calibration / polarity checks)
  Sine,        // sin(2*pi*f0*t)            e.g. 7 Hz "theta", 40 Hz "binding"
  Chirp,       // linear FM sweep f0 -> f1 over sweepMs, then gapMs silence
  Burst,       // accelerating FM ("burst-firing" / Burst-X), f0 < f1, long gap
  Thomas,      // decelerating FM ("Thomas pulse"), f0 > f1
  Pulse,       // rectangular pulses pulseMs on, gapMs off, optional polarity flip
  SemiRandom,  // pseudo-random value per point
  Table,       // user point table (Koren-style CSV / converted WAV)
};

struct PatternParams {
  PatternType type = PatternType::Off;
  float f0 = 7.0f;         // Hz; start frequency for sweeps
  float f1 = 7.0f;         // Hz; end frequency for sweeps
  float sweepMs = 2000.0f; // active window of Chirp/Burst/Thomas
  float gapMs = 0.0f;      // silence after each window / pulse / table pass
  float pointMs = 0.0f;    // sample-and-hold point duration, 0 = continuous
  float pulseMs = 100.0f;  // Pulse on-time
  bool alternate = true;   // Pulse: alternate polarity on successive pulses
  uint32_t seed = 1;       // SemiRandom
  const int8_t* table = nullptr;  // Table values -127..127 (owned by Session)
  uint32_t tableLen = 0;
};

// Sensible defaults per type (used when a preset omits a field).
PatternParams patternDefaults(PatternType type);

float patternValue(const PatternParams& p, double tMs);

const char* patternName(PatternType type);
bool patternFromName(const char* name, PatternType& out);

}  // namespace engine
