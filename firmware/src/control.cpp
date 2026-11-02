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

namespace control {
namespace {

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

bool coinFlip() {
  uint8_t b = 0;
  // The ADC noise source must not run while the radio uses the RF/ADC hardware.
  const bool radio = btStarted();
  if (!radio) bootloader_random_enable();
  esp_fill_random(&b, 1);
  if (!radio) bootloader_random_disable();
  return b & 1;
}

Result startSession(engine::Session* session, float fieldUT, bool blind, bool sham, float testMA,
                    const String& presetId) {
  logbook::Entry e;
  e.presetId = presetId;
  e.presetName = session->name;
  e.blind = blind;
  e.sham = sham;
  e.test = testMA != 0.0f;
  e.fieldUT = fieldUT;
  e.plannedMs = session->totalMs();
  // Flash writes (log file, NVS) happen before the start, so none stalls the
  // first seconds of the session.
  const uint32_t previous = gSettings.lastSessionEpoch;
  if (!e.test) markSessionTime();
  seq::StartRequest r;
  r.session = session;
  r.fieldUT = fieldUT;
  r.blind = blind;
  r.sham = sham;
  r.testMA = testMA;
  r.logId = e.test ? 0 : logbook::open(e);
  if (!seq::start(r)) {
    delete session;
    if (!e.test && gSettings.lastSessionEpoch != previous) {
      gSettings.lastSessionEpoch = previous;
      gSettings.saveLastSession();
    }
    return fail("sequencer queue full");
  }
  Result ok;
  ok.logId = r.logId;
  return ok;
}

Result startFromDoc(const mj::Value& doc, const String& presetId, double fieldUT, bool blind) {
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
  return startSession(s.release(), field, blind, sham, 0.0f, id);
}

Result startTest(const TestRequest& t) {
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
    return fail("mode must be dc, rotate, led or leds");
  }
  const String id = s->id;
  return startSession(s.release(), 0.0f, false, false, t.mA, id);
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
