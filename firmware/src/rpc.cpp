#include "rpc.h"

#include <Arduino.h>
#include <LittleFS.h>
#include <esp_random.h>

#include <cmath>
#include <cstdio>
#include <memory>
#include <new>
#include <vector>

#include "config.h"
#include "control.h"
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

using control::clampField;
using control::markSessionTime;
using control::startAllowed;

Reply toReply(const control::Result& r) {
  if (!r.ok) return Reply::fail(r.error);
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
  w.key("chip").string(ESP.getChipModel());
  w.key("transports").beginArray();
  if (gSettings.bleEnabled) w.string("ble");
  w.string("usb");
  w.endArray();
  w.key("calibrated").boolean(gSettings.calibrated);
  w.key("safetyAccepted").boolean(gSettings.safetyAccepted);
  w.key("maxReachableUT").number(control::maxReachableUT(), 3);
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
  const double field = v["fieldUT"].isNumber() ? v["fieldUT"].num(0) : -1;  // -1: the program's own uT
  return toReply(control::startFromDoc(v["session"], v["presetId"].str(""), field, v["blind"].boolean(false)));
}

// Calibration and wiring checks: DC on one coil, or a slow DC rotation.
Reply test(const mj::Value& v) {
  control::TestRequest t;
  t.mode = v["mode"].str("dc");
  t.mA = static_cast<float>(v["mA"].num(1.0));
  t.seconds = static_cast<uint32_t>(v["seconds"].num(30));
  t.channel = static_cast<int>(v["channel"].num(0));
  t.layout = v["layout"].str("temporal");
  t.ccw = std::string(v["dir"].str("ccw")) != "cw";
  t.dwellMs = static_cast<float>(v["dwellMs"].num(1000));
  t.blinkHz = static_cast<float>(v["blinkHz"].num(1.0));
  return toReply(control::startTest(t));
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
  if (!control::rate(static_cast<uint32_t>(v["id"].num(0)), static_cast<int>(v["rating"].num(-1)), v["notes"].str(""),
                     json, error))
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

// Hardware random bytes for micro-PK tasks. esp_fill_random() is a true RNG
// while the radio (BLE) is running.
Reply rngBytes(const mj::Value& v) {
  const int n = static_cast<int>(v["n"].num(32));
  if (n < 1 || n > 256) return Reply::fail("n must be 1..256");
  uint8_t buf[256];
  esp_fill_random(buf, n);
  static const char* kHex = "0123456789abcdef";
  std::string hex;
  hex.reserve(n * 2);
  for (int i = 0; i < n; ++i) {
    hex += kHex[buf[i] >> 4];
    hex += kHex[buf[i] & 15];
  }
  mj::Writer w;
  w.beginObject().key("hex").string(hex).key("source").string("esp_fill_random").endObject();
  return Reply::json(w.str());
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
  if (op == "status") return Reply::json(statusJson());
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
  if (op == "rng.bytes") return rngBytes(v);
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
    try {
      reply = dispatch(v["op"].str(""), v, request);
    } catch (const std::bad_alloc&) {
      reply = Reply::fail("out of memory (program too large for this board)");
    }
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
