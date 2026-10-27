#include "spatial.h"

#include <cctype>
#include <cmath>
#include <cstring>

namespace engine {
namespace {

int copyOrder(const int* src, int n, bool ccw, int out[kChannels]) {
  if (n <= 0) return 0;
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

Geometry geometryFor(Layout layout) {
  Geometry g;
  if (layout == Layout::Ring) {
    // Fpz F7 T7 P7 Oz P8 T8 F8: midline front/back, left 1-3, right 5-7.
    const int8_t side[kChannels] = {0, -1, -1, -1, 0, 1, 1, 1};
    for (int i = 0; i < kChannels; ++i) {
      g.side[i] = side[i];
      g.order[i] = static_cast<uint8_t>(i);
    }
  } else {
    // FT7 T7 CP5 TP7 | FT8 T8 CP6 TP8: CCW = left front->back, right back->front.
    const uint8_t order[kChannels] = {0, 1, 2, 3, 7, 6, 5, 4};
    for (int i = 0; i < kChannels; ++i) {
      g.side[i] = i < 4 ? -1 : 1;
      g.order[i] = order[i];
    }
  }
  g.count = kChannels;
  return g;
}

bool sideFromSite(const char* site, int8_t& side) {
  // Letters, then a number or "z", then an optional "h" (10-5 half positions, e.g. FTT8h).
  if (site == nullptr) return false;
  size_t n = std::strlen(site);
  if (n > 0 && (site[n - 1] == 'h' || site[n - 1] == 'H')) --n;
  size_t letters = 0;
  while (letters < n && std::isalpha(static_cast<unsigned char>(site[letters]))) ++letters;
  if (letters == 0 || n < 2) return false;
  const char last = site[n - 1];
  if (letters == n) {  // no digits: must end in z (Fpz, Cz, Oz ...)
    if (last != 'z' && last != 'Z') return false;
    side = 0;
    return true;
  }
  for (size_t i = letters; i < n; ++i)
    if (site[i] < '0' || site[i] > '9') return false;
  side = ((last - '0') % 2 == 1) ? -1 : 1;
  return true;
}

int rotationOrder(const Geometry& g, bool ccw, int out[kChannels]) {
  int src[kChannels];
  const int n = g.count <= kChannels ? g.count : kChannels;
  for (int i = 0; i < n; ++i) src[i] = g.order[i];
  return copyOrder(src, n, ccw, out);
}

int sideOrder(const Geometry& g, Side side, bool ccw, int out[kChannels]) {
  int src[kChannels];
  int n = 0;
  const int count = g.count <= kChannels ? g.count : kChannels;
  for (int i = 0; i < count; ++i) {
    const int ch = g.order[i];
    if (side == Side::Left ? isLeft(g, ch) : isRight(g, ch)) src[n++] = ch;
  }
  return copyOrder(src, n, ccw, out);
}

int rotationOrder(Layout layout, bool ccw, int out[kChannels]) {
  return rotationOrder(geometryFor(layout), ccw, out);
}

int sideOrder(Layout layout, Side side, bool ccw, int out[kChannels]) {
  return sideOrder(geometryFor(layout), side, ccw, out);
}

bool isLeft(Layout layout, int ch) { return isLeft(geometryFor(layout), ch); }
bool isRight(Layout layout, int ch) { return isRight(geometryFor(layout), ch); }

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
  spatialGains(s, geometryFor(layout), tMs, out);
}

void spatialGains(const SpatialParams& s, const Geometry& g, double tMs, float out[kChannels]) {
  for (int ch = 0; ch < kChannels; ++ch) out[ch] = 0.0f;

  switch (s.mode) {
    case SpatialMode::Bilateral:
      for (int ch = 0; ch < kChannels; ++ch) out[ch] = 1.0f;
      break;
    case SpatialMode::Left:
    case SpatialMode::Right:
      for (int ch = 0; ch < kChannels; ++ch) {
        const bool on = s.mode == SpatialMode::Left ? isLeft(g, ch) : isRight(g, ch);
        out[ch] = on ? 1.0f : 0.0f;
      }
      break;
    case SpatialMode::Rotate:
    case SpatialMode::Cycle: {
      const DwellPosition pos = dwellPosition(s, tMs);
      auto step = [&](const int* order, int n) {
        if (n == 0) return;
        const int current = order[pos.step % n];
        if (s.crossfade) {
          out[current] += 1.0f - pos.frac;
          out[order[(pos.step + 1) % n]] += pos.frac;
        } else {
          out[current] = 1.0f;
        }
      };
      int order[kChannels];
      if (s.mode == SpatialMode::Rotate) {
        step(order, rotationOrder(g, s.ccw, order));
      } else if (s.side == Side::Both) {
        int right[kChannels];
        step(order, sideOrder(g, Side::Left, s.ccwLeft, order));
        step(right, sideOrder(g, Side::Right, s.ccwRight, right));
      } else {
        step(order, sideOrder(g, s.side, s.ccw, order));
      }
      break;
    }
    case SpatialMode::Alternate: {
      const float half = s.alternateMs > 1.0f ? s.alternateMs : 1.0f;
      const bool left = (static_cast<uint64_t>(tMs / half) % 2) == 0;
      for (int ch = 0; ch < kChannels; ++ch)
        out[ch] = (left ? isLeft(g, ch) : isRight(g, ch)) ? 1.0f : 0.0f;
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

const char* layoutName(Layout layout) {
  switch (layout) {
    case Layout::Ring: return "ring";
    case Layout::Temporal: return "temporal";
    default: return "custom";
  }
}

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
  if (std::strcmp(name, "custom") == 0) {
    out = Layout::Custom;
    return true;
  }
  return false;
}

}  // namespace engine
