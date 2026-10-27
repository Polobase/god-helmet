// Preset/session JSON -> engine::Session.
//
// {
//   "id": "god-helmet-classic", "name": "...", "layout": "temporal" | "ring" | "custom",
//   "placement": {"sites": ["T8","TP8",...8 names, "" = unused],   // custom only
//                 "order": [0,1,2,...]},  // optional CCW rotation order (default: used channels)
//   "uT": 1.0, "fadeInS": 10, "fadeOutS": 10,
//   "phases": [{
//     "name": "...", "minutes": 25, "level": 1, "crossfade": false,
//     "pattern": {"type": "chirp", "f0": 4, "f1": 40, "sweepMs": 2000,
//                 "gapMs": 0, "pointMs": 1, "pulseMs": 100, "alternate": true,
//                 "seed": 1, "depth": 3, "data": [0..255 point table]},
//     -- or, for two simultaneous signals: "tracks": [{"pattern", "spatial", "level"}, {...}] --
//     "spatial": {"mode": "cycle", "side": "right" | "left" | "both", "dir": "ccw",
//                 "dirLeft": "cw", "dirRight": "ccw",   // side "both": per-side direction
//                 "dwellMs": 3 | "dwell": [start, step, end],
//                 "crossfade": false, "alternateMs": 2000, "channel": 0,
//                 "weights": [1,1,1,1,1,1,1,1]}
//   }],
//   "tableData": [128, 200, 255, ...]   // optional, for "table" patterns
// }
// Missing pattern fields take engine::patternDefaults() for that type.
#pragma once
#include <string>

#include "minijson.h"
#include "session.h"

namespace engine {

constexpr uint32_t kMaxSessionMs = 60u * 60u * 1000u;  // hard cap: 60 min
constexpr size_t kMaxTablePoints = 8192;   // per table
constexpr size_t kMaxTablePool = 16384;    // all tables of one session

struct PresetInfo {
  float uT = 1.0f;          // suggested peak field at calibration depth
  std::string category;
  std::string summary;
  std::string source;
};

bool sessionFromJson(const mj::Value& doc, Session& out, PresetInfo* info, std::string* error);

}  // namespace engine
