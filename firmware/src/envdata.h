// Clock and space-weather context logged with every session and trial.
//
// The app sets the clock on connect and passes the geomagnetic Kp / ap it
// fetched from NOAA SWPC (or the user typed in). Persinger reported better
// "psi" scores on geomagnetically quiet nights; the claim is weak, so the
// values are only recorded.
#pragma once
#include <Arduino.h>

#include "minijson.h"

namespace envdata {

void begin();

bool timeValid();
uint32_t now();  // unix seconds (0 if unknown)
void setTimeFromClient(double epochMs);
double lstHours();  // local sidereal time for the configured longitude

struct SpaceWeather {
  bool valid = false;
  float kp = 0;
  float ap = -1;       // NOAA "a_running" (3-hourly ap), -1 if unknown
  uint32_t epoch = 0;  // when it was obtained
  String source;       // "noaa" or "manual"
};
SpaceWeather spaceWeather();
void setSpaceWeather(float kp, float ap, const String& source);

void writeJson(mj::Writer& w);

}  // namespace envdata
