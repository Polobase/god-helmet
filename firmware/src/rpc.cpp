#include "rpc.h"

#include <Arduino.h>
#include <LittleFS.h>
#include <esp_random.h>

#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

#include "config.h"
#include "envdata.h"
#include "experiment.h"
#include "logbook.h"
#include "minijson.h"
#include "preset_json.h"
#include "sequencer.h"
#include "settings.h"

namespace rpc {
namespace {

constexpr size_t kMaxPage = 10;

struct Reply {
  bool ok = true;
  String error;
  std::string data = "null";  // serialised JSON value

  static Reply fail(const String& message) {
    Reply r;
    r.ok = false;
    r.error = message;
    return r;
  }
  static Reply json(const String& json) {
    Reply r;
    r.data = json.length() ? json.c_str() : "null";
    return r;
  }
  static Reply json(const std::string& json) {
    Reply r;
    r.data = json;
    return r;
  }
};

const char* stateName(seq::State s) {
  switch (s) {
    case seq::State::Running: return "running";
    case seq::State::Stopping: return "stopping";
    default: return "idle";
  }
}

float minUTperMA() {
  float m = gSettings.uTperMA[0];
  for (float v : gSettings.uTperMA) m = std::fmin(m, v);
  return m;
}

float clampField(double uT) {
  float f = static_cast<float>(uT);
  if (!(f > 0)) f = gSettings.defaultFieldUT;
  return std::fmin(f, gSettings.maxFieldUT);
}

bool startAllowed(String& error) {
  if (!gSettings.safetyAccepted) {
    error = "accept the safety page in the app first";
    return false;
  }
  if (seq::busy()) {
    error = "a session is already running";
    return false;
  }
  return true;
}

void markSessionTime() {
  if (envdata::now()) {
    gSettings.lastSessionEpoch = envdata::now();
    gSettings.save();
  }
}

Reply startSession(engine::Session* session, float fieldUT, bool blind, bool sham, float testMA,
                   const String& presetId) {
  logbook::Entry e;
  e.presetId = presetId;
  e.presetName = session->name;
  e.blind = blind;
  e.sham = sham;
  e.test = testMA != 0.0f;
  e.fieldUT = fieldUT;
  e.plannedMs = session->totalMs();
  seq::StartRequest r;
  r.session = session;
  r.fieldUT = fieldUT;
  r.blind = blind;
  r.sham = sham;
  r.testMA = testMA;
  r.logId = e.test ? 0 : logbook::open(e);
  if (!seq::start(r)) {
    delete session;
    return Reply::fail("sequencer queue full");
  }
  if (!e.test) markSessionTime();
  mj::Writer w;
  w.beginObject().key("logId").integer(r.logId).endObject();
  return Reply::json(w.str());
}

// ---------------------------------------------------------------- operations

Reply hello() {
  mj::Writer w;
  w.beginObject();
  w.key("firmware").string(kFirmwareVersion);
  w.key("protocol").integer(kProtocolVersion);
  w.key("board").string(BOARD_NAME);
  w.key("calibrated").boolean(gSettings.calibrated);
  w.key("safetyAccepted").boolean(gSettings.safetyAccepted);
  w.key("maxReachableUT").number(engine::maxFieldUT(gSettings.drive, minUTperMA()), 3);
  w.key("maxFieldUT").number(gSettings.maxFieldUT, 3);
  w.key("defaultFieldUT").number(gSettings.defaultFieldUT, 3);
  w.key("lastSessionEpoch").integer(gSettings.lastSessionEpoch);
  w.key("minIntervalS").integer(limits::kMinIntervalS);
  w.key("freeHeap").integer(ESP.getFreeHeap());
  w.key("fsUsed").integer(LittleFS.usedBytes());
  w.key("fsTotal").integer(LittleFS.totalBytes());
  w.key("env");
  envdata::writeJson(w);
  w.endObject();
  return Reply::json(w.str());
}

Reply timeSet(const mj::Value& v) {
  envdata::setTimeFromClient(v["epochMs"].num(0));
  mj::Writer w;
  envdata::writeJson(w);
  return Reply::json(w.str());
}

Reply envSet(const mj::Value& v) {
  const double kp = v["kp"].num(-1);
  if (kp < 0 || kp > 9) return Reply::fail("Kp must be 0..9");
  envdata::setSpaceWeather(static_cast<float>(kp), static_cast<float>(v["ap"].num(-1)),
                           v["source"].str("manual"));
  mj::Writer w;
  envdata::writeJson(w);
  return Reply::json(w.str());
}

Reply settingsSet(const std::string& raw) {
  if (seq::busy()) return Reply::fail("stop the session before changing settings");
  const bool gain = gSettings.dacGain2x, buf = gSettings.dacBufferedRef;
  // applyJson ignores unknown keys such as "c", "id" and "op".
  String error;
  if (!gSettings.applyJson(String(raw.c_str()), error)) return Reply::fail(error);
  if (gain != gSettings.dacGain2x || buf != gSettings.dacBufferedRef) seq::reconfigureDac();
  return Reply::json(gSettings.toJson());
}

Reply sessionStart(const mj::Value& v) {
  String error;
  if (!startAllowed(error)) return Reply::fail(error);
  if (!v["session"].isObject()) return Reply::fail("session missing");
  std::unique_ptr<engine::Session> s(new engine::Session());
  engine::PresetInfo info;
  std::string err;
  if (!engine::sessionFromJson(v["session"], *s, &info, &err)) return Reply::fail(err.c_str());
  const bool blind = v["blind"].boolean(false);
  // Blind: the hardware RNG picks real or sham; the log reveals it after rating.
  const bool sham = blind ? (esp_random() & 1) : (std::string(s->id) == "sham");
  const String presetId = v["presetId"].str(s->id);
  const float field = clampField(v["fieldUT"].num(info.uT));
  return startSession(s.release(), field, blind, sham, 0.0f, presetId);
}

// Calibration and wiring checks: DC on one coil, or a slow DC rotation.
Reply test(const mj::Value& v) {
  String error;
  if (!startAllowed(error)) return Reply::fail(error);
  const std::string mode = v["mode"].str("dc");
  const float mA = static_cast<float>(v["mA"].num(1.0));
  if (std::fabs(mA) > limits::kMaxTestMA || mA == 0) return Reply::fail("mA must be non-zero, |mA| <= 4.6");
  const uint32_t seconds = static_cast<uint32_t>(v["seconds"].num(30));
  if (seconds == 0 || seconds > limits::kMaxTestSeconds) return Reply::fail("seconds must be 1..120");

  std::unique_ptr<engine::Session> s(new engine::Session());
  s->fadeInMs = 500;
  s->fadeOutMs = 500;
  s->phaseCount = 1;
  engine::Phase& ph = s->phases[0];
  ph.durationMs = seconds * 1000;
  ph.pattern = engine::patternDefaults(engine::PatternType::DC);
  if (!engine::layoutFromName(v["layout"].str("temporal"), s->layout)) s->layout = engine::Layout::Temporal;
  if (mode == "dc") {
    const int ch = static_cast<int>(v["channel"].num(0));
    if (ch < 0 || ch > 7) return Reply::fail("channel must be 0..7");
    ph.spatial.mode = engine::SpatialMode::Single;
    ph.spatial.channel = static_cast<uint8_t>(ch);
    std::snprintf(s->id, sizeof s->id, "test-dc");
    std::snprintf(s->name, sizeof s->name, "DC test CH%d %.2f mA", ch + 1, mA);
    std::snprintf(ph.name, sizeof ph.name, "DC CH%d", ch + 1);
  } else if (mode == "rotate") {
    ph.spatial.mode = engine::SpatialMode::Rotate;
    ph.spatial.ccw = std::string(v["dir"].str("ccw")) != "cw";
    ph.spatial.dwellStartMs = ph.spatial.dwellEndMs = static_cast<float>(v["dwellMs"].num(1000));
    std::snprintf(s->id, sizeof s->id, "test-rotate");
    std::snprintf(s->name, sizeof s->name, "Slow rotation test %.2f mA", mA);
    std::snprintf(ph.name, sizeof ph.name, "Rotate");
  } else {
    return Reply::fail("mode must be dc or rotate");
  }
  const String id = s->id;
  return startSession(s.release(), 0.0f, false, false, mA, id);
}

Reply logList(const mj::Value& v) {
  mj::Writer w;
  w.beginObject();
  logbook::writeList(w, static_cast<size_t>(v["offset"].num(0)),
                     std::min(kMaxPage, static_cast<size_t>(v["limit"].num(kMaxPage))));
  w.endObject();
  return Reply::json(w.str());
}

Reply logRate(const mj::Value& v) {
  String json, error;
  if (!logbook::rate(static_cast<uint32_t>(v["id"].num(0)), static_cast<int>(v["rating"].num(-1)),
                     v["notes"].str(""), json, error))
    return Reply::fail(error);
  return Reply::json(json);
}

Reply trialNew(const mj::Value& v) {
  experiment::CreateRequest req;
  req.mode = v["mode"].str("rv");
  req.manifestHash = v["manifestHash"].str("");
  const mj::Value& sets = v["sets"];
  for (size_t i = 0; i < sets.size(); ++i) {
    experiment::SetRef ref;
    ref.id = sets[i]["id"].str("");
    ref.size = static_cast<int>(sets[i]["size"].num(0));
    req.sets.push_back(ref);
  }
  req.blind = v["blind"].boolean(true);
  req.fieldUT = clampField(v["fieldUT"].num(gSettings.defaultFieldUT));
  std::unique_ptr<engine::Session> session;
  if (v["session"].isObject()) {
    String error;
    if (!startAllowed(error)) return Reply::fail(error);
    session.reset(new engine::Session());
    std::string err;
    if (!engine::sessionFromJson(v["session"], *session, nullptr, &err)) return Reply::fail(err.c_str());
    req.presetId = v["presetId"].str(session->id);
    req.session = session.get();
  }
  String json, error;
  const bool hadSession = req.session != nullptr;
  const bool ok = experiment::create(req, json, error);
  if (hadSession && req.session == nullptr) {
    session.release();  // ownership passed to the sequencer
    markSessionTime();
  }
  if (!ok) return Reply::fail(error);
  return Reply::json(json);
}

Reply trialRanks(const mj::Value& v) {
  std::vector<int> ranks;
  for (size_t i = 0; i < v["ranks"].size(); ++i) ranks.push_back(static_cast<int>(v["ranks"][i].num(0)));
  String json, error;
  if (!experiment::submitRanks(static_cast<uint32_t>(v["id"].num(0)), ranks, json, error)) return Reply::fail(error);
  return Reply::json(json);
}

Reply trialList(const mj::Value& v) {
  mj::Writer w;
  w.beginObject();
  experiment::writeList(w, static_cast<size_t>(v["offset"].num(0)),
                        std::min(kMaxPage, static_cast<size_t>(v["limit"].num(kMaxPage))));
  w.endObject();
  return Reply::json(w.str());
}

using TrialStep = bool (*)(uint32_t, String&, String&);
Reply trialStep(const mj::Value& v, TrialStep fn) {
  String json, error;
  if (!fn(static_cast<uint32_t>(v["id"].num(0)), json, error)) return Reply::fail(error);
  return Reply::json(json);
}

Reply dispatch(const std::string& op, const mj::Value& v, const std::string& raw) {
  if (op == "hello") return hello();
  if (op == "time.set") return timeSet(v);
  if (op == "env.set") return envSet(v);
  if (op == "settings.get") return Reply::json(gSettings.toJson());
  if (op == "settings.set") return settingsSet(raw);
  if (op == "session.start") return sessionStart(v);
  if (op == "session.stop") {
    seq::stop("stopped from app");
    return Reply();
  }
  if (op == "session.skip") {
    seq::skipPhase();
    return Reply();
  }
  if (op == "session.field") {
    seq::setField(clampField(v["fieldUT"].num(0)));
    return Reply();
  }
  if (op == "test") return test(v);
  if (op == "log.list") return logList(v);
  if (op == "log.rate") return logRate(v);
  if (op == "trial.new") return trialNew(v);
  if (op == "trial.lock") {
    String json, error;
    if (!experiment::lock(static_cast<uint32_t>(v["id"].num(0)), v["responseHash"].str(""), json, error))
      return Reply::fail(error);
    return Reply::json(json);
  }
  if (op == "trial.judge") return trialStep(v, experiment::startJudging);
  if (op == "trial.ranks") return trialRanks(v);
  if (op == "trial.reveal") return trialStep(v, experiment::reveal);
  if (op == "trial.sender") return trialStep(v, experiment::senderTarget);
  if (op == "trial.abort") {
    String error;
    if (!experiment::abort(static_cast<uint32_t>(v["id"].num(0)), error)) return Reply::fail(error);
    return Reply();
  }
  if (op == "trial.get") {
    const String json = experiment::get(static_cast<uint32_t>(v["id"].num(0)));
    if (json.length() == 0) return Reply::fail("trial not found");
    return Reply::json(json);
  }
  if (op == "trial.list") return trialList(v);
  return Reply::fail(String("unknown op: ") + op.c_str());
}

}  // namespace

std::string handle(const std::string& request) {
  mj::Value v;
  std::string err;
  Reply reply;
  long long clientTag = 0, id = 0;
  if (!mj::parse(request, v, &err) || !v.isObject()) {
    reply = Reply::fail(String("invalid JSON: ") + err.c_str());
  } else {
    clientTag = static_cast<long long>(v["c"].num(0));
    id = static_cast<long long>(v["id"].num(0));
    reply = dispatch(v["op"].str(""), v, request);
  }
  mj::Writer w;
  w.beginObject();
  w.key("c").integer(clientTag);
  w.key("id").integer(id);
  w.key("ok").boolean(reply.ok);
  if (reply.ok) w.key("data").raw(reply.data.c_str());
  else w.key("error").string(reply.error.c_str());
  w.endObject();
  return w.take();
}

std::string statusJson() {
  const seq::Status st = seq::status();
  mj::Writer w;
  w.beginObject();
  w.key("state").string(stateName(st.state));
  w.key("armed").boolean(st.armed);
  w.key("blind").boolean(st.blind);
  w.key("test").boolean(st.test);
  w.key("logId").integer(st.logId);
  w.key("sessionId").string(st.sessionId);
  w.key("sessionName").string(st.sessionName);
  w.key("phaseName").string(st.phaseName);
  w.key("phase").integer(st.phase);
  w.key("phaseCount").integer(st.phaseCount);
  w.key("elapsedMs").integer(st.elapsedMs);
  w.key("programMs").integer(st.programMs);
  w.key("totalMs").integer(st.totalMs);
  w.key("phaseMs").integer(st.phaseMs);
  w.key("phaseDurationMs").integer(st.phaseDurationMs);
  w.key("envelope").number(st.envelope, 3);
  w.key("fieldUT").number(st.fieldUT, 3);
  w.key("testMA").number(st.testMA, 3);
  w.key("overruns").integer(st.overruns);
  w.key("lastStopReason").string(st.lastStopReason);
  // Live coil levels would reveal sham sessions, so they are withheld when blind.
  if (!st.blind) {
    w.key("levels").beginArray();
    for (float l : st.levels) w.number(l, 2);
    w.endArray();
  }
  w.endObject();
  return w.take();
}

}  // namespace rpc
