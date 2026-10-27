// Spatial modes: per-coil gain g_ch(t) in [0, 1].
//
// Channel numbering (index 0..7 = CH1..CH8 = DAC A..H) for the standard layouts:
//
//   Layout Ring (A, circumcerebral "Octopus"), viewed from above, nose up,
//   channels run counter-clockwise:
//     0 Fpz  1 F7  2 T7  3 P7  4 Oz  5 P8  6 T8  7 F8
//
//   Layout Temporal (B, Koren helmet / Shakti 4+4):
//     left  0 FT7  1 T7  2 CP5  3 TP7
//     right 4 FT8  5 T8  6 CP6  7 TP8
//
// Counter-clockwise (seen from above) = front->back over the left side and
// back->front over the right side, as in the Persinger/Murphy Octopus.
#pragma once
#include <cstdint>

namespace engine {

constexpr int kChannels = 8;

// Ring / Temporal are the two standard layouts; Custom places each channel at
// any 10-10/10-5 position given in the preset ("placement": {"sites", "order"}).
enum class Layout : uint8_t { Ring, Temporal, Custom };

enum class SpatialMode : uint8_t {
  Bilateral,  // all coils
  Left,       // left-side coils only
  Right,      // right-side coils only
  Rotate,     // step around all coils in the rotation order
  Cycle,      // step around one side's coils (Persinger phase 1 "right only")
  Alternate,  // left side <-> right side (8-coil Shakti stereo alternation)
  Single,     // one channel (tests, calibration)
};

enum class Side : uint8_t { Left, Right, Both };  // Both: each side cycles at the same time

// Where the coils sit, as far as the spatial modes need to know:
// side[ch] = -1 left, 0 midline/unused, +1 right; order = counter-clockwise
// rotation order seen from above (only these channels take part in rotations).
struct Geometry {
  int8_t side[kChannels] = {0, 0, 0, 0, 0, 0, 0, 0};
  uint8_t order[kChannels] = {0, 1, 2, 3, 4, 5, 6, 7};
  uint8_t count = kChannels;
};

Geometry geometryFor(Layout layout);
// 10-10/10-5 name -> side: odd number = left, even = right, "z" = midline
// (e.g. "T7" -1, "CP6" +1, "Cz" 0, "FTT8h" +1). Returns false for unknown names.
bool sideFromSite(const char* site, int8_t& side);

struct SpatialParams {
  SpatialMode mode = SpatialMode::Bilateral;
  bool ccw = true;
  // Rotation dwell schedule: dwell per coil goes start, start+step, ... end,
  // then repeats (e.g. 10->20 ms step +2, or 25->11 ms step -2).
  float dwellStartMs = 20.0f;
  float dwellStepMs = 0.0f;
  float dwellEndMs = 20.0f;
  bool crossfade = false;    // blend into the next coil instead of a hard step
  Side side = Side::Right;   // Cycle
  bool ccwLeft = true;       // Cycle with Side::Both: direction per side
  bool ccwRight = true;
  float alternateMs = 2000.0f;  // Alternate: time spent on each side
  uint8_t channel = 0;       // Single
  float weights[kChannels] = {1, 1, 1, 1, 1, 1, 1, 1};
};

// Rotation order over all rotating coils; returns the number of entries.
int rotationOrder(const Geometry& g, bool ccw, int out[kChannels]);
// Rotation order within one side (the rotation order filtered by side).
int sideOrder(const Geometry& g, Side side, bool ccw, int out[kChannels]);
inline bool isLeft(const Geometry& g, int ch) { return g.side[ch] < 0; }
inline bool isRight(const Geometry& g, int ch) { return g.side[ch] > 0; }

// Layout overloads (standard layouts).
int rotationOrder(Layout layout, bool ccw, int out[kChannels]);
int sideOrder(Layout layout, Side side, bool ccw, int out[kChannels]);
bool isLeft(Layout layout, int channel);
bool isRight(Layout layout, int channel);

struct DwellPosition {
  uint64_t step;  // global step count since t = 0
  float frac;     // progress within the current dwell, 0..1
};
DwellPosition dwellPosition(const SpatialParams& s, double tMs);

void spatialGains(const SpatialParams& s, const Geometry& g, double tMs, float out[kChannels]);
void spatialGains(const SpatialParams& s, Layout layout, double tMs, float out[kChannels]);

const char* spatialModeName(SpatialMode mode);
bool spatialModeFromName(const char* name, SpatialMode& out);
const char* layoutName(Layout layout);
bool layoutFromName(const char* name, Layout& out);

}  // namespace engine
