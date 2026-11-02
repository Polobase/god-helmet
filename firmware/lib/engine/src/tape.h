// Tape-measure directions for 10-5 sites, for one head (C++ port of
// webapp/src/lib/tape.js; keep in sync, test/host checks every site against
// the JS output in test/tape/tape-reference.json).
//
// Grid rules: UI 10/10 (Jurcak, Tsuzuki & Dan 2007); 10-5 names (Oostenveld &
// Praamstra 2001). Texts are UTF-8 like the web app's; the device UI folds
// them to ASCII when it draws.
#pragma once
#include <map>
#include <string>

#include "minijson.h"

namespace engine {
namespace tape {

enum class Kind { Ring, Mid, Row, Low, Back };
enum class Side { Mid, Left, Right };

struct Site {
  std::string name, row;
  int pct = 0;       // row position, percent of nasion-inion from the nasion
  Side side = Side::Mid;
  Kind kind = Kind::Mid;
  double k = 0;      // ring/low: steps of 5 % of the band from Fpz (0..10)
  double f = 0;      // row: 0 = midline, 1 = band
  double drop = 0;   // low: 1 = on the 0 % line, 0.5 = halfway to it
  double steps = 0;  // back (OI, I rows): 0 midline, 0.5 or 1 step sideways
  std::string ring, mid;  // row: the band site and the midline site of that row
};
bool parseSite(const std::string& name, Site& out);

// Arc lengths of the template head in cm (tape.json of the SD pack, `npm run sd-pack`).
struct Template {
  double circumference = 0, nasionInion = 0, earEar = 0;
  std::map<std::string, double> rows;  // half-row arc, midline to band
};
bool templateFromJson(const mj::Value& v, Template& out);

struct Head {
  double circumference = 56, nasionInion = 36, earEar = 35;  // typical adult head
  bool typical = true;  // at least one value fell back to the default
};
// Values in cm; 0 or out of range -> the typical value for that measurement.
Head cleanHead(double nasionInion, double earEar, double circumference);

struct Recipe {
  Kind kind = Kind::Ring;
  std::string band;   // "on", "above" or "below"
  double bandCm = 0;  // distance from the band along the head
  std::string text, detail;
  bool estimate = false;  // scaled from the template head
};
bool recipe(const Template& t, const std::string& site, const Head& head, Recipe& out);

// "Left · temple, in front of the ear top"
std::string describeSite(const std::string& name);

// JavaScript Number.prototype.toFixed(1) for positive numbers (ties round up).
std::string toFixed1(double x);

}  // namespace tape
}  // namespace engine
