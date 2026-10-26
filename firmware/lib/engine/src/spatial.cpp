#include "spatial.h"

#include <cmath>
#include <cstring>

namespace engine {
namespace {

constexpr int kRingCcw[kChannels] = {0, 1, 2, 3, 4, 5, 6, 7};
constexpr int kTemporalCcw[kChannels] = {0, 1, 2, 3, 7, 6, 5, 4};

constexpr int kRingLeftCcw[] = {1, 2, 3};    // F7 -> T7 -> P7 (front to back)
constexpr int kRingRightCcw[] = {5, 6, 7};   // P8 -> T8 -> F8 (back to front)
constexpr int kTemporalLeftCcw[] = {0, 1, 2, 3};
constexpr int kTemporalRightCcw[] = {7, 6, 5, 4};

int copyOrder(const int* src, int n, bool ccw, int out[kChannels]) {
  if (ccw) {
    for (int i = 0; i < n; ++i) out[i] = src[i];
  } else {
    // Clockwise: same starting coil, opposite direction.
    out[0] = src[0];
    for (int i = 1; i < n; ++i) out[i] = src[n - i];
  }
  return n;
}

// Number of distinct dwell values in the schedule.
uint32_t scheduleLength(const SpatialParams& s) {
  if (s.dwellStepMs == 0.0f) return 1;
  const float span = s.dwellEndMs - s.dwellStartMs;
  if (span == 0.0f || (span > 0.0f) != (s.dwellStepMs > 0.0f)) return 1;
  return static_cast<uint32_t>(std::floor(span / s.dwellStepMs + 1e-4f)) + 1;
}

float dwellAt(const SpatialParams& s, uint32_t k) {
  const float d = s.dwellStartMs + s.dwellStepMs * static_cast<float>(k);
  return d < 0.5f ? 0.5f : d;
}

const char* const kModeNames[] = {"bilateral", "left", "right", "rotate",
                                  "cycle", "alternate", "single"};

}  // namespace

int rotationOrder(Layout layout, bool ccw, int out[kChannels]) {
  return copyOrder(layout == Layout::Ring ? kRingCcw : kTemporalCcw, kChannels, ccw, out);
}

int sideOrder(Layout layout, Side side, bool ccw, int out[kChannels]) {
  if (layout == Layout::Ring) {
    return side == Side::Left ? copyOrder(kRingLeftCcw, 3, ccw, out)
                              : copyOrder(kRingRightCcw, 3, ccw, out);
  }
  return side == Side::Left ? copyOrder(kTemporalLeftCcw, 4, ccw, out)
                            : copyOrder(kTemporalRightCcw, 4, ccw, out);
}

bool isLeft(Layout layout, int ch) {
  return layout == Layout::Ring ? (ch >= 1 && ch <= 3) : (ch >= 0 && ch <= 3);
}

bool isRight(Layout layout, int ch) {
  return layout == Layout::Ring ? (ch >= 5 && ch <= 7) : (ch >= 4 && ch <= 7);
}

DwellPosition dwellPosition(const SpatialParams& s, double tMs) {
  DwellPosition pos{0, 0.0f};
  if (tMs < 0.0) return pos;
  const uint32_t n = scheduleLength(s);
  double cycle = 0.0;
  for (uint32_t k = 0; k < n; ++k) cycle += dwellAt(s, k);
  const double cycles = std::floor(tMs / cycle);
  double tau = tMs - cycles * cycle;
  uint32_t k = 0;
  for (; k < n; ++k) {
    const double d = dwellAt(s, k);
    if (tau < d || k == n - 1) {
      pos.frac = static_cast<float>(tau / d);
      if (pos.frac > 1.0f) pos.frac = 1.0f;
      break;
    }
    tau -= d;
  }
  pos.step = static_cast<uint64_t>(cycles) * n + k;
  return pos;
}

void spatialGains(const SpatialParams& s, Layout layout, double tMs, float out[kChannels]) {
  for (int ch = 0; ch < kChannels; ++ch) out[ch] = 0.0f;

  switch (s.mode) {
    case SpatialMode::Bilateral:
      for (int ch = 0; ch < kChannels; ++ch) out[ch] = 1.0f;
      break;
    case SpatialMode::Left:
    case SpatialMode::Right:
      for (int ch = 0; ch < kChannels; ++ch) {
        const bool on = s.mode == SpatialMode::Left ? isLeft(layout, ch) : isRight(layout, ch);
        out[ch] = on ? 1.0f : 0.0f;
      }
      break;
    case SpatialMode::Rotate:
    case SpatialMode::Cycle: {
      int order[kChannels];
      const int n = s.mode == SpatialMode::Rotate ? rotationOrder(layout, s.ccw, order)
                                                  : sideOrder(layout, s.side, s.ccw, order);
      const DwellPosition pos = dwellPosition(s, tMs);
      const int current = order[pos.step % n];
      if (s.crossfade) {
        const int next = order[(pos.step + 1) % n];
        out[current] += 1.0f - pos.frac;
        out[next] += pos.frac;
      } else {
        out[current] = 1.0f;
      }
      break;
    }
    case SpatialMode::Alternate: {
      const float half = s.alternateMs > 1.0f ? s.alternateMs : 1.0f;
      const bool left = (static_cast<uint64_t>(tMs / half) % 2) == 0;
      for (int ch = 0; ch < kChannels; ++ch)
        out[ch] = (left ? isLeft(layout, ch) : isRight(layout, ch)) ? 1.0f : 0.0f;
      break;
    }
    case SpatialMode::Single:
      if (s.channel < kChannels) out[s.channel] = 1.0f;
      break;
  }

  for (int ch = 0; ch < kChannels; ++ch) out[ch] *= s.weights[ch];
}

const char* spatialModeName(SpatialMode mode) {
  return kModeNames[static_cast<int>(mode)];
}

bool spatialModeFromName(const char* name, SpatialMode& out) {
  if (name == nullptr) return false;
  for (int i = 0; i < 7; ++i) {
    if (std::strcmp(kModeNames[i], name) == 0) {
      out = static_cast<SpatialMode>(i);
      return true;
    }
  }
  return false;
}

const char* layoutName(Layout layout) { return layout == Layout::Ring ? "ring" : "temporal"; }

bool layoutFromName(const char* name, Layout& out) {
  if (name == nullptr) return false;
  if (std::strcmp(name, "ring") == 0 || std::strcmp(name, "A") == 0) {
    out = Layout::Ring;
    return true;
  }
  if (std::strcmp(name, "temporal") == 0 || std::strcmp(name, "B") == 0) {
    out = Layout::Temporal;
    return true;
  }
  return false;
}

}  // namespace engine
