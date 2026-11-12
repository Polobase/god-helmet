#include "rpc.h"

#include <Arduino.h>
#include <esp_task_wdt.h>
#ifdef GH_TEST_OPS
#include <LittleFS.h>
#include <Preferences.h>
#endif

#include <cmath>
#include <cstdio>
#include <memory>
#include <new>
#include <vector>

#include "ble.h"
#include "config.h"
#include "control.h"
#include "envdata.h"
#include "experiment.h"
#include "journal.h"
#include "logbook.h"
#include "minijson.h"
#include "preset_json.h"
#include "sequencer.h"
#include "settings.h"
#include "storage.h"
#include "usblink.h"
#include "wire.h"

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
using control::startAllowed;

Reply toReply(const control::Result& r) {
  if (!r.ok) return Reply::fail(r.error);
  mj::Writer w;
  w.beginObject().key("logId").integer(r.logId);
  if (r.already) w.key("already").boolean(true);  // a repeated start: this is the session it made the first time
  w.endObject();
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
  // Which helmet, and which start of it: an app that reconnects compares
  // these to see whether the helmet restarted in between.
  w.key("helmetId").string(journal::helmetId());
  w.key("bootId").integer(journal::bootId());
  w.key("uptimeS").integer(journal::uptimeS());
  w.key("resetReason").string(journal::resetReason());
  w.key("recoveredLogId").integer(journal::recoveredLogId());
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
  w.key("maxAlloc").integer(ESP.getMaxAllocHeap());  // the largest piece: what a large program needs
  // Measured while idle (storage.h): asking the filesystem here would hold up a running session.
  w.key("fsUsed").integer(storage::usedBytes());
  w.key("fsTotal").integer(storage::totalBytes());
  w.key("links").beginObject();
  w.key("ble").integer(ble::connections());
  w.key("bleStatus").integer(ble::statusSubscribers());
  w.key("usb").integer(usblink::connections());
  w.endObject();
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
  return toReply(control::startFromDoc(v["session"], v["presetId"].str(""), field, v["blind"].boolean(false),
                                       v["token"].str("")));
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
  t.token = v["token"].str("");
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
  // A repeated request (its first reply got lost) gets the trial it made the first time.
  const String token = v["token"].str("");
  control::Result prior;
  switch (control::checkToken(token, prior)) {
    case control::TokenCheck::Invalid: return Reply::fail(prior.error);
    case control::TokenCheck::Already: {
      String json = prior.trialId ? experiment::get(prior.trialId) : String();
      if (json.length() < 2) return Reply::fail("this token was used for another start");
      json.remove(json.length() - 1);
      json += ",\"already\":true}";
      return Reply::json(json);
    }
    case control::TokenCheck::Fresh: break;
  }
  experiment::CreateRequest req;
  req.mode = v["mode"].str("rv");
  req.manifestHash = v["manifestHash"].str("");
  req.token = token;
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
  if (hadSession && req.session == nullptr) session.release();  // ownership passed to the sequencer
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

// Hardware random bytes for micro-PK tasks: a true RNG with the radio running
// and, through control::fillRandom, also with Bluetooth switched off.
Reply rngBytes(const mj::Value& v) {
  const int n = static_cast<int>(v["n"].num(32));
  if (n < 1 || n > 256) return Reply::fail("n must be 1..256");
  uint8_t buf[256];
  control::fillRandom(buf, n);
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

#ifdef GH_TEST_OPS
// Test builds only (-DGH_TEST_OPS): takes the helmet down on purpose, to
// check what the next start makes of a session that was running.
Reply debugCrash(const mj::Value& v) {
  const std::string how = v["how"].str("panic");
  if (how == "restart") ESP.restart();
  if (how == "panic") abort();
  if (how == "hang") {  // this task stops answering: the task watchdog restarts the board after 5 s
    esp_task_wdt_add(nullptr);
    for (;;) {
    }
  }
  return Reply::fail("how must be restart, panic or hang");
}

// Test builds only: removes the log entries and trials a test run added
// (ids from logFrom / trialFrom on), so the helmet is left as it was found.
Reply debugCleanup(const mj::Value& v) {
  if (seq::busy()) return Reply::fail("stop the session first");
  struct Kind {
    const char* dir;
    const char* ns;
    uint32_t from;
  };
  const Kind kinds[] = {{"/log/", "logbook", static_cast<uint32_t>(v["logFrom"].num(0))},
                        {"/trials/", "trials", static_cast<uint32_t>(v["trialFrom"].num(0))}};
  mj::Writer w;
  w.beginObject();
  for (const Kind& k : kinds) {
    if (k.from == 0) continue;
    Preferences p;
    p.begin(k.ns, false);
    const uint32_t next = p.getUInt("next", 1);
    uint32_t removed = 0;
    for (uint32_t id = k.from; id < next; ++id) removed += LittleFS.remove(String(k.dir) + String(id) + ".json") ? 1 : 0;
    if (next > k.from) p.putUInt("next", k.from);
    p.end();
    w.key(k.ns).integer(removed);
  }
  if (v.has("lastSessionEpoch")) {
    gSettings.lastSessionEpoch = static_cast<uint32_t>(v["lastSessionEpoch"].num(0));
    gSettings.saveLastSession();
  }
  storage::changed();
  w.endObject();
  return Reply::json(w.str());
}
#endif

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
#ifdef GH_TEST_OPS
  if (op == "debug.crash") return debugCrash(v);
  if (op == "debug.cleanup") return debugCleanup(v);
#endif
  return Reply::fail(String("unknown op: ") + op.c_str());
}

}  // namespace

std::string handle(std::string request, bool* valid) {
  if (valid != nullptr) *valid = false;
  // Read from the text itself, so that even a request that cannot be parsed
  // (or that runs the board out of memory) is answered to the right caller.
  long long clientTag = 0, id = 0;
  hlink::peekTag(request.data(), request.size(), clientTag, id);
  try {
    mj::Value v;
    std::string err;
    Reply reply;
    if (!mj::parse(request, v, &err) || !v.isObject()) {
      reply = Reply::fail(String("invalid JSON: ") + err.c_str());
    } else {
      clientTag = static_cast<long long>(v["c"].num(0));
      id = static_cast<long long>(v["id"].num(0));
      const std::string op = v["op"].str("");
      if (valid != nullptr) *valid = !op.empty();
      // Everything is in `v` now; only settings.set reads the text again.
      if (op != "settings.set") std::string().swap(request);
      reply = dispatch(op, v, request);
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
  } catch (const std::bad_alloc&) {
  }
  // Everything the request had allocated is released by now.
  try {
    return hlink::errorReply(clientTag, id, "out of memory (program too large for this board)");
  } catch (const std::bad_alloc&) {
    return std::string();  // not even that: the app runs into its own timeout
  }
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
  // Which session this is (kept after it ends, until the next start) and
  // which start of the helmet: what a reconnecting app needs to pick it up.
  w.key("bootId").integer(journal::bootId());
  w.key("token").string(st.token);
  w.key("presetId").string(st.presetId);
  w.key("startEpoch").integer(st.startEpoch);
  w.key("trialId").integer(st.trialId);
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
