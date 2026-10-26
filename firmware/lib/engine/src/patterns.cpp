#include "patterns.h"

#include <cmath>
#include <cstring>

namespace engine {
namespace {

constexpr float kTwoPiF = 6.2831853f;

// sin() of a phase given in cycles; the reduction runs in double, the sine in
// float (the ESP32 FPU is single precision only).
float sinCycles(double cycles) {
  return std::sin(kTwoPiF * static_cast<float>(cycles - std::floor(cycles)));
}

double holdTime(double tMs, float pointMs) {
  return pointMs > 0.0f ? std::floor(tMs / pointMs) * pointMs : tMs;
}

// Linear FM sweep: instantaneous frequency moves from f0 to f1 over the window.
float sweep(const PatternParams& p, double tMs) {
  if (p.sweepMs <= 0.0f) return 0.0f;
  const double period = p.sweepMs + (p.gapMs > 0.0f ? p.gapMs : 0.0f);
  // Hold relative to the window start so every repetition is identical.
  const double tau = holdTime(std::fmod(tMs, period), p.pointMs);
  if (tau >= p.sweepMs) return 0.0f;
  const double ts = tau / 1000.0;
  const double window = p.sweepMs / 1000.0;
  return sinCycles(p.f0 * ts + (p.f1 - p.f0) * ts * ts / (2.0 * window));
}

uint32_t mix32(uint32_t x) {
  x ^= x >> 16;
  x *= 0x7feb352dU;
  x ^= x >> 15;
  x *= 0x846ca68bU;
  x ^= x >> 16;
  return x;
}

struct NameEntry {
  PatternType type;
  const char* name;
};

constexpr NameEntry kNames[] = {
    {PatternType::Off, "off"},       {PatternType::DC, "dc"},
    {PatternType::Sine, "sine"},     {PatternType::Chirp, "chirp"},
    {PatternType::Burst, "burst"},   {PatternType::Thomas, "thomas"},
    {PatternType::Pulse, "pulse"},   {PatternType::SemiRandom, "semirandom"},
    {PatternType::Table, "table"},
};

}  // namespace

PatternParams patternDefaults(PatternType type) {
  PatternParams p;
  p.type = type;
  switch (type) {
    case PatternType::Sine:
      p.f0 = p.f1 = 7.0f;
      p.pointMs = 1.0f;
      break;
    case PatternType::Chirp:
      // Murphy: a function-generator chirp "built from common peak EEG
      // frequencies"; exact sweep unpublished -> 4..40 Hz over 2 s (assumption).
      p.f0 = 4.0f;
      p.f1 = 40.0f;
      p.sweepMs = 2000.0f;
      p.pointMs = 1.0f;
      break;
    case PatternType::Burst:
      // Accelerating burst-firing pattern, 3 ms points, 4 s interstimulus
      // interval (re-analysis of Persinger-lab protocols); sweep range assumed.
      p.f0 = 6.0f;
      p.f1 = 30.0f;
      p.sweepMs = 1500.0f;
      p.gapMs = 4000.0f;
      p.pointMs = 3.0f;
      break;
    case PatternType::Thomas:
      // Decelerating FM ~25 -> 6 Hz, 3 ms points, ~2.5 s pattern.
      p.f0 = 25.0f;
      p.f1 = 6.0f;
      p.sweepMs = 2500.0f;
      p.gapMs = 1000.0f;
      p.pointMs = 3.0f;
      break;
    case PatternType::Pulse:
      p.pulseMs = 100.0f;
      p.gapMs = 100.0f;
      p.alternate = true;
      break;
    case PatternType::SemiRandom:
      p.pointMs = 3.0f;
      break;
    case PatternType::Table:
      p.pointMs = 3.0f;
      break;
    case PatternType::Off:
    case PatternType::DC:
      break;
  }
  return p;
}

float patternValue(const PatternParams& p, double tMs) {
  if (tMs < 0.0) return 0.0f;
  const double t = holdTime(tMs, p.pointMs);
  switch (p.type) {
    case PatternType::Off:
      return 0.0f;
    case PatternType::DC:
      return 1.0f;
    case PatternType::Sine:
      return sinCycles(p.f0 * t / 1000.0);
    case PatternType::Chirp:
    case PatternType::Burst:
    case PatternType::Thomas:
      return sweep(p, tMs);
    case PatternType::Pulse: {
      const double period = p.pulseMs + (p.gapMs > 0.0f ? p.gapMs : 0.0f);
      if (period <= 0.0) return 0.0f;
      const double index = std::floor(t / period);
      const double tau = t - index * period;
      if (tau >= p.pulseMs) return 0.0f;
      const bool odd = static_cast<int64_t>(index) & 1;
      return (p.alternate && odd) ? -1.0f : 1.0f;
    }
    case PatternType::SemiRandom: {
      const double step = p.pointMs > 0.0f ? p.pointMs : 1.0f;
      const uint32_t k = static_cast<uint32_t>(static_cast<uint64_t>(tMs / step));
      const uint32_t h = mix32(k ^ mix32(p.seed));
      return static_cast<float>(h) / 2147483647.5f - 1.0f;
    }
    case PatternType::Table: {
      if (p.table == nullptr || p.tableLen == 0) return 0.0f;
      const double step = p.pointMs > 0.0f ? p.pointMs : 1.0f;
      const double total = p.tableLen * step + (p.gapMs > 0.0f ? p.gapMs : 0.0f);
      const double tau = std::fmod(tMs, total);
      const uint32_t i = static_cast<uint32_t>(tau / step);
      if (i >= p.tableLen) return 0.0f;
      return p.table[i] / 127.0f;
    }
  }
  return 0.0f;
}

const char* patternName(PatternType type) {
  for (const auto& e : kNames)
    if (e.type == type) return e.name;
  return "off";
}

bool patternFromName(const char* name, PatternType& out) {
  if (name == nullptr) return false;
  for (const auto& e : kNames) {
    if (std::strcmp(e.name, name) == 0) {
      out = e.type;
      return true;
    }
  }
  return false;
}

}  // namespace engine
