#include "control.h"

#include <bootloader_random.h>
#include <esp32-hal-bt.h>
#include <esp_random.h>

#include <cmath>
#include <cstdio>
#include <memory>
#include <string>

#include "bench.h"
#include "config.h"
#include "drive.h"
#include "envdata.h"
#include "experiment.h"
#include "logbook.h"
#include "preset_json.h"
#include "sequencer.h"
#include "settings.h"
#include "start.h"

namespace control {
namespace {

// The last starts since boot, by token. Loop task only (as every start is).
struct Started {
  char token[resume::kTokenMax + 1] = {0};
  uint32_t logId = 0;
  uint32_t trialId = 0;
};
Started gStarted[4];
size_t gStartedNext = 0;

float minUTperMA() {
  float m = gSettings.uTperMA[0];
  for (float v : gSettings.uTperMA) m = std::fmin(m, v);
  return m;
}

Result fail(const String& message) {
  Result r;
  r.ok = false;
  r.error = message;
  return r;
}

}  // namespace

float clampField(double uT) {
  float f = static_cast<float>(uT);
  if (!(f > 0)) f = gSettings.defaultFieldUT;
  return std::fmin(f, gSettings.maxFieldUT);
}

bool startAllowed(String& error) {
  if (!gSettings.safetyAccepted) {
    error = "accept the safety page in the app first";  // same text as before (the app matches /safety/)
    return false;
  }
  if (seq::busy()) {
    error = "a session is already running";
    return false;
  }
  return true;
}

float maxReachableUT() { return engine::maxFieldUT(gSettings.drive, minUTperMA()); }

void markSessionTime() {
  if (envdata::now()) {
    gSettings.lastSessionEpoch = envdata::now();
    gSettings.saveLastSession();
  }
}

void fillRandom(void* buffer, size_t bytes) {
  // The ADC noise source must not run while the radio uses the RF/ADC hardware.
  const bool radio = btStarted();
  if (!radio) bootloader_random_enable();
  esp_fill_random(buffer, bytes);
  if (!radio) bootloader_random_disable();
}

bool coinFlip() {
  uint8_t b = 0;
  fillRandom(&b, 1);
  return b & 1;
}

TokenCheck checkToken(const String& token, Result& prior) {
  if (token.length() == 0) return TokenCheck::Fresh;
  if (!resume::validToken(token.c_str())) {
    prior = fail("token: 1 to 24 characters from A-Z a-z 0-9 _ -");
    return TokenCheck::Invalid;
  }
  const bool busy = seq::busy();
  for (const Started& s : gStarted) {
    if (resume::decideStart(busy, s.token, token.c_str()) != resume::StartDecision::Already) continue;
    prior = Result();
    prior.logId = s.logId;
    prior.trialId = s.trialId;
    prior.already = true;
    return TokenCheck::Already;
  }
  return TokenCheck::Fresh;
}

void rememberStart(const String& token, uint32_t logId, uint32_t trialId) {
  if (!resume::validToken(token.c_str())) return;
  Started& s = gStarted[gStartedNext];
  gStartedNext = (gStartedNext + 1) % (sizeof gStarted / sizeof gStarted[0]);
  std::snprintf(s.token, sizeof s.token, "%s", token.c_str());
  s.logId = logId;
  s.trialId = trialId;
}

bool openLog(const Launch& l, uint32_t& logId, String& error) {
  logId = 0;
  if (l.testMA != 0.0f) return true;  // calibration and wiring tests are not logged
  logbook::Entry e;
  e.presetId = l.presetId;
  e.presetName = l.session->name;
  e.blind = l.blind;
  e.sham = l.sham;
  e.fieldUT = l.fieldUT;
  e.plannedMs = l.session->totalMs();
  e.trialId = l.trialId;
  e.token = l.token;
  logId = logbook::open(e);
  if (logId != 0) return true;
  error = "cannot write the session log (storage full or failing): not started";
  return false;
}

bool launch(const Launch& l, uint32_t logId, String& error) {
  const bool test = l.testMA != 0.0f;
  // Flash writes (log file, NVS) happen before the start, so none stalls the
  // first seconds of the session.
  const uint32_t previous = gSettings.lastSessionEpoch;
  if (!test) markSessionTime();
  seq::StartRequest r;
  r.session = l.session;
  r.fieldUT = l.fieldUT;
  r.blind = l.blind;
  r.sham = l.sham;
  r.testMA = l.testMA;
  r.logId = logId;
  r.trialId = l.trialId;
  r.startEpoch = envdata::now();
  std::snprintf(r.token, sizeof r.token, "%s", resume::validToken(l.token.c_str()) ? l.token.c_str() : "");
  std::snprintf(r.presetId, sizeof r.presetId, "%s", l.presetId.c_str());
  if (seq::start(r)) return true;
  if (!test && gSettings.lastSessionEpoch != previous) {
    gSettings.lastSessionEpoch = previous;
    gSettings.saveLastSession();
  }
  logbook::discard(logId);  // no session: no entry
  error = "sequencer queue full";
  return false;
}

Result startSession(engine::Session* session, float fieldUT, bool blind, bool sham, float testMA,
                    const String& presetId, const String& token) {
  Launch l;
  l.session = session;
  l.fieldUT = fieldUT;
  l.blind = blind;
  l.sham = sham;
  l.testMA = testMA;
  l.presetId = presetId;
  l.token = token;
  uint32_t logId = 0;
  String error;
  if (!openLog(l, logId, error) || !launch(l, logId, error)) {
    delete session;
    return fail(error);
  }
  rememberStart(token, logId, 0);
  Result ok;
  ok.logId = logId;
  return ok;
}

Result startFromDoc(const mj::Value& doc, const String& presetId, double fieldUT, bool blind,
                    const String& token) {
  Result prior;
  if (checkToken(token, prior) != TokenCheck::Fresh) return prior;
  String error;
  if (!startAllowed(error)) return fail(error);
  if (!doc.isObject()) return fail("session missing");
  std::unique_ptr<engine::Session> s(new engine::Session());
  engine::PresetInfo info;
  std::string err;
  if (!engine::sessionFromJson(doc, *s, &info, &err)) return fail(err.c_str());
  // Blind: the hardware RNG picks real or sham; the log reveals it after rating.
  const bool sham = blind ? coinFlip() : (std::string(s->id) == "sham");
  const String id = presetId.length() ? presetId : String(s->id);
  const float field = clampField(fieldUT < 0 ? info.uT : fieldUT);
  return startSession(s.release(), field, blind, sham, 0.0f, id, token);
}

Result startTest(const TestRequest& t) {
  Result prior;
  if (checkToken(t.token, prior) != TokenCheck::Fresh) return prior;
  String error;
  if (!startAllowed(error)) return fail(error);
  if (std::fabs(t.mA) > limits::kMaxTestMA || t.mA == 0) return fail("mA must be non-zero, |mA| <= 4.6");
  if (t.seconds == 0 || t.seconds > limits::kMaxTestSeconds) return fail("seconds must be 1..120");

  std::unique_ptr<engine::Session> s(new engine::Session());
  s->fadeInMs = 500;
  s->fadeOutMs = 500;
  s->phaseCount = 1;
  engine::Phase& ph = s->phases[0];
  ph.durationMs = t.seconds * 1000;
  ph.pattern = engine::patternDefaults(engine::PatternType::DC);
  if (!engine::layoutFromName(t.layout.c_str(), s->layout) || s->layout == engine::Layout::Custom)
    s->layout = engine::Layout::Temporal;
  s->geometry = engine::geometryFor(s->layout);
  if (t.mode == "dc") {
    if (t.channel < 0 || t.channel > 7) return fail("channel must be 0..7");
    ph.spatial.mode = engine::SpatialMode::Single;
    ph.spatial.channel = static_cast<uint8_t>(t.channel);
    std::snprintf(s->id, sizeof s->id, "test-dc");
    std::snprintf(s->name, sizeof s->name, "DC test CH%d %.2f mA", t.channel + 1, t.mA);
    std::snprintf(ph.name, sizeof ph.name, "DC CH%d", t.channel + 1);
  } else if (t.mode == "dcall") {
    // All eight outputs at the same current and sign: the module's full load
    // (supply current, both ±12 V rails, every resistor at once).
    ph.spatial.mode = engine::SpatialMode::Bilateral;
    std::snprintf(s->id, sizeof s->id, "test-dc-all");
    std::snprintf(s->name, sizeof s->name, "DC test all 8 outputs %.2f mA", t.mA);
    std::snprintf(ph.name, sizeof ph.name, "DC all");
  } else if (t.mode == "rotate") {
    ph.spatial.mode = engine::SpatialMode::Rotate;
    ph.spatial.ccw = t.ccw;
    ph.spatial.dwellStartMs = ph.spatial.dwellEndMs = t.dwellMs;
    std::snprintf(s->id, sizeof s->id, "test-rotate");
    std::snprintf(s->name, sizeof s->name, "Slow rotation test %.2f mA", t.mA);
    std::snprintf(ph.name, sizeof ph.name, "Rotate");
  } else if (t.mode == "led" || t.mode == "leds") {
    // Two LEDs (one each way round) in place of a coil, flashing blinkHz times a second.
    if (t.mode == "led" && (t.channel < 0 || t.channel > 7)) return fail("channel must be 0..7");
    std::string err;
    if (!engine::ledTestSession(*s, t.mode == "led" ? t.channel : -1, t.blinkHz, t.seconds, &err))
      return fail(err.c_str());
  } else {
    return fail("mode must be dc, dcall, rotate, led or leds");
  }
  const String id = s->id;
  return startSession(s.release(), 0.0f, false, false, t.mA, id, t.token);
}

bool rate(uint32_t logId, int rating, const String& notes, String& json, String& error) {
  // Rating reveals real or sham: not while that session is still running.
  // (A record cut off by a power loss stays unfinished but can still be rated.)
  if (seq::busy() && seq::status().logId == logId) {
    error = "rate after the session ends";
    return false;
  }
  // A trial's session stays blind until the trial itself is revealed (or aborted).
  if (const uint32_t trial = logbook::trialOf(logId)) {
    const String state = experiment::stateOf(trial);
    if (state.length() && state != "revealed" && state != "aborted") {
      error = "rate after the trial is revealed";
      return false;
    }
  }
  return logbook::rate(logId, rating, notes, json, error);
}

}  // namespace control
