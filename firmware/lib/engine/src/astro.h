// Local sidereal time, logged with every trial (Spottiswoode 1997 reported
// larger free-response effect sizes near 13.5 h LST; a larger follow-up set did
// not replicate it, so it is recorded, never used to gate sessions).
#pragma once

namespace engine {

double julianDate(double unixSeconds);
// Greenwich mean sidereal time in hours [0, 24).
double gmstHours(double unixSeconds);
// Local sidereal time in hours [0, 24); longitude east positive.
double lstHours(double unixSeconds, double longitudeEastDeg);

}  // namespace engine
