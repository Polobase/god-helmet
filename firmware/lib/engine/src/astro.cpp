#include "astro.h"

#include <cmath>

namespace engine {
namespace {

double wrap24(double h) {
  h = std::fmod(h, 24.0);
  return h < 0 ? h + 24.0 : h;
}

}  // namespace

double julianDate(double unixSeconds) { return unixSeconds / 86400.0 + 2440587.5; }

double gmstHours(double unixSeconds) {
  // USNO approximation, ~0.1 s/century accuracy.
  const double d = julianDate(unixSeconds) - 2451545.0;
  return wrap24(18.697374558 + 24.06570982441908 * d);
}

double lstHours(double unixSeconds, double longitudeEastDeg) {
  return wrap24(gmstHours(unixSeconds) + longitudeEastDeg / 15.0);
}

}  // namespace engine
