#include "experiment.h"

#include <LittleFS.h>
#include <Preferences.h>
#include <esp_random.h>
#include <mbedtls/sha256.h>

#include <algorithm>
#include <functional>

#include "envdata.h"
#include "logbook.h"
#include "sequencer.h"

namespace experiment {
namespace {

constexpr int kMaxSetSize = 8;
constexpr size_t kMaxSets = 64;

struct Trial {
  uint32_t id = 0;
  String mode = "rv";
  String state = "open";  // open, locked, judging, revealed, aborted
  uint32_t created = 0;
  String presetId;
  String presetName;
  bool blind = false;
  String condition = "none";  // active, sham, none
  String manifestHash;
  int setCount = 0;
  String set;
  int setSize = 0;
  int target = 0;
  String nonce;
  String commitment;
  String responseHash;
  uint32_t lockedAt = 0;
  bool kpValid = false;
  float kp = 0;
  float ap = -1;
  double lst = -1;
  int order[kMaxSetSize] = {0};
  int ranks[kMaxSetSize] = {0};
  bool ranked = false;
  int targetRank = 0;
  uint32_t revealedAt = 0;
  uint32_t logId = 0;

  String preimage() const {
    return "godhelmet-trial|id=" + String(id) + "|manifest=" + manifestHash + "|set=" + set +
           "|target=" + String(target) + "|condition=" + condition + "|nonce=" + nonce;
  }

  // full = file contents; otherwise the public view for the current state.
  void write(mj::Writer& w, bool full) const {
    const bool revealed = state == "revealed";
    const bool show = full || revealed;
    const bool showSet = show || state == "judging";
    w.beginObject();
    w.key("id").integer(id);
    w.key("mode").string(mode.c_str());
    w.key("state").string(state.c_str());
    w.key("created").integer(created);
    w.key("presetId").string(presetId.c_str());
    w.key("presetName").string(presetName.c_str());
    w.key("blind").boolean(blind);
    w.key("manifestHash").string(manifestHash.c_str());
    w.key("setCount").integer(setCount);
    w.key("commitment").string(commitment.c_str());
    w.key("responseHash").string(responseHash.c_str());
    w.key("lockedAt").integer(lockedAt);
    w.key("kpValid").boolean(kpValid);
    w.key("kp").number(kp, 2);
    w.key("ap").number(ap, 1);
    w.key("lst").number(lst, 3);
    w.key("logId").integer(logId);
    w.key("ranked").boolean(ranked);
    if (showSet) {
      w.key("set").string(set.c_str());
      w.key("setSize").integer(setSize);
      w.key("order").beginArray();
      for (int i = 0; i < setSize; ++i) w.integer(order[i]);
      w.endArray();
    }
    if (ranked) {
      w.key("ranks").beginArray();
      for (int i = 0; i < setSize; ++i) w.integer(ranks[i]);
      w.endArray();
    }
    if (show) {
      w.key("condition").string(condition.c_str());
      w.key("target").integer(target);
      w.key("nonce").string(nonce.c_str());
      w.key("preimage").string(preimage().c_str());
      w.key("targetRank").integer(targetRank);
      w.key("revealedAt").integer(revealedAt);
    } else {
      w.key("condition").string(blind ? "hidden" : condition.c_str());
    }
    w.endObject();
  }

  void read(const mj::Value& v) {
    id = static_cast<uint32_t>(v["id"].num(0));
    mode = v["mode"].str("rv");
    state = v["state"].str("open");
    created = static_cast<uint32_t>(v["created"].num(0));
    presetId = v["presetId"].str("");
    presetName = v["presetName"].str("");
    blind = v["blind"].boolean(false);
    condition = v["condition"].str("none");
    manifestHash = v["manifestHash"].str("");
    setCount = static_cast<int>(v["setCount"].num(0));
    set = v["set"].str("");
    setSize = static_cast<int>(v["setSize"].num(0));
    target = static_cast<int>(v["target"].num(0));
    nonce = v["nonce"].str("");
    commitment = v["commitment"].str("");
    responseHash = v["responseHash"].str("");
    lockedAt = static_cast<uint32_t>(v["lockedAt"].num(0));
    kpValid = v["kpValid"].boolean(false);
    kp = static_cast<float>(v["kp"].num(0));
    ap = static_cast<float>(v["ap"].num(-1));
    lst = v["lst"].num(-1);
    logId = static_cast<uint32_t>(v["logId"].num(0));
    ranked = v["ranked"].boolean(false);
    for (int i = 0; i < kMaxSetSize; ++i) {
      order[i] = static_cast<int>(v["order"][i].num(i));
      ranks[i] = static_cast<int>(v["ranks"][i].num(0));
    }
    targetRank = static_cast<int>(v["targetRank"].num(0));
    revealedAt = static_cast<uint32_t>(v["revealedAt"].num(0));
  }
};

String trialPath(uint32_t id) { return "/trials/" + String(id) + ".json"; }

bool store(const Trial& t, String& error) {
  mj::Writer w;
  t.write(w, true);
  File f = LittleFS.open(trialPath(t.id), "w");
  if (!f) {
    error = "cannot write trial";
    return false;
  }
  f.print(w.str().c_str());
  f.close();
  return true;
}

bool fetch(uint32_t id, Trial& t, String& error) {
  File f = LittleFS.open(trialPath(id), "r");
  if (!f) {
    error = "trial not found";
    return false;
  }
  const String text = f.readString();
  f.close();
  mj::Value v;
  if (!mj::parse(text.c_str(), text.length(), v)) {
    error = "trial file corrupt";
    return false;
  }
  t.read(v);
  return true;
}

String publicJson(const Trial& t) {
  mj::Writer w;
  t.write(w, false);
  return String(w.str().c_str());
}

// Uniform integer in [0, n) from the hardware RNG (rejection sampling, no modulo bias).
uint32_t randomBelow(uint32_t n) {
  if (n <= 1) return 0;
  const uint32_t limit = UINT32_MAX - (UINT32_MAX % n);
  uint32_t r;
  do {
    r = esp_random();
  } while (r >= limit);
  return r % n;
}

String toHex(const uint8_t* data, size_t n) {
  static const char* kHex = "0123456789abcdef";
  String s;
  s.reserve(n * 2);
  for (size_t i = 0; i < n; ++i) {
    s += kHex[data[i] >> 4];
    s += kHex[data[i] & 15];
  }
  return s;
}

String randomHex(size_t bytes) {
  uint8_t buf[32];
  esp_fill_random(buf, bytes);
  return toHex(buf, bytes);
}

String sha256Hex(const String& text) {
  uint8_t digest[32];
  mbedtls_sha256(reinterpret_cast<const uint8_t*>(text.c_str()), text.length(), digest, 0);
  return toHex(digest, 32);
}

bool isHex64(const String& s) {
  if (s.length() != 64) return false;
  for (size_t i = 0; i < s.length(); ++i)
    if (!isxdigit(static_cast<unsigned char>(s[i]))) return false;
  return true;
}

uint32_t nextId() {
  Preferences p;
  p.begin("trials", false);
  const uint32_t id = p.getUInt("next", 1);
  p.putUInt("next", id + 1);
  p.end();
  return id;
}

}  // namespace

bool validSetId(const String& id) {
  if (id.length() == 0 || id.length() > 38) return false;
  for (size_t i = 0; i < id.length(); ++i) {
    const char c = id[i];
    if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_')) return false;
  }
  return true;
}

bool create(CreateRequest& req, String& json, String& error) {
  if (req.mode != "rv" && req.mode != "telepathy") {
    error = "mode must be rv or telepathy";
    return false;
  }
  if (!envdata::timeValid()) {
    error = "clock not set (reconnect the app)";
    return false;
  }
  if (!isHex64(req.manifestHash)) {
    error = "manifestHash must be 64 hex characters";
    return false;
  }
  if (req.sets.empty() || req.sets.size() > kMaxSets) {
    error = "the target pool needs 1-64 sets";
    return false;
  }
  for (const SetRef& s : req.sets) {
    if (!validSetId(s.id) || s.size < 2 || s.size > kMaxSetSize) {
      error = "every set needs an id (a-z, 0-9, -, _) and 2-8 pictures";
      return false;
    }
  }
  if (req.session != nullptr && seq::busy()) {
    error = "a session is already running";
    return false;
  }

  Trial t;
  t.id = nextId();
  t.mode = req.mode;
  t.created = envdata::now();
  t.manifestHash = req.manifestHash;
  t.manifestHash.toLowerCase();
  t.setCount = static_cast<int>(req.sets.size());
  const SetRef& chosen = req.sets[randomBelow(req.sets.size())];
  t.set = chosen.id;
  t.setSize = chosen.size;
  t.target = static_cast<int>(randomBelow(chosen.size));
  t.nonce = randomHex(16);
  for (int i = 0; i < kMaxSetSize; ++i) t.order[i] = i;

  if (req.session != nullptr) {
    t.presetId = req.presetId;
    t.presetName = req.session->name;
    t.blind = req.blind;
    t.condition = req.blind ? (randomBelow(2) == 0 ? "sham" : "active") : "active";
  }
  t.commitment = sha256Hex(t.preimage());

  if (req.session != nullptr) {
    logbook::Entry e;
    e.presetId = t.presetId;
    e.presetName = t.presetName;
    e.blind = t.blind;
    e.sham = t.condition == "sham";
    e.fieldUT = req.fieldUT;
    e.plannedMs = req.session->totalMs();
    e.trialId = t.id;
    t.logId = logbook::open(e);
    seq::StartRequest sr;
    sr.session = req.session;
    sr.fieldUT = req.fieldUT;
    sr.sham = e.sham;
    sr.blind = t.blind;
    sr.logId = t.logId;
    if (!seq::start(sr)) {
      error = "sequencer busy";
      return false;  // caller still owns the session
    }
    req.session = nullptr;  // owned by the sequencer now
  }
  if (!store(t, error)) return false;
  json = publicJson(t);
  return true;
}

bool lock(uint32_t id, const String& responseHash, String& json, String& error) {
  Trial t;
  if (!fetch(id, t, error)) return false;
  if (t.state != "open") {
    error = "trial already locked";
    return false;
  }
  if (!isHex64(responseHash)) {
    error = "responseHash must be 64 hex characters";
    return false;
  }
  t.state = "locked";
  t.responseHash = responseHash;
  t.responseHash.toLowerCase();
  t.lockedAt = envdata::now();
  const envdata::SpaceWeather sw = envdata::spaceWeather();
  t.kpValid = sw.valid;
  t.kp = sw.kp;
  t.ap = sw.ap;
  t.lst = envdata::lstHours();
  if (!store(t, error)) return false;
  json = publicJson(t);
  return true;
}

bool startJudging(uint32_t id, String& json, String& error) {
  Trial t;
  if (!fetch(id, t, error)) return false;
  if (t.state == "judging") {
    json = publicJson(t);
    return true;
  }
  if (t.state != "locked") {
    error = "lock the response first";
    return false;
  }
  for (int i = 0; i < t.setSize; ++i) t.order[i] = i;
  for (int i = t.setSize - 1; i > 0; --i) std::swap(t.order[i], t.order[randomBelow(i + 1)]);
  t.state = "judging";
  if (!store(t, error)) return false;
  json = publicJson(t);
  return true;
}

bool submitRanks(uint32_t id, const std::vector<int>& ranks, String& json, String& error) {
  Trial t;
  if (!fetch(id, t, error)) return false;
  if (t.state != "judging") {
    error = "trial is not in judging";
    return false;
  }
  if (static_cast<int>(ranks.size()) != t.setSize) {
    error = "one rank per picture required";
    return false;
  }
  bool seen[kMaxSetSize + 1] = {false};
  for (int i = 0; i < t.setSize; ++i) {
    const int r = ranks[i];
    if (r < 1 || r > t.setSize || seen[r]) {
      error = "ranks must be a permutation of 1..N";
      return false;
    }
    seen[r] = true;
    t.ranks[i] = r;
  }
  t.ranked = true;
  if (!store(t, error)) return false;
  json = publicJson(t);
  return true;
}

bool reveal(uint32_t id, String& json, String& error) {
  Trial t;
  if (!fetch(id, t, error)) return false;
  if (t.state != "judging" || !t.ranked) {
    error = "rank all pictures before the reveal";
    return false;
  }
  for (int pos = 0; pos < t.setSize; ++pos)
    if (t.order[pos] == t.target) t.targetRank = t.ranks[pos];
  t.state = "revealed";
  t.revealedAt = envdata::now();
  if (!store(t, error)) return false;
  json = publicJson(t);
  return true;
}

bool abort(uint32_t id, String& error) {
  Trial t;
  if (!fetch(id, t, error)) return false;
  if (t.state == "revealed") {
    error = "trial already revealed";
    return false;
  }
  t.state = "aborted";  // kept on file so nothing disappears silently
  return store(t, error);
}

bool senderTarget(uint32_t id, String& json, String& error) {
  Trial t;
  if (!fetch(id, t, error)) return false;
  if (t.mode != "telepathy" || t.state != "open") {
    error = "sender view is only available while a telepathy trial is open";
    return false;
  }
  mj::Writer w;
  w.beginObject();
  w.key("id").integer(t.id);
  w.key("manifestHash").string(t.manifestHash.c_str());
  w.key("set").string(t.set.c_str());
  w.key("target").integer(t.target);
  w.endObject();
  json = w.str().c_str();
  return true;
}

String get(uint32_t id) {
  Trial t;
  String error;
  return fetch(id, t, error) ? publicJson(t) : String();
}

String stateOf(uint32_t id) {
  Trial t;
  String error;
  return fetch(id, t, error) ? t.state : String();
}

void writeList(mj::Writer& w, size_t offset, size_t limit) {
  std::vector<uint32_t> ids;
  File dir = LittleFS.open("/trials");
  if (dir && dir.isDirectory()) {
    for (File f = dir.openNextFile(); f; f = dir.openNextFile()) {
      const String name = f.name();
      if (name.endsWith(".json")) ids.push_back(static_cast<uint32_t>(name.toInt()));
    }
  }
  std::sort(ids.begin(), ids.end(), std::greater<uint32_t>());
  w.key("total").integer(ids.size());
  w.key("items").beginArray();
  String error;
  for (size_t i = offset; i < ids.size() && i < offset + limit; ++i) {
    Trial t;
    if (fetch(ids[i], t, error)) t.write(w, false);
  }
  w.endArray();
}

}  // namespace experiment
