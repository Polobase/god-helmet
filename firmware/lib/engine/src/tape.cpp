#include "tape.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace engine {
namespace tape {
namespace {

struct RowPct {
  const char* row;
  int pct;
};
// Row -> percent of the nasion-inion arc, from the nasion.
constexpr RowPct kRows[] = {{"Fp", 10}, {"AFp", 15}, {"AF", 20}, {"AFF", 25}, {"F", 30},  {"FFC", 35}, {"FC", 40},
                            {"FCC", 45}, {"C", 50},  {"CCP", 55}, {"CP", 60}, {"CPP", 65}, {"P", 70},   {"PPO", 75},
                            {"PO", 80}, {"POO", 85}, {"O", 90},   {"OI", 95}, {"I", 100}};
// Lateral sites of some rows carry a temporal prefix (FT7 = the FC row at column 7).
struct Lateral {
  const char* row;
  const char* lateral;
};
constexpr Lateral kLateral[] = {{"FFC", "FFT"}, {"FC", "FT"}, {"FCC", "FTT"}, {"C", "T"},
                                {"CCP", "TTP"}, {"CP", "TP"}, {"CPP", "TPP"}};
// Prefixes in the order the web app's regular expression tries them.
constexpr const char* kPrefixes[] = {"AFp", "AFF", "FFC", "FFT", "FCC", "FTT", "CCP", "TTP", "CPP", "TPP", "PPO", "POO", "Fp",
                                     "AF",  "FC",  "FT",  "CP",  "TP",  "PO",  "OI",  "F",   "C",   "T",   "P",   "O",   "I"};

int rowPct(const std::string& row) {
  for (const auto& r : kRows)
    if (row == r.row) return r.pct;
  return -1;
}
const char* lateralOf(const std::string& row) {
  for (const auto& l : kLateral)
    if (row == l.row) return l.lateral;
  return nullptr;
}
std::string rowOf(const std::string& prefix) {
  for (const auto& l : kLateral)
    if (prefix == l.lateral) return l.row;
  return prefix;
}
std::string siteAt(const std::string& row, int col) {
  if (col == 0) return row + "z";
  const char* lat = col >= 7 ? lateralOf(row) : nullptr;
  return (lat ? std::string(lat) : row) + std::to_string(col);
}

// JS String(number) for the values used here (integers and halves).
std::string jsNum(double x) {
  char buf[32];
  if (x == std::floor(x)) std::snprintf(buf, sizeof buf, "%d", static_cast<int>(x));
  else std::snprintf(buf, sizeof buf, "%g", x);
  return buf;
}
std::string fmt(double cm) { return toFixed1(cm) + " cm"; }
const char* fraction(int eighths) {
  static const char* kNames[] = {"", "1/8", "1/4", "3/8", "halfway", "5/8", "3/4", "7/8"};
  return eighths >= 1 && eighths <= 7 ? kNames[eighths] : "";
}
int jsRound(double x) { return static_cast<int>(std::floor(x + 0.5)); }
std::string way(double x) {
  const int e = jsRound(x * 8);
  return e == 4 ? "halfway" : std::string(fraction(e)) + " of the way";
}
const char* sideWord(Side s) { return s == Side::Left ? "left" : "right"; }

}  // namespace

std::string toFixed1(double x) {
  // Exact decimal digits of the double, then round half up like toFixed.
  char buf[64];
  std::snprintf(buf, sizeof buf, "%.20f", x);
  char* dot = std::strchr(buf, '.');
  if (!dot) return buf;
  const std::string whole(buf, dot);
  const char tenth = dot[1];
  const char* rest = dot + 2;  // digits after the first decimal
  bool up = false;
  if (*rest > '5') up = true;
  else if (*rest == '5') up = true;  // a tie or above: toFixed picks the larger value
  long long scaled = std::atoll(whole.c_str()) * 10 + (tenth - '0') + (up ? 1 : 0);
  char out[48];
  std::snprintf(out, sizeof out, "%lld.%lld", scaled / 10, scaled % 10);
  return out;
}

bool parseSite(const std::string& name, Site& out) {
  for (const char* prefix : kPrefixes) {
    const size_t n = std::strlen(prefix);
    if (name.compare(0, n, prefix) != 0) continue;
    std::string rest = name.substr(n);
    bool half = false;
    if (!rest.empty() && rest.back() == 'h') {
      half = true;
      rest.pop_back();
    }
    bool zed = rest == "z" && !half;
    bool digits = !rest.empty() && rest.find_first_not_of("0123456789") == std::string::npos;
    if (!zed && !digits) continue;  // try a shorter prefix, like the regex does
    Site s;
    s.name = name;
    s.row = rowOf(prefix);
    s.pct = rowPct(s.row);
    if (zed) {
      s.side = Side::Mid;
      if (s.pct == 10) s.kind = Kind::Ring, s.k = 0;
      else if (s.pct == 90) s.kind = Kind::Ring, s.k = 10;
      else if (s.pct > 90) s.kind = Kind::Back, s.steps = 0;
      else s.kind = Kind::Mid;
      out = s;
      return true;
    }
    const int num = std::atoi(rest.c_str());
    s.side = num % 2 ? Side::Left : Side::Right;
    const int col = num % 2 ? num : num - 1;
    if (s.row == "Fp" || s.row == "O") {
      const double steps = half ? 0.5 : 1;
      s.kind = Kind::Ring;
      s.k = s.row == "Fp" ? steps : 10 - steps;
    } else if (s.row == "I" || s.row == "OI") {
      s.kind = Kind::Back;
      s.steps = half ? 0.5 : 1;
    } else {
      const double f = (half ? col : col + 1) / 8.0;
      if (f == 1) {
        s.kind = Kind::Ring;
        s.k = s.pct / 10.0;
      } else if (f > 1) {
        s.kind = Kind::Low;
        s.k = s.pct / 10.0;
        s.drop = (f - 1) * 4;
      } else {
        s.kind = Kind::Row;
        s.f = f;
        s.ring = siteAt(s.row, s.side == Side::Left ? 7 : 8);
        s.mid = siteAt(s.row, 0);
      }
    }
    out = s;
    return true;
  }
  return false;
}

bool templateFromJson(const mj::Value& v, Template& out) {
  out.circumference = v["circumference"].num(0);
  out.nasionInion = v["nasionInion"].num(0);
  out.earEar = v["earEar"].num(0);
  out.rows.clear();
  for (const auto& m : v["rows"].members()) out.rows[m.first] = m.second.num(0);
  return out.circumference > 0 && out.nasionInion > 0 && out.earEar > 0 && !out.rows.empty();
}

Head cleanHead(double nasionInion, double earEar, double circumference) {
  Head h;  // typical values
  h.typical = false;
  if (nasionInion >= 25 && nasionInion <= 45) h.nasionInion = nasionInion;
  else h.typical = true;
  if (earEar >= 25 && earEar <= 45) h.earEar = earEar;
  else h.typical = true;
  if (circumference >= 40 && circumference <= 70) h.circumference = circumference;
  else h.typical = true;
  return h;
}

bool recipe(const Template& t, const std::string& site, const Head& head, Recipe& out) {
  Site s;
  if (!parseSite(site, s)) return false;
  const double C = head.circumference, NI = head.nasionInion, LR = head.earEar;
  const double step = C / 20;
  const double scale = (C / t.circumference + NI / t.nasionInion + LR / t.earEar) / 3;
  const std::string ear = std::string(sideWord(s.side)) + " ear";
  const bool left = s.side == Side::Left;
  Recipe r;
  r.kind = s.kind;

  if (s.kind == Kind::Ring) {
    const double k = s.k;
    const double n = k <= 5 ? k : 10 - k;
    const std::string pctC = k > 0 && k < 10 && k != 5
        ? "For accuracy, measure " + std::string(k <= 5 ? "Fpz" : "Oz") + " → " + (left ? "T7" : "T8") +
              " on the band and take " + jsNum(n) + "/5 from " + (k <= 5 ? "Fpz" : "Oz") +
              "; each fifth is about 5 % of the band."
        : "";
    r.band = "on";
    if (k == 0) {
      r.text = "Front centre of the band: on the midline, " + fmt(0.1 * NI) + " above the nasion (10 % of nasion–inion).";
      r.detail = "Fpz is the 0 point of the band.";
    } else if (k == 10) {
      r.text = "Back centre of the band: on the midline, " + fmt(0.1 * NI) + " above the inion (10 % of nasion–inion).";
      r.detail = "Oz is halfway round the band from Fpz.";
    } else if (k == 5) {
      r.text = "On the band right above the " + ear + ": " + fmt(0.1 * LR) +
               " above the ear point (10 % of ear-to-ear), a quarter of the way round from Fpz (" + fmt(5 * step) + ").";
      r.detail = pctC;
    } else {
      if (k > 2.5 && k < 7.5)
        r.text = "On the band, " + fmt(std::fabs(k - 5) * step) + " " + (k < 5 ? "in front of" : "behind") + " " +
                 (left ? "T7" : "T8") + " (the band point above the " + ear + ").";
      else
        r.text = "On the band, " + fmt((k < 5 ? k : 10 - k) * step) + " from " + (k < 5 ? "Fpz" : "Oz") +
                 " toward the " + ear + ".";
      r.detail = pctC;
    }
    out = r;
    return true;
  }

  if (s.kind == Kind::Mid) {
    const bool fromNasion = s.pct <= 50;
    const double d = ((fromNasion ? s.pct : 100 - s.pct) / 100.0) * NI;
    r.band = "above";
    r.bandCm = (std::min(s.pct, 100 - s.pct) - 10) / 100.0 * NI;
    if (s.name == "Cz")
      r.text = "The crown: halfway from nasion to inion (" + fmt(0.5 * NI) + ") and halfway from ear to ear (" +
               fmt(0.5 * LR) + ").";
    else
      r.text = "On the midline, " + fmt(d) + " from the " + (fromNasion ? "nasion" : "inion") + " (" +
               std::to_string(fromNasion ? s.pct : 100 - s.pct) + " % of nasion–inion).";
    r.detail = std::to_string(s.pct) + " % of nasion–inion from the nasion";
    out = r;
    return true;
  }

  if (s.kind == Kind::Row) {
    const double up = 1 - s.f;
    r.band = "above";
    if (s.row == "C") {
      const double fromEar = (0.5 - 0.4 * s.f) * LR;
      r.bandCm = up * 0.4 * LR;
      const std::string lead = s.f < 0.5 ? fmt(s.f * 0.4 * LR) + " from Cz toward " + s.ring
                                         : fmt(r.bandCm) + " above " + s.ring + " toward Cz";
      r.text = "On the ear-to-ear line, " + lead + ": " + fmt(fromEar) + " up from the " + ear + " point (" +
               std::to_string(jsRound((fromEar / LR) * 100)) + " % of ear-to-ear).";
      r.detail = way(up) + " from " + s.ring + " to Cz";
      out = r;
      return true;
    }
    const auto it = t.rows.find(s.row);
    const double arc = (it == t.rows.end() ? 0 : it->second) * scale;
    r.bandCm = up * arc;
    if (s.f < 0.5)
      r.text = "About " + fmt(s.f * arc) + " from " + s.mid + " (midline) toward " + s.ring + ", on the line from " + s.mid +
               " down to " + s.ring + " (band): " + way(s.f) + " from " + s.mid + ".";
    else
      r.text = "About " + fmt(r.bandCm) + " above " + s.ring + ", on the line from " + s.ring + " (band) up to " + s.mid +
               " (midline): " + way(up) + " from " + s.ring + ".";
    const std::string from = s.f < 0.5 ? s.mid : s.ring, to = s.f < 0.5 ? s.ring : s.mid;
    const double x = s.f < 0.5 ? s.f : up;
    const std::string part = jsRound(x * 8) == 4 ? "half" : std::string(fraction(jsRound(x * 8))) + " from " + from;
    r.detail = "For accuracy, measure " + from + " → " + to + " on the head and take " + part +
               "; the cm value is scaled from the template head.";
    r.estimate = true;
    out = r;
    return true;
  }

  if (s.kind == Kind::Low) {
    const std::string ring = siteAt(s.row, left ? 7 : 8);
    r.band = "below";
    if (s.row == "C") {
      r.bandCm = 0.1 * LR * s.drop;
      r.text = s.drop == 1 ? "On the " + ear + " point (front root of the tragus): " + fmt(r.bandCm) + " straight below " + ring + "."
                           : "Halfway between " + ring + " and the " + ear + " point: " + fmt(r.bandCm) + " below " + ring + ".";
      r.detail = "0 % line: nasion – ear point – inion";
      out = r;
      return true;
    }
    r.bandCm = 0.1 * ((NI + LR) / 2) * s.drop;
    r.text = s.drop == 1
        ? "About " + fmt(r.bandCm) + " straight below " + ring + ", on the low line from the nasion past the " + ear + " point to the inion."
        : "About " + fmt(r.bandCm) + " below " + ring + ", halfway down to the low line (nasion – ear point – inion).";
    r.detail = std::string("Below the band: use a second strap or a cap.") +
               (s.k <= 2.5 ? " This is next to the eye: keep the coil off the eyelid and the eye socket." : "");
    r.estimate = true;
    out = r;
    return true;
  }

  // Around the inion.
  r.band = "below";
  if (s.row == "I") {
    r.bandCm = 0.1 * NI;
    if (s.side == Side::Mid) {
      r.text = "On the inion, the bump at the back of the skull: " + fmt(0.1 * NI) + " below Oz.";
      r.detail = "100 % of nasion–inion";
    } else {
      const std::string below = s.steps == 1 ? (left ? "O1" : "O2") : (left ? "O1h" : "O2h");
      r.text = "On the low line beside the inion, about " + fmt(s.steps * step) + " to the " + sideWord(s.side) +
               " of Iz (below " + below + ").";
      r.detail = "Below the band: use a second strap or a cap.";
      r.estimate = true;
    }
    out = r;
    return true;
  }
  r.bandCm = 0.05 * NI;
  if (s.side == Side::Mid) {
    r.text = "On the midline halfway between Oz and the inion: " + fmt(0.05 * NI) + " below Oz.";
    r.detail = "95 % of nasion–inion";
  } else {
    const std::string h = s.steps == 1 ? "" : "h";
    r.text = std::string("Halfway between ") + (left ? "O1" : "O2") + h + " on the band and " + (left ? "I1" : "I2") + h +
             " beside the inion.";
    r.detail = "Below the band: use a second strap or a cap.";
    r.estimate = true;
  }
  out = r;
  return true;
}

std::string describeSite(const std::string& name) {
  Site s;
  if (!parseSite(name, s)) return "";
  const char* side = s.side == Side::Mid ? "Midline" : s.side == Side::Left ? "Left" : "Right";
  std::string part;
  if (s.kind == Kind::Ring || s.kind == Kind::Low) {
    const double k = s.k;
    const bool low = s.kind == Kind::Low;
    const bool half = low && s.drop < 1;
    if (k <= 1) part = low ? (half ? "on the eyebrow" : "over the eye (keep coils off)") : "forehead";
    else if (k <= 2.5) {
      if (!low) part = "forehead, above the outer eyebrow";
      else if (!half)
        part = k < 2 ? "over the outer eye (keep coils off)"
             : k == 2 ? "beside the eye, on the rim of the eye socket (keep coils off)"
                      : "low temple, just behind the outer corner of the eye";
      else
        part = k < 2 ? "on the outer eyebrow" : k == 2 ? "outer end of the eyebrow" : "front of the temple, just behind the end of the eyebrow";
    } else if (k <= 3) part = low ? "low temple, beside the eye" : "front of the temple";
    else if (k < 5) part = low ? "in front of the ear, low" : "temple, in front of the ear top";
    else if (k == 5) part = !low ? "just above the ear" : half ? "front of the ear, where its top joins the head" : "at the ear point, in front of the ear canal";
    else if (k < 6) part = !low ? "just above the ear top" : half ? "over the upper ear (the coil rests on the ear)" : "on the ear, behind the tragus";
    else if (k == 6 && half) part = "behind the upper ear, at its back edge";
    else if (k <= 6.5) part = low ? "behind the ear, low" : "behind the ear top";
    else if (k <= 7.5) part = low ? "back of the head, low" : "back of the head, side";
    else part = low ? "back of the head, above the neck" : "back of the head";
  } else if (s.kind == Kind::Mid) {
    part = s.pct <= 25 ? "upper forehead" : s.pct < 50 ? "front of the top of the head" : s.pct == 50 ? "crown"
         : s.pct <= 70 ? "top, behind the crown" : "back of the head, upper";
  } else if (s.kind == Kind::Row) {
    if (s.f >= 0.625) {
      part = s.pct <= 25 ? "forehead, outer part"
           : s.pct <= 35 ? "side of the forehead, above the temple"
           : s.pct <= 45 ? "side, above and in front of the ear"
           : s.pct <= 55 ? "side, above the ear"
           : s.pct <= 70 ? "side, above and behind the ear"
                         : "back of the head, side";
    } else {
      const char* zone = s.pct <= 25 ? "forehead" : s.pct <= 45 ? "front of the top of the head" : s.pct <= 55 ? "top of the head"
                       : s.pct <= 70 ? "top, behind the crown" : "back of the head";
      part = std::string(zone) + ", " + (s.f < 0.5 ? "beside the midline" : "halfway from the midline to the band");
    }
  } else {
    part = s.side == Side::Mid ? "back of the head, at the bony ridge" : "back of the head, beside the bony ridge";
  }
  return std::string(side) + " · " + part;
}

}  // namespace tape
}  // namespace engine
