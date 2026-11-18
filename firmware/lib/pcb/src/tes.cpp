#include "tes.h"

#include <cmath>
#include <cstdio>

namespace tes {
namespace {

constexpr float kPi = 3.14159265358979f;
constexpr float kRnsRate = 1280.0f;  // samples per second (Terney 2008)

int usedChannels(const Plan& p) {
  int n = 0;
  for (float m : p.mA) n += m != 0.0f ? 1 : 0;
  return n;
}

// The mean of |waveform| relative to its peak, as plannedChargeC counts it.
float meanAbs(Mode m) { return m == Mode::DC ? 1.0f : m == Mode::AC ? 2.0f / kPi : 0.5f; }

// RBJ biquad (Robert Bristow-Johnson, "Cookbook formulae for audio EQ biquad filter coefficients"), Q = 1/√2.
void biquad(bool high, float f, float fs, float b[3], float a[2]) {
  const float w = 2.0f * kPi * f / fs;
  const float cw = std::cos(w), alpha = std::sin(w) / (2.0f * 0.70710678f);
  const float a0 = 1.0f + alpha;
  if (high) {
    b[0] = (1.0f + cw) / 2.0f / a0;
    b[1] = -(1.0f + cw) / a0;
    b[2] = b[0];
  } else {
    b[0] = (1.0f - cw) / 2.0f / a0;
    b[1] = (1.0f - cw) / a0;
    b[2] = b[0];
  }
  a[0] = -2.0f * cw / a0;
  a[1] = (1.0f - alpha) / a0;
}

// Direct form I; s = {x1, x2, y1, y2}.
float step(float x, const float b[3], const float a[2], float s[4]) {
  const float y = b[0] * x + b[1] * s[0] + b[2] * s[1] - a[0] * s[2] - a[1] * s[3];
  s[1] = s[0];
  s[0] = x;
  s[3] = s[2];
  s[2] = y;
  return y;
}

}  // namespace

float sessionS(const Plan& p) {
  if (p.sham) return p.rampUpS + p.rampDownS + static_cast<float>(p.holdS);  // the same length as the real one
  return p.rampUpS + static_cast<float>(p.holdS) + p.rampDownS;
}

float plannedChargeC(const Plan& p) {
  const float k = meanAbs(p.mode);
  float sumMA = 0;
  for (float m : p.mA) sumMA += std::fabs(m);
  // Ramps deliver half their full-intensity charge (linear); a sham only its two ramps.
  const float fullS = p.sham ? 0.0f : static_cast<float>(p.holdS);
  const float s = fullS + 0.5f * (p.rampUpS + p.rampDownS);
  return sumMA / 1000.0f * k * s;
}

bool validate(const Plan& p, const Limits& lim, char* error, int n) {
  auto fail = [&](const char* msg) {
    std::snprintf(error, static_cast<size_t>(n), "%s", msg);
    return false;
  };
  if (usedChannels(p) == 0) return fail("no channel has a current");
  float total = 0;
  for (float m : p.mA) {
    if (!std::isfinite(m)) return fail("current is not a number");
    if (p.mode != Mode::DC && m < 0) return fail("AC and RNS take a positive peak amplitude");
    if (std::fabs(m) > lim.maxChannelMA) {
      std::snprintf(error, static_cast<size_t>(n), "at most %.1f mA per channel", static_cast<double>(lim.maxChannelMA));
      return false;
    }
    total += std::fabs(m);
  }
  if (total > lim.maxTotalMA + 1e-4f) {
    std::snprintf(error, static_cast<size_t>(n), "at most %.1f mA for both channels together", static_cast<double>(lim.maxTotalMA));
    return false;
  }
  if (!(p.rampUpS >= lim.minRampS && p.rampUpS <= lim.maxRampS && p.rampDownS >= lim.minRampS && p.rampDownS <= lim.maxRampS)) {
    std::snprintf(error, static_cast<size_t>(n), "ramps from %.0f to %.0f s", static_cast<double>(lim.minRampS), static_cast<double>(lim.maxRampS));
    return false;
  }
  if (p.holdS == 0) return fail("no time at full intensity");
  if (sessionS(p) > static_cast<float>(lim.maxSessionS)) {
    std::snprintf(error, static_cast<size_t>(n), "at most %u min with the ramps", static_cast<unsigned>(lim.maxSessionS / 60));
    return false;
  }
  if (p.mode == Mode::AC && !(p.hz > 0 && p.hz <= lim.maxAcHz)) {
    std::snprintf(error, static_cast<size_t>(n), "AC from above 0 to %.0f Hz", static_cast<double>(lim.maxAcHz));
    return false;
  }
  if (p.mode == Mode::RNS && !(p.lowHz >= lim.minRnsHz && p.highHz <= lim.maxRnsHz && p.lowHz < p.highHz)) {
    std::snprintf(error, static_cast<size_t>(n), "noise band within %.1f-%.0f Hz", static_cast<double>(lim.minRnsHz), static_cast<double>(lim.maxRnsHz));
    return false;
  }
  if (plannedChargeC(p) > lim.maxChargeC) {
    std::snprintf(error, static_cast<size_t>(n), "%.2f C planned, at most %.1f C", static_cast<double>(plannedChargeC(p)), static_cast<double>(lim.maxChargeC));
    return false;
  }
  return true;
}

// ---- Runner -----------------------------------------------------------------------------------------------------

void Runner::start(const Plan& p, uint32_t seed) {
  plan_ = p;
  phase_ = Phase::RampUp;
  env_ = 0;
  elapsed_ = phaseS_ = charge_ = theta_ = 0;
  silent_ = stopped_ = false;
  rng_ = seed != 0 ? seed : 0x9E3779B9u;
  sampleS_ = 0;
  for (int ch = 0; ch < kChannels; ++ch) {
    held_[ch] = 0;
    for (int i = 0; i < 4; ++i) hp_[ch][i] = lp_[ch][i] = 0;
  }
  scale_ = 1.0f;
  if (p.mode == Mode::RNS) {
    biquad(true, p.lowHz, kRnsRate, hpB_, hpA_);
    // The low-pass at the band's top; at the sample rate's Nyquist (640 Hz) it would do nothing: skipped there.
    biquad(false, std::fmin(p.highHz, 0.45f * kRnsRate), kRnsRate, lpB_, lpA_);
    // Scale so that the filtered noise's standard deviation is a third of the peak: measured on 20 s of the same
    // generator, then the filters start from rest again.
    double sq = 0;
    const int n = static_cast<int>(20.0f * kRnsRate);
    for (int i = 0; i < n; ++i) {
      const float v = noise(0);
      sq += static_cast<double>(v) * v;
    }
    const float rms = static_cast<float>(std::sqrt(sq / n));
    scale_ = rms > 0 ? (1.0f / 3.0f) / rms : 1.0f;
    for (int ch = 0; ch < kChannels; ++ch)
      for (int i = 0; i < 4; ++i) hp_[ch][i] = lp_[ch][i] = 0;
    rng_ = seed != 0 ? seed : 0x9E3779B9u;
  }
}

// One filtered Gaussian sample (Box-Muller on a xorshift32 generator), unscaled.
float Runner::noise(int ch) {
  auto uni = [this]() {
    rng_ ^= rng_ << 13;
    rng_ ^= rng_ >> 17;
    rng_ ^= rng_ << 5;
    return (static_cast<float>(rng_ >> 8) + 0.5f) / 16777216.0f;
  };
  const float u1 = uni(), u2 = uni();
  const float g = std::sqrt(-2.0f * std::log(u1)) * std::cos(2.0f * kPi * u2);
  float y = step(g, hpB_, hpA_, hp_[ch]);
  if (plan_.highHz < 0.45f * kRnsRate) y = step(y, lpB_, lpA_, lp_[ch]);
  return y;
}

void Runner::requestStop() {
  if (!running()) return;
  stopped_ = true;
  if (phase_ != Phase::RampDown) {
    phase_ = Phase::RampDown;
    phaseS_ = 0;
  }
}

bool Runner::advance(float dtS, float out[kChannels]) {
  for (int ch = 0; ch < kChannels; ++ch) out[ch] = 0;
  if (!running()) return false;
  elapsed_ += dtS;
  phaseS_ += dtS;
  switch (phase_) {
    case Phase::RampUp:
      env_ = std::fmin(1.0f, env_ + dtS / plan_.rampUpS);
      if (env_ >= 1.0f) {
        phase_ = plan_.sham ? Phase::RampDown : Phase::Hold;  // a sham turns straight back
        phaseS_ = 0;
      }
      break;
    case Phase::Hold:
      if (silent_) {
        // A sham's silence, until a real session would have ended: both look the same from outside.
        env_ = 0;
        if (elapsed_ >= sessionS(plan_)) {
          phase_ = Phase::Done;
          return false;
        }
      } else {
        env_ = 1.0f;
        if (phaseS_ >= static_cast<float>(plan_.holdS)) {
          phase_ = Phase::RampDown;
          phaseS_ = 0;
        }
      }
      break;
    case Phase::RampDown:
      env_ = std::fmax(0.0f, env_ - dtS / plan_.rampDownS);
      if (env_ <= 0.0f) {
        if (plan_.sham && !stopped_ && !silent_ && elapsed_ < sessionS(plan_)) {
          silent_ = true;
          phase_ = Phase::Hold;
          phaseS_ = 0;
        } else {
          phase_ = Phase::Done;
          return false;
        }
      }
      break;
    default:
      return false;
  }
  // The waveform.
  float w[kChannels];
  switch (plan_.mode) {
    case Mode::DC:
      for (int ch = 0; ch < kChannels; ++ch) w[ch] = 1.0f;
      break;
    case Mode::AC:
      theta_ = std::fmod(theta_ + 2.0f * kPi * plan_.hz * dtS, 2.0f * kPi);
      for (int ch = 0; ch < kChannels; ++ch) w[ch] = std::sin(theta_);
      break;
    case Mode::RNS:
      sampleS_ += dtS;
      while (sampleS_ >= 1.0f / kRnsRate) {
        sampleS_ -= 1.0f / kRnsRate;
        for (int ch = 0; ch < kChannels; ++ch) held_[ch] = noise(ch) * scale_;
      }
      for (int ch = 0; ch < kChannels; ++ch) w[ch] = std::fmax(-1.0f, std::fmin(1.0f, held_[ch]));
      break;
  }
  for (int ch = 0; ch < kChannels; ++ch) {
    out[ch] = plan_.mA[ch] * env_ * w[ch];
    charge_ += std::fabs(out[ch]) / 1000.0f * dtS;
  }
  return true;
}

// ---- converters -------------------------------------------------------------------------------------------------

uint32_t dacWrite(uint8_t reg, uint16_t data) { return (static_cast<uint32_t>(reg & 0xF) << 16) | data; }

CodePair codesForMA(float mA, float senseOhm, float vref) {
  // a - b = I · Rs, centred on mid-scale: a = Vref/2 + I·Rs/2, b = Vref/2 - I·Rs/2.
  const float half = mA / 1000.0f * senseOhm / 2.0f;
  const float lsb = vref / 65536.0f;
  auto code = [&](float v) {
    long c = std::lround(static_cast<double>(v / lsb));
    if (c < 0) c = 0;
    if (c > 0xFFFF) c = 0xFFFF;
    return static_cast<uint16_t>(c);
  };
  return {code(vref / 2.0f + half), code(vref / 2.0f - half)};
}

pcb::AdsRange adcRange(uint8_t input) {
  return input == VS1 || input == VS2 || input == TSP1 || input == TSP2 ? pcb::AdsRange::V2_56 : pcb::AdsRange::V10_24;
}

float senseMA(float vs, float senseOhm) { return vs / senseOhm * 1000.0f; }

float setpointMA(float tsp, float senseOhm) { return -tsp / senseOhm * 1000.0f; }

// ---- checks -----------------------------------------------------------------------------------------------------

Impedance judgeImpedance(float volts, float mA, float plannedPeakMA) {
  Impedance z;
  if (std::fabs(mA) < 1e-4f) {
    z.high = true;  // no current flowed: open
    return z;
  }
  z.kOhm = std::fabs(volts / mA);
  z.short_ = z.kOhm < kMinKOhm;
  z.high = z.kOhm > kMaxKOhm || z.kOhm * std::fabs(plannedPeakMA) > kComplianceV;
  z.ok = !z.short_ && !z.high;
  return z;
}

const char* watchStep(Watch& w, float dtS, const float setMA[kChannels], const float measMA[kChannels],
                      const float pairV[kChannels]) {
  w.windowS += dtS;
  for (int ch = 0; ch < kChannels; ++ch) {
    const float e = measMA[ch] - setMA[ch];
    w.errSq[ch] += e * e * dtS;
    w.setSq[ch] += setMA[ch] * setMA[ch] * dtS;
    // At the compliance: the source has run out of voltage (a lifted electrode, dry sponge).
    w.overS[ch] = std::fabs(pairV[ch]) > kComplianceV ? w.overS[ch] + dtS : 0.0f;
    if (w.overS[ch] > 0.2f) return ch == 0 ? "channel 1 at its voltage limit" : "channel 2 at its voltage limit";
  }
  if (w.windowS >= 0.5f) {
    const char* reason = nullptr;
    for (int ch = 0; ch < kChannels && !reason; ++ch) {
      const float errRms = std::sqrt(w.errSq[ch] / w.windowS), setRms = std::sqrt(w.setSq[ch] / w.windowS);
      if (errRms > 0.15f + 0.25f * setRms) reason = ch == 0 ? "channel 1 current not delivered" : "channel 2 current not delivered";
    }
    w = Watch{};
    return reason;
  }
  return nullptr;
}

}  // namespace tes
