#include "preset_json.h"

#include <cstdio>
#include <cstring>

namespace engine {
namespace {

void copyStr(char* dst, size_t size, const char* src) {
  std::snprintf(dst, size, "%s", src ? src : "");
}

bool fail(std::string* error, const std::string& msg) {
  if (error) *error = msg;
  return false;
}

int b64Value(char c) {
  if (c >= 'A' && c <= 'Z') return c - 'A';
  if (c >= 'a' && c <= 'z') return c - 'a' + 26;
  if (c >= '0' && c <= '9') return c - '0' + 52;
  if (c == '+') return 62;
  if (c == '/') return 63;
  return -1;
}

// Standard base64, with or without padding: the characters, then any '='.
bool validBase64(const char* s) {
  for (; *s && *s != '='; ++s)
    if (b64Value(*s) < 0) return false;
  for (; *s == '='; ++s) {
  }
  return *s == '\0';
}

// Bytes a valid base64 string decodes to.
size_t base64Length(const char* s) {
  size_t chars = 0;
  for (; *s && *s != '='; ++s) ++chars;
  return chars * 6 / 8;
}

bool checkTableSize(size_t n, size_t pool, std::string* error) {
  if (n == 0 || n > kMaxTablePoints) return fail(error, "a table needs 1..8192 values");
  if (pool + n > kMaxTablePool) return fail(error, "tables exceed 16384 points per session");
  return true;
}

inline int8_t toPoint(int v) {
  const int x = v - 128;
  return static_cast<int8_t>(x < -127 ? -127 : x);
}

// Decodes a valid base64 string straight into the pool, without a copy in between.
void appendBase64(const char* s, std::vector<int8_t>& pool) {
  uint32_t acc = 0;
  int bits = 0;
  for (; *s && *s != '='; ++s) {
    acc = (acc << 6) | static_cast<uint32_t>(b64Value(*s));
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      pool.push_back(toPoint(static_cast<int>((acc >> bits) & 0xFF)));
    }
  }
}

// Points a pattern's own table will add to the pool (0 for anything else).
size_t ownTablePoints(const mj::Value& pattern) {
  if (std::strcmp(pattern["type"].str(""), "table") != 0) return 0;
  if (pattern["data"].isArray()) return pattern["data"].size();
  if (pattern["dataB64"].isString()) return base64Length(pattern["dataB64"].str());
  return 0;
}

// Appends point values 0..255 (128 = zero field) to the session's table pool:
// a JSON array of numbers, or (compact, SD-card programs) a base64 string of bytes.
bool appendTable(const mj::Value& v, std::vector<int8_t>& pool, uint32_t& offset, uint32_t& len,
                 std::string* error) {
  if (v.isString()) {
    if (!validBase64(v.str())) return fail(error, "table base64 is invalid");
    const size_t n = base64Length(v.str());
    if (!checkTableSize(n, pool.size(), error)) return false;
    offset = static_cast<uint32_t>(pool.size());
    len = static_cast<uint32_t>(n);
    appendBase64(v.str(), pool);
    return true;
  }
  if (!checkTableSize(v.size(), pool.size(), error)) return false;
  offset = static_cast<uint32_t>(pool.size());
  len = static_cast<uint32_t>(v.size());
  for (size_t i = 0; i < v.size(); ++i) {
    const double x = v[i].num(-1);
    if (x < 0 || x > 255) return fail(error, "table values must be 0..255");
    pool.push_back(toPoint(static_cast<int>(x)));
  }
  return true;
}

bool parsePattern(const mj::Value& v, PatternParams& p, std::vector<int8_t>& pool, uint32_t sharedLen,
                  std::string* error) {
  PatternType type;
  if (!patternFromName(v["type"].str("off"), type))
    return fail(error, std::string("unknown pattern type: ") + v["type"].str("?"));
  p = patternDefaults(type);
  p.f0 = static_cast<float>(v["f0"].num(p.f0));
  p.f1 = static_cast<float>(v["f1"].num(p.f1));
  p.sweepMs = static_cast<float>(v["sweepMs"].num(p.sweepMs));
  p.gapMs = static_cast<float>(v["gapMs"].num(p.gapMs));
  p.pointMs = static_cast<float>(v["pointMs"].num(p.pointMs));
  p.pulseMs = static_cast<float>(v["pulseMs"].num(p.pulseMs));
  p.alternate = v["alternate"].boolean(p.alternate);
  p.seed = static_cast<uint32_t>(v["seed"].num(p.seed));
  p.depth = static_cast<float>(v["depth"].num(p.depth));
  if (p.f0 < 0 || p.f1 < 0 || p.f0 > 500 || p.f1 > 500) return fail(error, "frequency out of range");
  if (p.pointMs < 0 || p.pointMs > 1000) return fail(error, "pointMs out of range");
  if (p.depth < 0 || p.depth > 20) return fail(error, "depth must be 0..20 rad");
  if (type == PatternType::Noise && !(p.f1 > p.f0)) return fail(error, "noise needs f1 > f0");
  if (type == PatternType::Table) {
    if (v["data"].isArray()) return appendTable(v["data"], pool, p.tableOffset, p.tableLen, error);
    if (v["dataB64"].isString()) return appendTable(v["dataB64"], pool, p.tableOffset, p.tableLen, error);
    if (sharedLen == 0) return fail(error, "table pattern needs \"data\" or the session's tableData");
    p.tableOffset = 0;
    p.tableLen = sharedLen;
  }
  return true;
}

bool parseSpatial(const mj::Value& v, SpatialParams& s, std::string* error) {
  s = SpatialParams{};
  if (v.isNull()) return true;
  if (v.has("mode") && !spatialModeFromName(v["mode"].str(), s.mode))
    return fail(error, std::string("unknown spatial mode: ") + v["mode"].str("?"));
  s.ccw = std::strcmp(v["dir"].str("ccw"), "cw") != 0;
  s.ccwLeft = std::strcmp(v["dirLeft"].str(s.ccw ? "ccw" : "cw"), "cw") != 0;
  s.ccwRight = std::strcmp(v["dirRight"].str(s.ccw ? "ccw" : "cw"), "cw") != 0;
  const char* side = v["side"].str("right");
  if (std::strcmp(side, "left") == 0) s.side = Side::Left;
  else if (std::strcmp(side, "both") == 0) s.side = Side::Both;
  else if (std::strcmp(side, "right") == 0) s.side = Side::Right;
  else return fail(error, std::string("unknown side: ") + side);
  s.crossfade = v["crossfade"].boolean(false);
  s.alternateMs = static_cast<float>(v["alternateMs"].num(s.alternateMs));
  s.channel = static_cast<uint8_t>(v["channel"].num(0));
  if (s.channel >= kChannels) return fail(error, "channel out of range");
  if (v.has("dwellMs")) {
    s.dwellStartMs = s.dwellEndMs = static_cast<float>(v["dwellMs"].num(20));
    s.dwellStepMs = 0;
  }
  const mj::Value& dwell = v["dwell"];
  if (dwell.isArray()) {
    if (dwell.size() != 3) return fail(error, "dwell must be [start, step, end]");
    s.dwellStartMs = static_cast<float>(dwell[0].num(20));
    s.dwellStepMs = static_cast<float>(dwell[1].num(0));
    s.dwellEndMs = static_cast<float>(dwell[2].num(20));
  }
  if (s.dwellStartMs < 0.5f || s.dwellEndMs < 0.5f) return fail(error, "dwell must be >= 0.5 ms");
  const mj::Value& w = v["weights"];
  if (w.isArray()) {
    if (w.size() != kChannels) return fail(error, "weights needs 8 values");
    for (int i = 0; i < kChannels; ++i) {
      const double x = w[i].num(1);
      // Negative weights flip a coil's polarity (Shakti wires coil pairs + and -).
      if (x < -1 || x > 1) return fail(error, "weights must be -1..1");
      s.weights[i] = static_cast<float>(x);
    }
  }
  return true;
}

const char* const kRingSites[kChannels] = {"Fpz", "F7", "T7", "P7", "Oz", "P8", "T8", "F8"};
const char* const kTemporalSites[kChannels] = {"FT7", "T7", "CP5", "TP7", "FT8", "T8", "CP6", "TP8"};

// Standard layouts get their fixed sites; "custom" needs placement.sites (8
// names, "" for an unused channel) and may give a rotation order.
bool parsePlacement(const mj::Value& doc, Session& out, std::string* error) {
  const mj::Value& pl = doc["placement"];
  if (out.layout != Layout::Custom) {
    if (!pl.isNull()) return fail(error, "placement needs \"layout\": \"custom\"");
    out.geometry = geometryFor(out.layout);
    const char* const* sites = out.layout == Layout::Ring ? kRingSites : kTemporalSites;
    for (int i = 0; i < kChannels; ++i) copyStr(out.sites[i], sizeof out.sites[i], sites[i]);
    return true;
  }
  const mj::Value& sites = pl["sites"];
  if (!sites.isArray() || sites.size() != kChannels) return fail(error, "custom layout needs placement.sites with 8 names");
  Geometry g;
  g.count = 0;
  for (int i = 0; i < kChannels; ++i) {
    const char* name = sites[i].str("");
    if (std::strlen(name) >= sizeof out.sites[i]) return fail(error, std::string("site name too long: ") + name);
    copyStr(out.sites[i], sizeof out.sites[i], name);
    g.side[i] = 0;
    if (name[0] == '\0') continue;  // channel not used
    if (!sideFromSite(name, g.side[i])) return fail(error, std::string("unknown 10-10 site: ") + name);
    g.order[g.count++] = static_cast<uint8_t>(i);
  }
  if (g.count == 0) return fail(error, "placement uses no channel");
  const mj::Value& order = pl["order"];
  if (order.isArray()) {
    if (order.size() == 0 || order.size() > static_cast<size_t>(kChannels)) return fail(error, "placement.order needs 1-8 channels");
    bool seen[kChannels] = {false};
    for (size_t i = 0; i < order.size(); ++i) {
      const int ch = static_cast<int>(order[i].num(-1));
      if (ch < 0 || ch >= kChannels || seen[ch] || out.sites[ch][0] == '\0')
        return fail(error, "placement.order must list distinct used channels 0-7");
      seen[ch] = true;
      g.order[i] = static_cast<uint8_t>(ch);
    }
    g.count = static_cast<uint8_t>(order.size());
  }
  out.geometry = g;
  return true;
}

}  // namespace

bool sessionFromJson(const mj::Value& doc, Session& out, PresetInfo* info, std::string* error) {
  if (!doc.isObject()) return fail(error, "preset must be an object");
  out = Session{};
  copyStr(out.id, sizeof out.id, doc["id"].str("custom"));
  copyStr(out.name, sizeof out.name, doc["name"].str(out.id));
  if (doc.has("layout") && !layoutFromName(doc["layout"].str(), out.layout))
    return fail(error, std::string("unknown layout: ") + doc["layout"].str("?"));
  if (!parsePlacement(doc, out, error)) return false;
  out.fadeInMs = static_cast<uint32_t>(doc["fadeInS"].num(10) * 1000.0);
  out.fadeOutMs = static_cast<uint32_t>(doc["fadeOutS"].num(10) * 1000.0);

  const mj::Value& phases = doc["phases"];
  if (!phases.isArray() || phases.size() == 0) return fail(error, "phases missing");
  if (phases.size() > static_cast<size_t>(kMaxPhases)) return fail(error, "too many phases");

  // Shared point table ("tableData"), used by table patterns without inline "data".
  const mj::Value& shared = doc["tableData"].isArray() ? doc["tableData"] : doc["tableDataB64"];

  // Room for every table at once, at its exact size: a pool that doubled as
  // it filled would need the old and the new copy at the same moment, more
  // than an ESP32 has in one piece with Bluetooth running.
  size_t points = shared.isArray() ? shared.size() : shared.isString() ? base64Length(shared.str()) : 0;
  for (size_t i = 0; i < phases.size(); ++i) {
    const mj::Value& pv = phases[i];
    const mj::Value& tracks = pv["tracks"];
    if (!tracks.isArray()) points += ownTablePoints(pv["pattern"]);
    else
      for (size_t t = 0; t < tracks.size() && t < 2; ++t) points += ownTablePoints(tracks[t]["pattern"]);
  }
  if (points > 0 && points <= kMaxTablePool) out.table.reserve(points);  // more fails below with its own message
  uint32_t sharedLen = 0;
  if (shared.isArray() || shared.isString()) {
    uint32_t offset = 0;
    std::string sub;
    if (!appendTable(shared, out.table, offset, sharedLen, &sub)) return fail(error, "tableData: " + sub);
  }

  for (size_t i = 0; i < phases.size(); ++i) {
    const mj::Value& pv = phases[i];
    Phase& ph = out.phases[i];
    const std::string where = "phase " + std::to_string(i + 1) + ": ";
    copyStr(ph.name, sizeof ph.name, pv["name"].str(""));
    double ms = 0;
    if (pv.has("minutes")) ms = pv["minutes"].num(0) * 60000.0;
    else if (pv.has("seconds")) ms = pv["seconds"].num(0) * 1000.0;
    if (ms <= 0) return fail(error, where + "duration missing");
    ph.durationMs = static_cast<uint32_t>(ms);
    ph.crossfade = pv["crossfade"].boolean(false);
    std::string sub;
    // Either one track (pattern/spatial/level on the phase) or "tracks": [1-2 tracks].
    const mj::Value& tracks = pv["tracks"];
    const bool multi = tracks.isArray();
    if (multi && (tracks.size() < 1 || tracks.size() > 2)) return fail(error, where + "tracks needs 1 or 2 entries");
    const mj::Value& t1 = multi ? tracks[0] : pv;
    ph.level = static_cast<float>(t1["level"].num(1));
    if (ph.level < 0 || ph.level > 1) return fail(error, where + "level must be 0..1");
    if (!parsePattern(t1["pattern"], ph.pattern, out.table, sharedLen, &sub)) return fail(error, where + sub);
    if (!parseSpatial(t1["spatial"], ph.spatial, &sub)) return fail(error, where + sub);
    ph.hasTrack2 = multi && tracks.size() == 2;
    if (ph.hasTrack2) {
      const mj::Value& t2 = tracks[1];
      ph.level2 = static_cast<float>(t2["level"].num(1));
      if (ph.level2 < 0 || ph.level2 > 1) return fail(error, where + "level must be 0..1");
      if (!parsePattern(t2["pattern"], ph.pattern2, out.table, sharedLen, &sub)) return fail(error, where + "track 2: " + sub);
      if (!parseSpatial(t2["spatial"], ph.spatial2, &sub)) return fail(error, where + "track 2: " + sub);
    }
  }
  out.phaseCount = static_cast<uint8_t>(phases.size());
  if (out.totalMs() > kMaxSessionMs) return fail(error, "session longer than 60 min");
  out.bindTable();

  if (info) {
    info->uT = static_cast<float>(doc["uT"].num(1.0));
    info->category = doc["category"].str("");
    info->summary = doc["summary"].str("");
    info->source = doc["source"].str("");
  }
  return true;
}

}  // namespace engine
