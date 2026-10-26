#include "logbook.h"

#include <LittleFS.h>
#include <Preferences.h>

#include <algorithm>
#include <vector>

#include "envdata.h"
#include "minijson.h"

namespace logbook {
namespace {

struct Record {
  uint32_t id = 0;
  uint32_t start = 0;
  String presetId;
  String presetName;
  bool blind = false;
  bool sham = false;
  bool test = false;
  float fieldUT = 0;
  uint32_t plannedMs = 0;
  uint32_t elapsedMs = 0;
  bool finished = false;
  bool completed = false;
  String reason;
  bool kpValid = false;
  float kp = 0;
  float ap = 0;
  String kpSource;
  double lst = -1;
  int rating = -1;
  String notes;
  uint32_t trialId = 0;

  // reveal=false hides the condition of an unrated blind session.
  void write(mj::Writer& w, bool reveal) const {
    w.beginObject();
    w.key("id").integer(id);
    w.key("start").integer(start);
    w.key("presetId").string(presetId.c_str());
    w.key("presetName").string(presetName.c_str());
    w.key("blind").boolean(blind);
    const bool hidden = blind && rating < 0 && !reveal;
    if (hidden) w.key("condition").string("hidden");
    else w.key("condition").string(sham ? "sham" : "active");
    w.key("test").boolean(test);
    w.key("fieldUT").number(fieldUT, 3);
    w.key("plannedMs").integer(plannedMs);
    w.key("elapsedMs").integer(elapsedMs);
    w.key("finished").boolean(finished);
    w.key("completed").boolean(completed);
    w.key("reason").string(reason.c_str());
    w.key("kpValid").boolean(kpValid);
    w.key("kp").number(kp, 2);
    w.key("ap").number(ap, 1);
    w.key("kpSource").string(kpSource.c_str());
    w.key("lst").number(lst, 3);
    w.key("rating").integer(rating);
    w.key("notes").string(notes.c_str());
    w.key("trialId").integer(trialId);
    w.endObject();
  }

  void read(const mj::Value& v) {
    id = static_cast<uint32_t>(v["id"].num(0));
    start = static_cast<uint32_t>(v["start"].num(0));
    presetId = v["presetId"].str("");
    presetName = v["presetName"].str("");
    blind = v["blind"].boolean(false);
    sham = std::string(v["condition"].str("active")) == "sham";
    test = v["test"].boolean(false);
    fieldUT = static_cast<float>(v["fieldUT"].num(0));
    plannedMs = static_cast<uint32_t>(v["plannedMs"].num(0));
    elapsedMs = static_cast<uint32_t>(v["elapsedMs"].num(0));
    finished = v["finished"].boolean(false);
    completed = v["completed"].boolean(false);
    reason = v["reason"].str("");
    kpValid = v["kpValid"].boolean(false);
    kp = static_cast<float>(v["kp"].num(0));
    ap = static_cast<float>(v["ap"].num(0));
    kpSource = v["kpSource"].str("");
    lst = v["lst"].num(-1);
    rating = static_cast<int>(v["rating"].num(-1));
    notes = v["notes"].str("");
    trialId = static_cast<uint32_t>(v["trialId"].num(0));
  }
};

String path(uint32_t id) { return "/log/" + String(id) + ".json"; }

// Files always store the true condition; hiding happens only in responses.
bool store(const Record& r) {
  mj::Writer w;
  r.write(w, true);
  File f = LittleFS.open(path(r.id), "w");
  if (!f) return false;
  f.print(w.str().c_str());
  f.close();
  return true;
}

bool fetch(uint32_t id, Record& r) {
  File f = LittleFS.open(path(id), "r");
  if (!f) return false;
  const String text = f.readString();
  f.close();
  mj::Value v;
  if (!mj::parse(text.c_str(), text.length(), v)) return false;
  r.read(v);
  return true;
}

uint32_t nextId() {
  Preferences p;
  p.begin("logbook", false);
  const uint32_t id = p.getUInt("next", 1);
  p.putUInt("next", id + 1);
  p.end();
  return id;
}

std::vector<uint32_t> allIds() {
  std::vector<uint32_t> ids;
  File dir = LittleFS.open("/log");
  if (!dir || !dir.isDirectory()) return ids;
  for (File f = dir.openNextFile(); f; f = dir.openNextFile()) {
    const String name = f.name();
    if (name.endsWith(".json")) ids.push_back(static_cast<uint32_t>(name.toInt()));
  }
  std::sort(ids.begin(), ids.end(), std::greater<uint32_t>());
  return ids;
}

}  // namespace

uint32_t open(const Entry& e) {
  Record r;
  r.id = nextId();
  r.start = envdata::now();
  r.presetId = e.presetId;
  r.presetName = e.presetName;
  r.blind = e.blind;
  r.sham = e.sham;
  r.test = e.test;
  r.fieldUT = e.fieldUT;
  r.plannedMs = e.plannedMs;
  r.trialId = e.trialId;
  const envdata::SpaceWeather sw = envdata::spaceWeather();
  r.kpValid = sw.valid;
  r.kp = sw.kp;
  r.ap = sw.ap;
  r.kpSource = sw.source;
  r.lst = envdata::lstHours();
  store(r);
  return r.id;
}

void close(const seq::Finished& fin) {
  Record r;
  if (!fetch(fin.logId, r)) return;
  r.finished = true;
  r.completed = fin.completed;
  r.elapsedMs = fin.elapsedMs;
  r.reason = fin.reason;
  store(r);
}

bool rate(uint32_t id, int rating, const String& notes, String& json, String& error) {
  Record r;
  if (!fetch(id, r)) {
    error = "log entry not found";
    return false;
  }
  if (rating < 0 || rating > 10) {
    error = "rating must be 0..10";
    return false;
  }
  r.rating = rating;
  r.notes = notes.substring(0, 2000);
  if (!store(r)) {
    error = "cannot write log";
    return false;
  }
  mj::Writer w;
  r.write(w, true);
  json = w.str().c_str();
  return true;
}

void writeList(mj::Writer& w, size_t offset, size_t limit) {
  const std::vector<uint32_t> ids = allIds();
  w.key("total").integer(ids.size());
  w.key("items").beginArray();
  for (size_t i = offset; i < ids.size() && i < offset + limit; ++i) {
    Record r;
    if (fetch(ids[i], r)) r.write(w, false);  // unrated blind sessions stay hidden
  }
  w.endArray();
}

}  // namespace logbook
