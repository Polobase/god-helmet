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

bool parsePattern(const mj::Value& v, PatternParams& p, std::string* error) {
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
  if (p.f0 < 0 || p.f1 < 0 || p.f0 > 500 || p.f1 > 500) return fail(error, "frequency out of range");
  if (p.pointMs < 0 || p.pointMs > 1000) return fail(error, "pointMs out of range");
  return true;
}

bool parseSpatial(const mj::Value& v, SpatialParams& s, std::string* error) {
  s = SpatialParams{};
  if (v.isNull()) return true;
  if (v.has("mode") && !spatialModeFromName(v["mode"].str(), s.mode))
    return fail(error, std::string("unknown spatial mode: ") + v["mode"].str("?"));
  s.ccw = std::strcmp(v["dir"].str("ccw"), "cw") != 0;
  s.side = std::strcmp(v["side"].str("right"), "left") == 0 ? Side::Left : Side::Right;
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
      if (x < 0 || x > 1) return fail(error, "weights must be 0..1");
      s.weights[i] = static_cast<float>(x);
    }
  }
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
  out.fadeInMs = static_cast<uint32_t>(doc["fadeInS"].num(10) * 1000.0);
  out.fadeOutMs = static_cast<uint32_t>(doc["fadeOutS"].num(10) * 1000.0);

  const mj::Value& phases = doc["phases"];
  if (!phases.isArray() || phases.size() == 0) return fail(error, "phases missing");
  if (phases.size() > static_cast<size_t>(kMaxPhases)) return fail(error, "too many phases");

  for (size_t i = 0; i < phases.size(); ++i) {
    const mj::Value& pv = phases[i];
    Phase& ph = out.phases[i];
    copyStr(ph.name, sizeof ph.name, pv["name"].str(""));
    double ms = 0;
    if (pv.has("minutes")) ms = pv["minutes"].num(0) * 60000.0;
    else if (pv.has("seconds")) ms = pv["seconds"].num(0) * 1000.0;
    if (ms <= 0) return fail(error, "phase " + std::to_string(i + 1) + ": duration missing");
    ph.durationMs = static_cast<uint32_t>(ms);
    ph.level = static_cast<float>(pv["level"].num(1));
    if (ph.level < 0 || ph.level > 1) return fail(error, "level must be 0..1");
    ph.crossfade = pv["crossfade"].boolean(false);
    std::string sub;
    if (!parsePattern(pv["pattern"], ph.pattern, &sub))
      return fail(error, "phase " + std::to_string(i + 1) + ": " + sub);
    if (!parseSpatial(pv["spatial"], ph.spatial, &sub))
      return fail(error, "phase " + std::to_string(i + 1) + ": " + sub);
  }
  out.phaseCount = static_cast<uint8_t>(phases.size());
  if (out.totalMs() > kMaxSessionMs) return fail(error, "session longer than 60 min");

  // Point table for "table" patterns, sent inline: values 0..255, 128 = zero field.
  const mj::Value& table = doc["tableData"];
  if (table.isArray()) {
    if (table.size() == 0 || table.size() > kMaxTablePoints) return fail(error, "tableData needs 1..8192 values");
    out.table.reserve(table.size());
    for (size_t i = 0; i < table.size(); ++i) {
      const double v = table[i].num(-1);
      if (v < 0 || v > 255) return fail(error, "tableData values must be 0..255");
      const int s = static_cast<int>(v) - 128;
      out.table.push_back(static_cast<int8_t>(s < -127 ? -127 : s));
    }
  }
  for (int i = 0; i < out.phaseCount; ++i) {
    if (out.phases[i].pattern.type == PatternType::Table && out.table.empty())
      return fail(error, "phase " + std::to_string(i + 1) + ": table pattern needs tableData");
  }
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
