#include "session.h"

#include <algorithm>

namespace engine {

uint32_t Session::totalMs() const {
  uint32_t total = 0;
  for (int i = 0; i < phaseCount; ++i) total += phases[i].durationMs;
  return total;
}

void Session::bindTable() {
  for (int i = 0; i < phaseCount; ++i) {
    PatternParams& p = phases[i].pattern;
    if (p.type != PatternType::Table) continue;
    p.table = table.empty() ? nullptr : table.data();
    p.tableLen = static_cast<uint32_t>(table.size());
  }
}

void SessionRunner::start(const Session* session) {
  session_ = session;
  programMs_ = 0;
  elapsedMs_ = 0;
  stopping_ = false;
  stopStartedMs_ = 0;
  frame_ = Frame{};
  frame_.running = session != nullptr && session->phaseCount > 0 && session->totalMs() > 0;
  update();
}

SessionRunner::Frame SessionRunner::advance(double dtMs) {
  if (!frame_.running) return frame_;
  programMs_ += dtMs;
  elapsedMs_ += dtMs;
  update();
  return frame_;
}

void SessionRunner::skipPhase() {
  if (!frame_.running || stopping_) return;
  const int next = frame_.phase + 1;
  if (next >= session_->phaseCount) {
    requestStop();
    return;
  }
  programMs_ = phaseStart(next);
  update();
}

void SessionRunner::requestStop() {
  if (!frame_.running || stopping_) return;
  stopping_ = true;
  stopStartedMs_ = elapsedMs_;
  update();
}

void SessionRunner::abort() {
  frame_.running = false;
  frame_.envelope = 0;
}

double SessionRunner::phaseStart(int phase) const {
  double t = 0;
  for (int i = 0; i < phase; ++i) t += session_->phases[i].durationMs;
  return t;
}

void SessionRunner::update() {
  if (!frame_.running) return;
  const double total = session_->totalMs();

  if (programMs_ >= total) {
    frame_.running = false;
    frame_.envelope = 0;
    frame_.programMs = total;
    frame_.elapsedMs = elapsedMs_;
    return;
  }

  int phase = 0;
  double start = 0;
  while (phase < session_->phaseCount - 1 && programMs_ >= start + session_->phases[phase].durationMs) {
    start += session_->phases[phase].durationMs;
    ++phase;
  }

  float env = 1.0f;
  if (session_->fadeInMs > 0)
    env = std::min(env, static_cast<float>(programMs_ / session_->fadeInMs));
  if (session_->fadeOutMs > 0)
    env = std::min(env, static_cast<float>((total - programMs_) / session_->fadeOutMs));
  const double phaseMs = programMs_ - start;
  if (phase > 0 && session_->phases[phase].crossfade)
    env = std::min(env, static_cast<float>(phaseMs / kPhaseRampMs));
  if (stopping_) {
    const double t = elapsedMs_ - stopStartedMs_;
    if (t >= kStopFadeMs) {
      frame_.running = false;
      frame_.envelope = 0;
      frame_.elapsedMs = elapsedMs_;
      return;
    }
    env = std::min(env, static_cast<float>(1.0 - t / kStopFadeMs));
  }

  frame_.phase = phase;
  frame_.phaseMs = phaseMs;
  frame_.programMs = programMs_;
  frame_.elapsedMs = elapsedMs_;
  frame_.envelope = std::max(0.0f, std::min(1.0f, env));
}

void render(const Session& session, const SessionRunner::Frame& frame, float out[kChannels]) {
  for (int ch = 0; ch < kChannels; ++ch) out[ch] = 0.0f;
  if (!frame.running || frame.phase >= session.phaseCount) return;
  const Phase& ph = session.phases[frame.phase];
  const float s = patternValue(ph.pattern, frame.phaseMs);
  const float scale = frame.envelope * ph.level * s;
  if (scale == 0.0f) return;
  float gains[kChannels];
  spatialGains(ph.spatial, session.layout, frame.phaseMs, gains);
  for (int ch = 0; ch < kChannels; ++ch) {
    float v = scale * gains[ch];
    out[ch] = v > 1.0f ? 1.0f : (v < -1.0f ? -1.0f : v);
  }
}

}  // namespace engine
