// Host stand-ins for the firmware modules the touchscreen UI calls. The
// sequencer is a fake clock that walks through the program's phases; the SD
// card is a folder on disk (the output of `npm run sd-pack`).
#include <Arduino.h>

#include <algorithm>
#include <cmath>
#include <ctime>
#include <fstream>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

#include "bench.h"
#include "ble.h"
#include "config.h"
#include "control.h"
#include "display.h"
#include "drive.h"
#include "envdata.h"
#include "logbook.h"
#include "preset_json.h"
#include "sdcard.h"
#include "sequencer.h"
#include "settings.h"
#include "timesync.h"

// ------------------------------------------------------------ Arduino

namespace sim {
uint32_t nowMs = 0;
std::string packRoot;
bool timeValid = false;
uint32_t epochAtZero = 0;  // unix time at nowMs == 0, when the clock is set
bool restarted = false;
}  // namespace sim

uint32_t millis() { return sim::nowMs; }
namespace sim {
bool bootDown = false;
}
int digitalRead(int) { return sim::bootDown ? LOW : HIGH; }  // the BOOT button
void delay(uint32_t ms) { sim::nowMs += ms; }
EspClass ESP;
void EspClass::restart() { sim::restarted = true; }

Settings gSettings;
void Settings::load() {}
void Settings::save() const {}
void Settings::saveLastSession() const {}
String Settings::toJson() const { return "{}"; }
bool Settings::applyJson(const String&, String&) { return true; }

// ------------------------------------------------------------ display

namespace {
Lcd gLcd;
uint8_t gLevel = 0;
}  // namespace

namespace display {
Lcd& lcd() { return gLcd; }
const char* begin(uint8_t) {
  gLcd.setColorDepth(16);
  gLcd.createSprite(240, 320);
  gLcd.fillScreen(TFT_BLACK);
  return "ILI9341";
}
void backlight(uint8_t level) { gLevel = level; }
uint8_t backlightLevel() { return gLevel; }
}  // namespace display

// ------------------------------------------------------------ clock

namespace envdata {
bool timeValid() { return sim::timeValid; }
uint32_t now() { return sim::timeValid ? sim::epochAtZero + sim::nowMs / 1000 : 0; }
}  // namespace envdata

namespace timesync {
bool setLocal(int year, int month, int day, int hour, int minute) {
  tm t{};
  t.tm_year = year - 1900;
  t.tm_mon = month - 1;
  t.tm_mday = day;
  t.tm_hour = hour;
  t.tm_min = minute;
  t.tm_isdst = -1;
  const time_t epoch = mktime(&t);
  sim::epochAtZero = static_cast<uint32_t>(epoch) - sim::nowMs / 1000;
  sim::timeValid = true;
  return true;
}
String localString(uint32_t epoch) {
  if (!epoch) return "time not set";
  const time_t t = epoch;
  tm local{};
  localtime_r(&t, &local);
  char buf[24];
  strftime(buf, sizeof buf, "%Y-%m-%d %H:%M", &local);
  return buf;
}
}  // namespace timesync

namespace ble {
int connections() { return 0; }
void loop() {}
}  // namespace ble

namespace usblink {
int connections() { return 0; }
void loop() {}
}  // namespace usblink

// ------------------------------------------------------------ SD card (a folder)

namespace sdcard {
bool mounted() { return !sim::packRoot.empty(); }
String describe() { return "15.9 GB card"; }
bool begin() { return mounted(); }
bool remount() { return mounted(); }
static std::string local(const String& path) { return sim::packRoot + path.c_str(); }
bool readFile(const String& path, std::string& out, size_t maxBytes, String& error) {
  std::ifstream f(local(path), std::ios::binary);
  if (!f) {
    error = "not on the card: " + path;
    return false;
  }
  std::stringstream ss;
  ss << f.rdbuf();
  out = ss.str();
  if (out.size() > maxBytes) {
    error = "file too large: " + path;
    return false;
  }
  return true;
}
bool forEachLine(const String& path, const std::function<bool(const String&)>& fn, String& error) {
  std::ifstream f(local(path));
  if (!f) {
    error = "not on the card: " + path;
    return false;
  }
  std::string line;
  while (std::getline(f, line))
    if (!fn(String(line))) break;
  return true;
}
bool exists(const String& path) { return std::ifstream(local(path)).good(); }
}  // namespace sdcard

// ------------------------------------------------------------ sequencer (fake clock)

namespace {
struct Running {
  bool active = false, test = false, blind = false, sham = false;
  uint32_t startMs = 0, skipMs = 0, totalMs = 0, logId = 0;
  float fieldUT = 1, testMA = 0;
  std::string id, name;
  std::vector<std::pair<std::string, uint32_t>> phases;
} gRun;
seq::Status gLast;
uint32_t gNextLog = 7;

// As the real sequencer: idle, blind/test/levels cleared, the name and times kept.
void finish(const char* reason) {
  gRun.active = false;
  std::snprintf(gLast.lastStopReason, sizeof gLast.lastStopReason, "%s", reason);
  gLast.state = seq::State::Idle;
  gLast.blind = false;
  gLast.test = false;
  for (float& l : gLast.levels) l = 0;
}
}  // namespace

namespace seq {
Status status() {
  if (!gRun.active) return gLast;
  const uint32_t elapsed = sim::nowMs - gRun.startMs;
  const uint32_t program = elapsed + gRun.skipMs;
  if (program >= gRun.totalMs) {
    finish("completed");
    return gLast;
  }
  Status s;
  s.state = State::Running;
  s.blind = gRun.blind;
  s.test = gRun.test;
  s.logId = gRun.logId;
  std::snprintf(s.sessionId, sizeof s.sessionId, "%s", gRun.id.c_str());
  std::snprintf(s.sessionName, sizeof s.sessionName, "%s", gRun.name.c_str());
  s.phaseCount = static_cast<int>(gRun.phases.size());
  uint32_t t = 0;
  for (size_t i = 0; i < gRun.phases.size(); ++i) {
    if (program < t + gRun.phases[i].second || i + 1 == gRun.phases.size()) {
      s.phase = static_cast<int>(i);
      s.phaseMs = program - t;
      s.phaseDurationMs = gRun.phases[i].second;
      std::snprintf(s.phaseName, sizeof s.phaseName, "%s", gRun.phases[i].first.c_str());
      break;
    }
    t += gRun.phases[i].second;
  }
  s.elapsedMs = elapsed;
  s.programMs = program;
  s.totalMs = gRun.totalMs;
  s.fieldUT = gRun.fieldUT;
  s.testMA = gRun.testMA;
  for (int ch = 0; ch < 8; ++ch)
    s.levels[ch] = gRun.sham ? 0.0f : static_cast<float>(0.5 + 0.5 * std::sin(program / 300.0 + ch));
  gLast = s;
  return s;
}
bool busy() { return gRun.active && (status(), gRun.active); }
void emergencyStop(const char* reason) {
  gLast = status();
  finish(reason);
}
void stop(const char* reason) { emergencyStop(reason); }
void skipPhase() {
  const Status s = status();
  if (s.phase + 1 < s.phaseCount) gRun.skipMs += s.phaseDurationMs - s.phaseMs;
}
void setField(float uT) { gRun.fieldUT = uT; }
void keepalive() {}
}  // namespace seq

// ------------------------------------------------------------ control

namespace control {
float clampField(double uT) {
  float f = static_cast<float>(uT);
  if (!(f > 0)) f = gSettings.defaultFieldUT;
  return std::fmin(f, gSettings.maxFieldUT);
}
float maxReachableUT() {
  float m = gSettings.uTperMA[0];
  for (float v : gSettings.uTperMA) m = std::fmin(m, v);
  return engine::maxFieldUT(gSettings.drive, m);
}
bool startAllowed(String& error) {
  if (!gSettings.safetyAccepted) {
    error = "accept the safety page first";
    return false;
  }
  if (seq::busy()) {
    error = "a session is already running";
    return false;
  }
  return true;
}
Result startFromDoc(const mj::Value& doc, const String& presetId, double fieldUT, bool blind, const String&) {
  Result r;
  if (!startAllowed(r.error)) {
    r.ok = false;
    return r;
  }
  std::unique_ptr<engine::Session> s(new engine::Session());
  engine::PresetInfo info;
  std::string err;
  if (!engine::sessionFromJson(doc, *s, &info, &err)) {
    r.ok = false;
    r.error = err.c_str();
    return r;
  }
  gRun = Running();
  gRun.active = true;
  gRun.blind = blind;
  gRun.sham = blind;  // the tool shows the sham reveal
  gRun.startMs = sim::nowMs;
  gRun.totalMs = s->totalMs();
  gRun.fieldUT = clampField(fieldUT < 0 ? info.uT : fieldUT);
  gRun.id = presetId.c_str();
  gRun.name = s->name;
  for (int i = 0; i < s->phaseCount; ++i) gRun.phases.emplace_back(s->phases[i].name, s->phases[i].durationMs);
  gRun.logId = r.logId = gNextLog++;
  if (sim::timeValid) gSettings.lastSessionEpoch = envdata::now();
  return r;
}
Result startTest(const TestRequest& t) {
  Result r;
  gRun = Running();
  gRun.active = true;
  gRun.test = true;
  gRun.startMs = sim::nowMs;
  gRun.totalMs = t.seconds * 1000;
  gRun.testMA = t.mA;
  if (t.mode == "led" || t.mode == "leds") {  // the firmware's own LED test session
    engine::Session s;
    std::string err;
    if (!engine::ledTestSession(s, t.mode == "led" ? t.channel : -1, t.blinkHz, t.seconds, &err)) {
      gRun = Running();
      r.ok = false;
      r.error = err.c_str();
      return r;
    }
    gRun.name = s.name;
    gRun.totalMs = 0;
    for (int i = 0; i < s.phaseCount; ++i) {
      gRun.phases.emplace_back(s.phases[i].name, s.phases[i].durationMs);
      gRun.totalMs += s.phases[i].durationMs;
    }
    return r;
  }
  char name[96];
  if (t.mode == "dc") std::snprintf(name, sizeof name, "DC test CH%d %.2f mA", t.channel + 1, t.mA);
  else std::snprintf(name, sizeof name, "Slow rotation test %.2f mA", t.mA);
  gRun.name = name;
  gRun.phases.emplace_back(t.mode == "dc" ? "DC" : "Rotate", gRun.totalMs);
  return r;
}
bool rate(uint32_t, int rating, const String&, String& json, String&) {
  json = String("{\"condition\":\"") + (gRun.sham ? "sham" : "active") + "\",\"rating\":" + String(rating) + "}";
  return true;
}
}  // namespace control

// ------------------------------------------------------------ log

namespace logbook {
void writeList(mj::Writer& w, size_t offset, size_t limit) {
  struct Row {
    const char* name;
    uint32_t daysAgo, planned, elapsed;
    int rating;
    bool blind;
    const char* condition;
  };
  static const Row rows[] = {
      {"8 Coil Shakti two-phase: hippocampus both sides, then amygdala left", 4, 2400000, 2400000, -1, true, "hidden"},
      {"Thomas pulse, slow rotation", 9, 1800000, 1800000, 6, true, "sham"},
      {"Burst-x on the right temporal lobe", 14, 1200000, 410000, 2, false, "active"},
      {"Frequency-modulated 7 Hz, both sides", 21, 1800000, 1800000, 4, false, "active"},
      {"Sham control", 30, 1200000, 1200000, 1, false, "sham"},
      {"Ramped theta bursts", 36, 900000, 900000, 3, false, "active"},
      {"Persinger 'Thomas' sequence, 30 min", 44, 1800000, 1800000, 5, true, "active"},
  };
  const size_t n = sizeof rows / sizeof rows[0];
  w.key("total").integer(n);
  w.key("items").beginArray();
  const uint32_t now = envdata::now() ? envdata::now() : 1793000000u;
  for (size_t i = offset; i < n && i < offset + limit; ++i) {
    const Row& r = rows[i];
    w.beginObject();
    w.key("id").integer(100 - i);
    w.key("start").integer(now - r.daysAgo * 86400u - 7200u);
    w.key("presetId").string("x");
    w.key("presetName").string(r.name);
    w.key("blind").boolean(r.blind);
    w.key("condition").string(r.condition);
    w.key("fieldUT").number(1.0, 3);
    w.key("plannedMs").integer(r.planned);
    w.key("elapsedMs").integer(r.elapsed);
    w.key("finished").boolean(true);
    w.key("completed").boolean(r.elapsed == r.planned);
    w.key("reason").string(r.elapsed == r.planned ? "completed" : "STOP on screen");
    w.key("rating").integer(r.rating);
    w.endObject();
  }
  w.endArray();
}
}  // namespace logbook
