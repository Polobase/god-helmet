#include "pcbops.h"

#ifdef HAS_PCB_DRIVER
#include <LittleFS.h>

#include <cmath>
#include <cstdio>
#include <cstring>
#include <algorithm>
#include <memory>
#include <string>
#include <vector>

#include "board.h"
#include "control.h"
#include "envdata.h"
#include "pcbboard.h"
#include "sequencer.h"
#include "session.h"
#include "settings.h"
#include "tes.h"
#include "usblink.h"

namespace pcbops {
namespace {

constexpr const char* kCoilCheckId = "coils-check";
constexpr float kCoilCheckMA = 1.0f;
constexpr uint32_t kCoilCheckPhaseMs = 1000;
// The tES safety text the app showed: tes.start must name it.
constexpr const char* kTesSafety = "tes-v1";

struct CoilCheck {
  bool running = false, done = false;
  float sumMA[8] = {0}, sumOut[8] = {0};
  int n[8] = {0};
  pcb::CoilVerdict verdict[8];
  pcb::CoilReading reading[8];
  char stopped[40] = {0};
} gCoils;

struct TesCheck {
  bool running = false, done = false;
  float plannedMA = 2.0f;
  bool used[tes::kChannels] = {false, false};
  tes::Impedance z[tes::kChannels];
} gTesCheck;

// Blind tES: drawn here, kept in memory, told after the session.
bool gTesBlind = false, gTesSham = false, gTesRevealable = false;

// The tES journal: one JSON line per session in /log/tes.jsonl, written when it ends (in the Arduino loop, as the
// session log is). A blind session's line holds its condition, and tes.log withholds it until a "reveal" line
// for that id follows (tes.reveal writes one).
constexpr const char* kTesLog = "/log/tes.jsonl";
tes::Plan gTesPlan;
uint32_t gTesStartEpoch = 0;
bool gTesLogPending = false;  // a stimulation (not a check) runs and is not written yet
uint32_t gTesLastId = 0;

uint32_t tesLogLines() {
  File f = LittleFS.open(kTesLog, "r");
  if (!f) return 0;
  uint32_t n = 0;
  while (f.available()) n += f.read() == '\n' ? 1 : 0;
  f.close();
  return n;
}

bool tesLogAppend(const std::string& line) {
  File f = LittleFS.open(kTesLog, "a");
  if (!f) return false;
  const bool ok = f.print(line.c_str()) == line.size() && f.print("\n") == 1;
  f.close();
  return ok;
}

const char* modeName(tes::Mode m) { return m == tes::Mode::DC ? "dc" : m == tes::Mode::AC ? "ac" : "rns"; }

void tesLogSession(const seq::Status& st) {
  gTesLastId = tesLogLines() + 1;
  mj::Writer w;
  w.beginObject();
  w.key("id").integer(gTesLastId);
  w.key("epoch").integer(gTesStartEpoch);
  w.key("mode").string(modeName(gTesPlan.mode));
  w.key("mA").beginArray().number(gTesPlan.mA[0], 3).number(gTesPlan.mA[1], 3).endArray();
  if (gTesPlan.mode == tes::Mode::AC) w.key("hz").number(gTesPlan.hz, 2);
  if (gTesPlan.mode == tes::Mode::RNS) w.key("band").beginArray().number(gTesPlan.lowHz, 1).number(gTesPlan.highHz, 1).endArray();
  w.key("holdS").integer(gTesPlan.holdS);
  w.key("rampS").beginArray().number(gTesPlan.rampUpS, 1).number(gTesPlan.rampDownS, 1).endArray();
  w.key("blind").boolean(gTesBlind);
  w.key("sham").boolean(gTesSham);
  w.key("elapsedS").number(st.tesElapsedS, 1);
  w.key("chargeC").number(st.tesChargeC, 4);
  w.key("reason").string(st.tesStopReason);
  w.endObject();
  if (!tesLogAppend(w.str())) usblink::logf("tES journal: entry %lu not written\n", static_cast<unsigned long>(gTesLastId));
}

bool usbHostPresent() { return pcbboard::snapshot().usbHost || usblink::connections() > 0; }

bool islandAlive() {
  // The island's ADC echoes its range settings at every scan (pcbboard.cpp); at rest both setpoints read 0 mA.
  const pcbboard::Snapshot s = pcbboard::snapshot();
  return s.tesAdcOk && std::fabs(s.tesSetMA[0]) < 0.2f && std::fabs(s.tesSetMA[1]) < 0.2f;
}

bool tesStartAllowed(String& error) {
  if (!gSettings.safetyAccepted) {
    error = "accept the safety page in the app first";
    return false;
  }
  if (seq::busy()) {
    error = "a session is already running";
    return false;
  }
  if (usbHostPresent()) {
    error = "tES runs only on a power bank, controlled over Bluetooth: unplug the computer";
    return false;
  }
  if (pcbboard::stopLatched()) {
    pcbboard::clearLatches();
    if (pcbboard::stopLatched()) {
      error = "STOP is pressed (or its jack is shorted)";
      return false;
    }
  }
  if (pcbboard::tesFaultLatched()) {
    error = "the tES trip latch is set";
    return false;
  }
  if (!islandAlive()) {
    error = "the tES island does not answer (its power or its ADC)";
    return false;
  }
  return true;
}

uint32_t seed() {
  uint32_t s = 0;
  control::fillRandom(&s, sizeof s);
  return s;
}

}  // namespace

void begin() {
  pcbboard::begin();
  // Current drive from the start, so hello's reachable field is the board's; the ceiling is read again before
  // every start (coilStartAllowed).
  gSettings.drive.fullScaleMA = 2.5f / 124.0f * 1000.0f;
  gSettings.drive.ceilingMA = pcbboard::ceilingMA();
}

bool coilStartAllowed(String& error) {
  const float ceiling = pcbboard::ceilingMA();
  if (ceiling <= 0.0f) {
    error = "the coil ceiling switch reads neither 5 nor 20 mA";
    return false;
  }
  // The monitor logs every coil's real current (also the proof of a real or sham session): no start without it.
  if (!pcbboard::snapshot().valid) {
    error = "the coil monitor (ADS8688) does not answer";
    return false;
  }
  // Runtime only, never saved: the switch is read again before every start.
  gSettings.drive.fullScaleMA = 2.5f / pcb::kRsOhm * 1000.0f;
  gSettings.drive.ceilingMA = ceiling;
  if (!pcbboard::clearLatches()) {
    error = pcbboard::stopLatched() ? "STOP is pressed (or its jack is shorted)" : "the coil trip latch does not clear";
    return false;
  }
  return true;
}

bool coilsCheck(String& error) {
  if (!control::startAllowed(error)) return false;
  std::unique_ptr<engine::Session> s(new engine::Session());
  s->fadeInMs = 300;
  s->fadeOutMs = 300;
  s->phaseCount = 8;
  std::snprintf(s->id, sizeof s->id, "%s", kCoilCheckId);
  std::snprintf(s->name, sizeof s->name, "Coil check, %.1f mA each", static_cast<double>(kCoilCheckMA));
  for (int k = 0; k < 8; ++k) {
    engine::Phase& ph = s->phases[k];
    ph.durationMs = kCoilCheckPhaseMs;
    ph.pattern = engine::patternDefaults(engine::PatternType::DC);
    ph.spatial.mode = engine::SpatialMode::Single;
    ph.spatial.channel = static_cast<uint8_t>(k);
    std::snprintf(ph.name, sizeof ph.name, "Coil %d", k + 1);
  }
  s->geometry = engine::geometryFor(s->layout);
  const control::Result r = control::startSession(s.release(), 1.0f, false, false, kCoilCheckMA, "", "");
  if (!r.ok) {
    error = r.error;
    return false;
  }
  gCoils = CoilCheck{};
  gCoils.running = true;
  return true;
}

bool tesCheck(const mj::Value& v, String& error) {
  if (!tesStartAllowed(error)) return false;
  tes::Plan p;
  p.mode = tes::Mode::AC;
  p.hz = 10.0f;
  p.holdS = 2;
  p.rampUpS = p.rampDownS = 0.5f;
  const mj::Value& ch = v["channels"];
  for (int k = 0; k < tes::kChannels; ++k) p.mA[k] = !ch.isArray() || ch[static_cast<size_t>(k)].boolean(false) ? 0.1f : 0.0f;
  if (p.mA[0] == 0.0f && p.mA[1] == 0.0f) {
    error = "no channel to check";
    return false;
  }
  gTesCheck = TesCheck{};
  for (int k = 0; k < tes::kChannels; ++k) gTesCheck.used[k] = p.mA[k] != 0.0f;
  gTesCheck.plannedMA = static_cast<float>(v["mA"].num(2.0));
  if (!seq::startTes(p, seed(), false, true)) {
    error = "busy";
    return false;
  }
  gTesCheck.running = true;
  return true;
}

bool tesStart(const mj::Value& v, String& error) {
  if (std::string(v["safety"].str("")) != kTesSafety) {
    error = "the app must show the tES safety page (tes-v1) first";
    return false;
  }
  if (!tesStartAllowed(error)) return false;
  tes::Plan p;
  const std::string mode = v["mode"].str("dc");
  if (mode == "dc") p.mode = tes::Mode::DC;
  else if (mode == "ac") p.mode = tes::Mode::AC;
  else if (mode == "rns") p.mode = tes::Mode::RNS;
  else {
    error = "mode is dc, ac or rns";
    return false;
  }
  const mj::Value& ma = v["mA"];
  for (int k = 0; k < tes::kChannels; ++k) p.mA[k] = ma.isArray() ? static_cast<float>(ma[static_cast<size_t>(k)].num(0)) : 0.0f;
  p.hz = static_cast<float>(v["hz"].num(10));
  p.lowHz = static_cast<float>(v["lowHz"].num(0.1));
  p.highHz = static_cast<float>(v["highHz"].num(640));
  const double minutes = v["minutes"].num(20);
  p.holdS = minutes > 0 && minutes < 1000 ? static_cast<uint32_t>(minutes * 60.0) : 0;
  p.rampUpS = static_cast<float>(v["rampUpS"].num(30));
  p.rampDownS = static_cast<float>(v["rampDownS"].num(30));
  const bool blind = v["blind"].boolean(false);
  p.sham = blind ? control::coinFlip() : v["sham"].boolean(false);
  char err[96];
  if (!tes::validate(p, tes::Limits{}, err, sizeof err)) {
    error = err;
    return false;
  }
  if (!seq::startTes(p, seed(), blind, false)) {
    error = "busy";
    return false;
  }
  gTesBlind = blind;
  gTesSham = p.sham;
  gTesRevealable = false;
  gTesPlan = p;
  gTesStartEpoch = envdata::now();
  gTesLogPending = true;
  return true;
}

bool tesLog(mj::Writer& w, String& error) {
  File f = LittleFS.open(kTesLog, "r");
  w.beginObject().key("items").beginArray();
  if (f) {
    // First the ids that have been revealed, then the entries with blind conditions withheld.
    std::string text;
    while (f.available()) text += static_cast<char>(f.read());
    f.close();
    std::vector<uint32_t> revealed;
    size_t pos = 0;
    while (pos < text.size()) {
      const size_t end = text.find('\n', pos);
      mj::Value v;
      std::string err;
      if (mj::parse(text.substr(pos, end - pos), v, &err) && v.has("reveal")) revealed.push_back(static_cast<uint32_t>(v["reveal"].num(0)));
      if (end == std::string::npos) break;
      pos = end + 1;
    }
    pos = 0;
    while (pos < text.size()) {
      const size_t end = text.find('\n', pos);
      const std::string line = text.substr(pos, end - pos);
      mj::Value v;
      std::string err;
      if (mj::parse(line, v, &err) && v.has("id")) {
        const uint32_t id = static_cast<uint32_t>(v["id"].num(0));
        const bool hide = v["blind"].boolean(false) && std::find(revealed.begin(), revealed.end(), id) == revealed.end();
        if (!hide) {
          w.raw(line.c_str());
        } else {
          // The same entry without its condition.
          w.beginObject();
          for (const auto& m : v.members()) {
            if (m.first == "sham") continue;
            w.key(m.first.c_str());
            if (m.second.isNumber()) w.number(m.second.num(), 4);
            else if (m.second.isString()) w.string(m.second.str());
            else if (m.second.type() == mj::Value::Type::Bool) w.boolean(m.second.boolean());
            else if (m.second.isArray()) {
              w.beginArray();
              for (size_t i = 0; i < m.second.size(); ++i) w.number(m.second[i].num(), 3);
              w.endArray();
            } else w.null();
          }
          w.endObject();
        }
      }
      if (end == std::string::npos) break;
      pos = end + 1;
    }
  }
  w.endArray().endObject();
  (void)error;
  return true;
}

bool tesReveal(mj::Writer& w, String& error) {
  if (!gTesBlind) {
    error = "no blind tES session";
    return false;
  }
  if (!gTesRevealable) {
    error = "the session has not ended";
    return false;
  }
  w.beginObject().key("sham").boolean(gTesSham).key("id").integer(gTesLastId).endObject();
  // The journal tells it from now on as well.
  mj::Writer r;
  r.beginObject().key("reveal").integer(gTesLastId).endObject();
  if (gTesLastId) tesLogAppend(r.str());
  gTesBlind = false;
  return true;
}

void loop() {
  const seq::Status st = seq::status();
  // The coil check: the second half of each 1 s phase, averaged.
  if (gCoils.running) {
    const bool ours = std::strcmp(st.sessionId, kCoilCheckId) == 0;
    if (ours && st.state != seq::State::Idle && st.phase >= 0 && st.phase < 8 && st.phaseMs >= 600 && st.phaseMs <= 950) {
      const pcbboard::Snapshot s = pcbboard::snapshot();
      gCoils.sumMA[st.phase] += s.coilMA[st.phase];
      gCoils.sumOut[st.phase] += s.coilOutV[st.phase];
      gCoils.n[st.phase]++;
    }
    if (st.state == seq::State::Idle && !seq::busy()) {
      gCoils.running = false;
      gCoils.done = true;
      std::snprintf(gCoils.stopped, sizeof gCoils.stopped, "%s", st.lastStopReason);
      for (int k = 0; k < 8; ++k) {
        pcb::CoilReading& r = gCoils.reading[k];
        r.setMA = kCoilCheckMA;
        r.senseMA = gCoils.n[k] ? gCoils.sumMA[k] / gCoils.n[k] : 0.0f;
        r.outV = gCoils.n[k] ? gCoils.sumOut[k] / gCoils.n[k] : 0.0f;
        r.xV = r.senseMA / 1000.0f * pcb::kRsOhm;
        gCoils.verdict[k] = pcb::judgeCoil(r);
      }
    }
  }
  // The tES check's impedances, from the readings the sequencer kept when it ended.
  if (gTesCheck.running && st.state == seq::State::Idle && !seq::busy()) {
    gTesCheck.running = false;
    gTesCheck.done = true;
    for (int k = 0; k < tes::kChannels; ++k)
      if (gTesCheck.used[k]) gTesCheck.z[k] = tes::judgeImpedance(st.tesCheckV[k], st.tesCheckMA[k], gTesCheck.plannedMA);
  }
  if (gTesLogPending && st.state == seq::State::Idle && !st.tes && !seq::busy()) {
    gTesLogPending = false;
    tesLogSession(st);
  }
  if (gTesBlind && !gTesRevealable && !gTesLogPending && st.state == seq::State::Idle && !st.tes && !seq::busy()) gTesRevealable = true;
}

void writeHello(mj::Writer& w) {
  w.key("pcb").beginObject();
  w.key("ceilingMA").number(pcbboard::ceilingMA(), 1);
  w.key("fullScaleMA").number(2.5 / 124.0 * 1000.0, 2);
  w.key("tes").beginObject();
  w.key("channels").integer(tes::kChannels);
  const tes::Limits lim;
  w.key("maxMA").number(lim.maxChannelMA, 1);
  w.key("maxTotalMA").number(lim.maxTotalMA, 1);
  w.key("maxMinutes").integer(lim.maxSessionS / 60);
  w.key("maxChargeC").number(lim.maxChargeC, 1);
  w.key("safety").string(kTesSafety);
  w.endObject();
  w.endObject();
}

void writeStatus(mj::Writer& w, bool blind) {
  const pcbboard::Snapshot s = pcbboard::snapshot();
  const seq::Status st = seq::status();
  w.key("pcb").beginObject();
  w.key("ceilingMA").number(pcb::ceilingMA(s.ceiling), 1);
  w.key("rails").beginArray().number(s.p15, 2).number(s.n15, 2).endArray();
  w.key("usbMA").number(s.usbMA, 0);
  w.key("usbHost").boolean(s.usbHost);
  w.key("trip").boolean(pcbboard::tripLatched());
  w.key("stop").boolean(pcbboard::stopLatched());
  w.key("tesFault").boolean(pcbboard::tesFaultLatched());
  w.key("monitor").boolean(s.valid);
  // Measured coil currents would reveal a sham session, so they are withheld when blind.
  if (!blind) {
    w.key("coilMA").beginArray();
    for (float v : s.coilMA) w.number(v, 3);
    w.endArray();
    w.key("coilRmsMA").beginArray();
    for (float v : s.coilRmsMA) w.number(v, 3);
    w.endArray();
  }
  if (gCoils.done || gCoils.running) {
    w.key("coilsCheck").beginObject();
    w.key("running").boolean(gCoils.running);
    if (gCoils.done) {
      w.key("stopped").string(gCoils.stopped);
      w.key("coils").beginArray();
      for (int k = 0; k < 8; ++k) {
        w.beginObject();
        w.key("mA").number(gCoils.reading[k].senseMA, 3);
        w.key("outV").number(gCoils.reading[k].outV, 2);
        w.key("ohm").number(gCoils.verdict[k].ohms, 1);
        w.key("ok").boolean(gCoils.verdict[k].ok);
        w.key("open").boolean(gCoils.verdict[k].open);
        w.endObject();
      }
      w.endArray();
    }
    w.endObject();
  }
  w.key("tes").beginObject();
  w.key("running").boolean(st.tes);
  w.key("check").boolean(st.tesCheck);
  w.key("elapsedS").number(st.tesElapsedS, 1);
  w.key("totalS").number(st.tesTotalS, 1);
  w.key("chargeC").number(st.tesChargeC, 4);
  w.key("stopReason").string(st.tesStopReason);
  if (!st.blind) {
    w.key("setMA").beginArray().number(st.tesSetMA[0], 3).number(st.tesSetMA[1], 3).endArray();
    w.key("mA").beginArray().number(s.tesMA[0], 3).number(s.tesMA[1], 3).endArray();
    w.key("pairV").beginArray().number(s.tesPairV[0], 2).number(s.tesPairV[1], 2).endArray();
  }
  if (gTesCheck.done || gTesCheck.running) {
    w.key("impedance").beginObject();
    w.key("running").boolean(gTesCheck.running);
    if (gTesCheck.done) {
      w.key("channels").beginArray();
      for (int k = 0; k < tes::kChannels; ++k) {
        if (!gTesCheck.used[k]) {
          w.null();
          continue;
        }
        const tes::Impedance& z = gTesCheck.z[k];
        w.beginObject().key("kOhm").number(z.kOhm, 2).key("ok").boolean(z.ok).key("short").boolean(z.short_).key("high").boolean(z.high).endObject();
      }
      w.endArray();
    }
    w.endObject();
  }
  w.endObject();
  w.endObject();
}

}  // namespace pcbops

#endif  // HAS_PCB_DRIVER
