#include "envdata.h"

#include <sys/time.h>

#include <cmath>

#include "astro.h"
#include "settings.h"

namespace envdata {
namespace {

constexpr uint32_t kMinValidEpoch = 1700000000;  // 2023-11
SpaceWeather gWeather;

}  // namespace

void begin() {
  setenv("TZ", "UTC0", 1);
  tzset();
}

bool timeValid() { return time(nullptr) > kMinValidEpoch; }

uint32_t now() {
  const time_t t = time(nullptr);
  return t > kMinValidEpoch ? static_cast<uint32_t>(t) : 0;
}

void setTimeFromClient(double epochMs) {
  if (epochMs / 1000.0 < kMinValidEpoch) return;
  const double diff = epochMs / 1000.0 - static_cast<double>(time(nullptr));
  if (timeValid() && diff > -2 && diff < 2) return;
  timeval tv;
  tv.tv_sec = static_cast<time_t>(epochMs / 1000.0);
  tv.tv_usec = static_cast<suseconds_t>(std::fmod(epochMs, 1000.0) * 1000.0);
  settimeofday(&tv, nullptr);
}

double lstHours() {
  const uint32_t t = now();
  return t ? engine::lstHours(t, gSettings.longitudeDeg) : -1;
}

SpaceWeather spaceWeather() { return gWeather; }

void setSpaceWeather(float kp, float ap, const String& source) {
  gWeather.valid = true;
  gWeather.kp = kp;
  gWeather.ap = ap;
  gWeather.epoch = now();
  gWeather.source = source;
}

void writeJson(mj::Writer& w) {
  w.beginObject();
  w.key("timeValid").boolean(timeValid());
  w.key("epoch").integer(now());
  w.key("lst").number(lstHours(), 3);
  w.key("longitude").number(gSettings.longitudeDeg, 4);
  w.key("kpValid").boolean(gWeather.valid);
  w.key("kp").number(gWeather.kp, 2);
  w.key("ap").number(gWeather.ap, 1);
  w.key("kpEpoch").integer(gWeather.epoch);
  w.key("kpSource").string(gWeather.source.c_str());
  w.endObject();
}

}  // namespace envdata
