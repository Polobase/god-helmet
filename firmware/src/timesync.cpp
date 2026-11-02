#include "timesync.h"

#include <sys/time.h>
#include <time.h>

#include "config.h"
#include "envdata.h"
#include "sdcard.h"
#include "settings.h"

#ifdef HAS_SD_CARD
#include <WiFi.h>
#endif

namespace timesync {

void applyTimezone() {
  setenv("TZ", gSettings.tz.c_str(), 1);
  tzset();
}

bool setLocal(int year, int month, int day, int hour, int minute) {
  if (year < 2024 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 ||
      minute < 0 || minute > 59)
    return false;
  tm t{};
  t.tm_year = year - 1900;
  t.tm_mon = month - 1;
  t.tm_mday = day;
  t.tm_hour = hour;
  t.tm_min = minute;
  t.tm_isdst = -1;  // let the timezone rules decide
  const time_t epoch = mktime(&t);
  if (epoch <= 0) return false;
  envdata::setTimeFromClient(static_cast<double>(epoch) * 1000.0);
  return envdata::timeValid();
}

String localString(uint32_t epoch) {
  if (!epoch) return "time not set";
  const time_t t = epoch;
  tm local{};
  localtime_r(&t, &local);
  char buf[24];
  strftime(buf, sizeof buf, "%Y-%m-%d %H:%M", &local);
  return buf;
}

#ifdef HAS_SD_CARD
bool syncFromWifiFile(String& status) {
  String ssid, password, tz;
  String error;
  const bool found = sdcard::forEachLine(String(sdcard::kRoot) + "/wifi.txt", [&](const String& raw) {
    String line = raw;
    line.trim();
    if (line.startsWith("#")) return true;
    const int eq = line.indexOf('=');
    if (eq < 0) return true;
    String key = line.substring(0, eq), value = line.substring(eq + 1);
    key.trim();
    value.trim();
    if (key == "ssid") ssid = value;
    else if (key == "password") password = value;
    else if (key == "tz") tz = value;
    return true;
  }, error);
  if (!found || ssid.isEmpty()) {
    status = "no wifi.txt on the card";
    return false;
  }
  if (tz.length() && tz != gSettings.tz) {
    gSettings.tz = tz;
    gSettings.save();
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  const uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 12000) delay(100);
  bool ok = false;
  if (WiFi.status() == WL_CONNECTED) {
    configTzTime(gSettings.tz.c_str(), "pool.ntp.org", "time.google.com");
    const uint32_t t1 = millis();
    while (!envdata::timeValid() && millis() - t1 < 10000) delay(100);
    ok = envdata::timeValid();
    status = ok ? "time from the internet" : "WiFi ok, no time server";
  } else {
    status = "WiFi \"" + ssid + "\" not reachable";
  }
  // Radio off again: sessions run without WiFi, and the blind draw needs it off.
  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_OFF);
  applyTimezone();
  return ok;
}
#else
bool syncFromWifiFile(String& status) {
  status = "no SD card";
  return false;
}
#endif

}  // namespace timesync
