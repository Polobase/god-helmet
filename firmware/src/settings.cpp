#include "settings.h"

#include <Preferences.h>

#include "config.h"
#include "minijson.h"

Settings gSettings;

namespace {
constexpr const char* kNamespace = "helmet";
}

void Settings::load() {
  Preferences p;
  if (!p.begin(kNamespace, true)) return;  // first boot: keep defaults
  if (p.getBytesLength("uTperMA") == sizeof(uTperMA)) p.getBytes("uTperMA", uTperMA, sizeof(uTperMA));
  calibrated = p.getBool("calibrated", calibrated);
  drive.seriesOhm = p.getFloat("seriesOhm", drive.seriesOhm);
  drive.coilOhm = p.getFloat("coilOhm", drive.coilOhm);
  drive.vFullScale = p.getFloat("vFull", drive.vFullScale);
  dacGain2x = p.getBool("gain2x", dacGain2x);
  dacBufferedRef = p.getBool("bufRef", dacBufferedRef);
  maxFieldUT = p.getFloat("maxUT", maxFieldUT);
  defaultFieldUT = p.getFloat("defUT", defaultFieldUT);
  longitudeDeg = p.getDouble("lon", longitudeDeg);
  keepaliveS = p.getUInt("keepalive", keepaliveS);
  bleName = p.getString("bleName", bleName);
  lastSessionEpoch = p.getUInt("lastSess", lastSessionEpoch);
  safetyAccepted = p.getBool("safetyOk", safetyAccepted);
  p.end();
}

void Settings::save() const {
  Preferences p;
  if (!p.begin(kNamespace, false)) return;
  p.putBytes("uTperMA", uTperMA, sizeof(uTperMA));
  p.putBool("calibrated", calibrated);
  p.putFloat("seriesOhm", drive.seriesOhm);
  p.putFloat("coilOhm", drive.coilOhm);
  p.putFloat("vFull", drive.vFullScale);
  p.putBool("gain2x", dacGain2x);
  p.putBool("bufRef", dacBufferedRef);
  p.putFloat("maxUT", maxFieldUT);
  p.putFloat("defUT", defaultFieldUT);
  p.putDouble("lon", longitudeDeg);
  p.putUInt("keepalive", keepaliveS);
  p.putString("bleName", bleName);
  p.putUInt("lastSess", lastSessionEpoch);
  p.putBool("safetyOk", safetyAccepted);
  p.end();
}

String Settings::toJson() const {
  mj::Writer w;
  w.beginObject();
  w.key("uTperMA").beginArray();
  for (float v : uTperMA) w.number(v, 4);
  w.endArray();
  w.key("calibrated").boolean(calibrated);
  w.key("seriesOhm").number(drive.seriesOhm, 1);
  w.key("coilOhm").number(drive.coilOhm, 2);
  w.key("vFullScale").number(drive.vFullScale, 3);
  w.key("dacGain2x").boolean(dacGain2x);
  w.key("dacBufferedRef").boolean(dacBufferedRef);
  w.key("maxFieldUT").number(maxFieldUT, 3);
  w.key("defaultFieldUT").number(defaultFieldUT, 3);
  w.key("longitudeDeg").number(longitudeDeg, 4);
  w.key("keepaliveS").integer(keepaliveS);
  w.key("bleName").string(bleName.c_str());
  w.key("lastSessionEpoch").integer(lastSessionEpoch);
  w.key("safetyAccepted").boolean(safetyAccepted);
  w.key("maxCurrentMA").number(engine::maxCurrentMA(drive), 3);
  w.endObject();
  return String(w.str().c_str());
}

bool Settings::applyJson(const String& body, String& error) {
  mj::Value v;
  std::string err;
  if (!mj::parse(body.c_str(), body.length(), v, &err) || !v.isObject()) {
    error = String("invalid JSON: ") + err.c_str();
    return false;
  }
  if (v["uTperMA"].isArray()) {
    if (v["uTperMA"].size() != 8) {
      error = "uTperMA needs 8 values";
      return false;
    }
    for (int i = 0; i < 8; ++i) {
      const double x = v["uTperMA"][i].num(-1);
      if (x <= 0.01 || x > 1000) {
        error = "uTperMA out of range";
        return false;
      }
      uTperMA[i] = static_cast<float>(x);
    }
  }
  if (v.has("calibrated")) calibrated = v["calibrated"].boolean(calibrated);
  if (v.has("seriesOhm")) {
    const double r = v["seriesOhm"].num(0);
    if (r < 470 || r > 100000) {
      error = "seriesOhm must be 470..100000 (never drive coils without a series resistor)";
      return false;
    }
    drive.seriesOhm = static_cast<float>(r);
  }
  if (v.has("coilOhm")) drive.coilOhm = static_cast<float>(v["coilOhm"].num(drive.coilOhm));
  if (v.has("vFullScale")) drive.vFullScale = static_cast<float>(v["vFullScale"].num(drive.vFullScale));
  if (v.has("dacGain2x")) dacGain2x = v["dacGain2x"].boolean(dacGain2x);
  if (v.has("dacBufferedRef")) dacBufferedRef = v["dacBufferedRef"].boolean(dacBufferedRef);
  if (v.has("maxFieldUT")) {
    const double m = v["maxFieldUT"].num(0);
    if (m <= 0 || m > limits::kMaxFieldUT) {
      error = "maxFieldUT must be 0..10";
      return false;
    }
    maxFieldUT = static_cast<float>(m);
  }
  if (v.has("defaultFieldUT"))
    defaultFieldUT = static_cast<float>(v["defaultFieldUT"].num(defaultFieldUT));
  if (v.has("longitudeDeg")) longitudeDeg = v["longitudeDeg"].num(longitudeDeg);
  if (v.has("keepaliveS")) keepaliveS = static_cast<uint32_t>(v["keepaliveS"].num(0));
  if (v.has("bleName")) {
    const String name = v["bleName"].str("");
    if (name.length() > 20) {
      error = "BLE name: at most 20 characters";
      return false;
    }
    bleName = name;
  }
  if (v.has("safetyAccepted")) safetyAccepted = v["safetyAccepted"].boolean(safetyAccepted);
  save();
  return true;
}
