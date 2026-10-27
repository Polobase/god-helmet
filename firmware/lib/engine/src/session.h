// Multi-phase sessions and the per-tick renderer.
//
// A session is a list of phases (e.g. Persinger's "right hemisphere chirp
// 20-30 min -> abrupt switch -> bilateral burst-firing 20-30 min"). Each phase
// combines one temporal pattern with one spatial mode. The runner advances
// time, applies fade in/out and soft stops; render() turns a frame into eight
// normalised coil drives v_ch in [-1, 1].
#pragma once
#include <cstdint>
#include <vector>

#include "patterns.h"
#include "spatial.h"

namespace engine {

constexpr int kMaxPhases = 12;

struct Phase {
  char name[64] = {0};
  uint32_t durationMs = 0;
  PatternParams pattern;
  SpatialParams spatial;
  float level = 1.0f;       // relative amplitude of this phase, 0..1
  bool crossfade = false;   // ramp in over kPhaseRampMs instead of switching abruptly
  // Optional second simultaneous track ("stereo", e.g. burst-firing on the
  // left and theta-burst on the right); the two tracks are summed per coil.
  bool hasTrack2 = false;
  PatternParams pattern2;
  SpatialParams spatial2;
  float level2 = 1.0f;
};

struct Session {
  char id[64] = {0};
  char name[96] = {0};
  Layout layout = Layout::Temporal;
  Geometry geometry = geometryFor(Layout::Temporal);  // sides + rotation order used by render()
  char sites[kChannels][8] = {{0}};                    // 10-10 site per channel ("" = not used)
  uint8_t phaseCount = 0;
  Phase phases[kMaxPhases];
  uint32_t fadeInMs = 10000;
  uint32_t fadeOutMs = 10000;
  std::vector<int8_t> table;  // pool for Table patterns (session tableData + inline pattern data)

  uint32_t totalMs() const;
  // Points every Table-pattern phase at this session's table storage.
  void bindTable();
};

class SessionRunner {
 public:
  static constexpr double kPhaseRampMs = 2000.0;
  static constexpr double kStopFadeMs = 2000.0;

  struct Frame {
    bool running = false;   // false once finished or not started
    int phase = 0;
    double phaseMs = 0;     // time inside the current phase
    double programMs = 0;   // position on the session timeline (jumps on skip)
    double elapsedMs = 0;   // wall time since start
    float envelope = 0;     // fades, 0..1
  };

  void start(const Session* session);
  // Advances by dtMs and returns the new frame.
  Frame advance(double dtMs);
  Frame frame() const { return frame_; }
  void skipPhase();
  void requestStop();   // fade out over kStopFadeMs, then finish
  void abort();         // finish immediately
  bool running() const { return frame_.running; }
  bool stopping() const { return stopping_; }
  const Session* session() const { return session_; }

 private:
  double phaseStart(int phase) const;
  void update();

  const Session* session_ = nullptr;
  Frame frame_;
  double programMs_ = 0;
  double elapsedMs_ = 0;
  bool stopping_ = false;
  double stopStartedMs_ = 0;
};

// v_ch = envelope * phase.level * g_ch(t) * s(t)
void render(const Session& session, const SessionRunner::Frame& frame, float out[kChannels]);

}  // namespace engine
