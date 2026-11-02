// Host-side unit tests for lib/engine and lib/minijson.
// Build & run: ./test/run_host_tests.sh   (from firmware/)
#include <cmath>
#include <cstdio>
#include <cstring>
#include <dirent.h>
#include <fstream>
#include <sstream>
#include <string>

#include "ad5328_words.h"
#include "astro.h"
#include "bench.h"
#include "bleframe.h"
#include "drive.h"
#include "minijson.h"
#include "patterns.h"
#include "preset_json.h"
#include "tape.h"
#include "session.h"
#include "spatial.h"

using namespace engine;

static int g_failures = 0;
static int g_checks = 0;

#define CHECK(cond)                                                     \
  do {                                                                  \
    ++g_checks;                                                         \
    if (!(cond)) {                                                      \
      ++g_failures;                                                     \
      std::printf("  FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);     \
    }                                                                   \
  } while (0)

#define CHECK_NEAR(a, b, tol)                                                          \
  do {                                                                                 \
    ++g_checks;                                                                        \
    const double _a = (a), _b = (b);                                                   \
    if (std::fabs(_a - _b) > (tol)) {                                                  \
      ++g_failures;                                                                    \
      std::printf("  FAIL %s:%d: %s = %.6f, expected %.6f\n", __FILE__, __LINE__, #a, \
                  _a, _b);                                                             \
    }                                                                                  \
  } while (0)

static int activeChannel(const float g[kChannels]) {
  int idx = -1;
  for (int ch = 0; ch < kChannels; ++ch) {
    if (g[ch] > 0.5f) {
      if (idx != -1) return -2;  // more than one
      idx = ch;
    }
  }
  return idx;
}

static void testAd5328Words() {
  std::printf("ad5328 words\n");
  CHECK(ad5328::dacWord(0, 0x800) == 0x0800);
  CHECK(ad5328::dacWord(7, 0xFFF) == 0x7FFF);
  CHECK(ad5328::dacWord(3, 0x123) == 0x3123);
  CHECK(ad5328::gainRefWord(true, false) == 0x8030);
  CHECK(ad5328::gainRefWord(true, true) == 0x803C);
  CHECK(ad5328::gainRefWord(false, false, true) == 0x8003);
  CHECK(ad5328::ldacWord(ad5328::LdacMode::High) == 0xA001);
  CHECK(ad5328::ldacWord(ad5328::LdacMode::Low) == 0xA000);
  CHECK(ad5328::powerDownWord(0xFF) == 0xC0FF);
  CHECK(ad5328::resetAllWord() == 0xF000);
  CHECK(ad5328::resetDataWord() == 0xE000);
}

static void testDrive() {
  std::printf("drive\n");
  DriveConfig cfg;
  CHECK_NEAR(maxCurrentMA(cfg), 4.5368, 1e-3);
  // 1 uT at 0.73 uT/mA -> 1.3699 mA -> 1.3699/4.5368*2047 = 618.1 codes
  CHECK_NEAR(swingForFieldUT(cfg, 1.0f, 0.73f), 618.1, 0.5);
  CHECK_NEAR(swingForFieldUT(cfg, 100.0f, 0.73f), 2047.0, 1e-3);  // clamped
  CHECK_NEAR(maxFieldUT(cfg, 0.73f), 3.312, 1e-2);
  CHECK(toCode(0.0f, 2047.0f) == 2048);
  CHECK(toCode(1.0f, 2047.0f) == 4095);
  CHECK(toCode(-1.0f, 2047.0f) == 1);
  CHECK(toCode(5.0f, 2047.0f) == 4095);
  CHECK(toCode(-5.0f, 4000.0f) == 0);
}

static void testPatterns() {
  std::printf("patterns\n");
  PatternParams sine = patternDefaults(PatternType::Sine);
  sine.pointMs = 0;
  CHECK_NEAR(patternValue(sine, 0.0), 0.0, 1e-6);
  CHECK_NEAR(patternValue(sine, 1000.0 / (4 * 7.0)), 1.0, 1e-4);   // quarter period of 7 Hz
  CHECK_NEAR(patternValue(sine, 3600000.0 + 1000.0 / 28.0), 1.0, 1e-3);  // after 1 h
  sine.pointMs = 3;
  CHECK(patternValue(sine, 4.0) == patternValue(sine, 3.0));  // sample-and-hold
  CHECK(patternValue(sine, 5.9) == patternValue(sine, 3.0));

  PatternParams burst = patternDefaults(PatternType::Burst);
  CHECK(burst.f1 > burst.f0);  // accelerating
  CHECK(patternValue(burst, burst.sweepMs + 100.0) == 0.0f);  // inside the gap
  const double period = burst.sweepMs + burst.gapMs;
  CHECK(patternValue(burst, 123.0) == patternValue(burst, 123.0 + period));

  PatternParams thomas = patternDefaults(PatternType::Thomas);
  CHECK(thomas.f0 > thomas.f1);  // decelerating

  // Zero crossings of a linear chirp get denser as frequency rises.
  PatternParams chirp = patternDefaults(PatternType::Chirp);
  chirp.pointMs = 0;
  int earlyCross = 0, lateCross = 0;
  float prev = patternValue(chirp, 0.0);
  for (int i = 1; i < 2000; ++i) {
    const float v = patternValue(chirp, i);
    if ((v >= 0) != (prev >= 0)) {
      if (i < 500) ++earlyCross;
      else if (i >= 1500) ++lateCross;
    }
    prev = v;
  }
  CHECK(lateCross > earlyCross * 3);

  PatternParams pulse = patternDefaults(PatternType::Pulse);
  CHECK(patternValue(pulse, 50.0) == 1.0f);
  CHECK(patternValue(pulse, 150.0) == 0.0f);
  CHECK(patternValue(pulse, 250.0) == -1.0f);
  pulse.alternate = false;
  CHECK(patternValue(pulse, 250.0) == 1.0f);

  PatternParams rnd = patternDefaults(PatternType::SemiRandom);
  float lo = 1, hi = -1;
  for (int i = 0; i < 5000; ++i) {
    const float v = patternValue(rnd, i * 3.0);
    lo = std::min(lo, v);
    hi = std::max(hi, v);
  }
  CHECK(lo >= -1.0f && hi <= 1.0f && lo < -0.9f && hi > 0.9f);
  CHECK(patternValue(rnd, 7.0) == patternValue(rnd, 8.0));  // same 3 ms point

  const int8_t table[] = {0, 127, -127, 64};
  PatternParams tab = patternDefaults(PatternType::Table);
  tab.table = table;
  tab.tableLen = 4;
  tab.pointMs = 3;
  CHECK_NEAR(patternValue(tab, 3.5), 1.0, 1e-6);
  CHECK_NEAR(patternValue(tab, 6.0), -1.0, 1e-6);
  CHECK_NEAR(patternValue(tab, 12.0 + 3.0), 1.0, 1e-6);  // wraps after 4 points

  PatternType t;
  CHECK(patternFromName("thomas", t) && t == PatternType::Thomas);
  CHECK(!patternFromName("nope", t));
}

static void testSpatial() {
  std::printf("spatial\n");
  float g[kChannels];
  SpatialParams rot;
  rot.mode = SpatialMode::Rotate;
  rot.dwellStartMs = rot.dwellEndMs = 20;

  // Ring CCW: 0,1,...,7 every 20 ms, back to 0 after 160 ms.
  for (int k = 0; k < 9; ++k) {
    spatialGains(rot, Layout::Ring, k * 20.0 + 1.0, g);
    CHECK(activeChannel(g) == k % 8);
  }
  rot.ccw = false;
  spatialGains(rot, Layout::Ring, 21.0, g);
  CHECK(activeChannel(g) == 7);

  // Temporal CCW: left front->back, then right back->front.
  rot.ccw = true;
  const int expected[] = {0, 1, 2, 3, 7, 6, 5, 4};
  for (int k = 0; k < 8; ++k) {
    spatialGains(rot, Layout::Temporal, k * 20.0 + 1.0, g);
    CHECK(activeChannel(g) == expected[k]);
  }

  // Dwell ramp 10->20 ms (+2): steps begin at 0,10,22,36,52,70 ; cycle = 90 ms.
  SpatialParams ramp = rot;
  ramp.dwellStartMs = 10;
  ramp.dwellStepMs = 2;
  ramp.dwellEndMs = 20;
  CHECK(dwellPosition(ramp, 9.9).step == 0);
  CHECK(dwellPosition(ramp, 10.1).step == 1);
  CHECK(dwellPosition(ramp, 21.9).step == 1);
  CHECK(dwellPosition(ramp, 22.1).step == 2);
  CHECK(dwellPosition(ramp, 89.9).step == 5);
  CHECK(dwellPosition(ramp, 90.1).step == 6);
  CHECK_NEAR(dwellPosition(ramp, 27.0).frac, 5.0 / 14.0, 1e-4);

  // Decreasing ramp 25->11 (-2): 8 values, cycle = 144 ms.
  SpatialParams down = rot;
  down.dwellStartMs = 25;
  down.dwellStepMs = -2;
  down.dwellEndMs = 11;
  CHECK(dwellPosition(down, 143.9).step == 7);
  CHECK(dwellPosition(down, 144.1).step == 8);

  // Mismatched sign -> fixed dwell.
  SpatialParams bad = rot;
  bad.dwellStartMs = 20;
  bad.dwellStepMs = -2;
  bad.dwellEndMs = 30;
  CHECK(dwellPosition(bad, 41.0).step == 2);

  // Cycle within the right side (temporal, CCW = back -> front).
  SpatialParams cyc;
  cyc.mode = SpatialMode::Cycle;
  cyc.side = Side::Right;
  cyc.dwellStartMs = cyc.dwellEndMs = 3;
  const int right[] = {7, 6, 5, 4, 7};
  for (int k = 0; k < 5; ++k) {
    spatialGains(cyc, Layout::Temporal, k * 3.0 + 0.5, g);
    CHECK(activeChannel(g) == right[k]);
  }
  // Ring right side has 3 coils: P8, T8, F8.
  spatialGains(cyc, Layout::Ring, 3 * 3.0 + 0.5, g);
  CHECK(activeChannel(g) == 5);

  // Crossfade splits the gain between neighbours.
  cyc.crossfade = true;
  spatialGains(cyc, Layout::Temporal, 1.5, g);
  CHECK_NEAR(g[7], 0.5, 1e-3);
  CHECK_NEAR(g[6], 0.5, 1e-3);

  // Left/right in the ring excludes midline coils (Fpz, Oz).
  SpatialParams side;
  side.mode = SpatialMode::Left;
  spatialGains(side, Layout::Ring, 0, g);
  CHECK(g[0] == 0 && g[1] == 1 && g[2] == 1 && g[3] == 1 && g[4] == 0 && g[5] == 0);
  side.mode = SpatialMode::Right;
  spatialGains(side, Layout::Temporal, 0, g);
  CHECK(g[3] == 0 && g[4] == 1 && g[7] == 1);

  // Alternation: left for 2 s, then right.
  SpatialParams alt;
  alt.mode = SpatialMode::Alternate;
  alt.alternateMs = 2000;
  spatialGains(alt, Layout::Temporal, 100, g);
  CHECK(g[0] == 1 && g[4] == 0);
  spatialGains(alt, Layout::Temporal, 2100, g);
  CHECK(g[0] == 0 && g[4] == 1);

  // Weights scale the result.
  SpatialParams w;
  w.mode = SpatialMode::Bilateral;
  w.weights[6] = 0.25f;
  spatialGains(w, Layout::Temporal, 0, g);
  CHECK_NEAR(g[6], 0.25, 1e-6);
  CHECK_NEAR(g[5], 1.0, 1e-6);

  SpatialParams single;
  single.mode = SpatialMode::Single;
  single.channel = 5;
  spatialGains(single, Layout::Ring, 0, g);
  CHECK(activeChannel(g) == 5);
}

static void testCustomPlacement() {
  std::printf("custom placement\n");
  int8_t side = 9;
  CHECK(sideFromSite("T7", side) && side == -1);
  CHECK(sideFromSite("CP6", side) && side == 1);
  CHECK(sideFromSite("Cz", side) && side == 0);
  CHECK(sideFromSite("FTT8h", side) && side == 1);
  CHECK(sideFromSite("T10", side) && side == 1);
  CHECK(sideFromSite("AF7", side) && side == -1);
  CHECK(!sideFromSite("X", side) && !sideFromSite("", side) && !sideFromSite("Tq", side));
  CHECK(!sideFromSite("99", side) && !sideFromSite("T7x", side) && !sideFromSite("7T", side));
  CHECK(sideFromSite("Fpz", side) && side == 0);

  // Standard layouts through the Geometry API match the old behaviour.
  const Geometry ring = geometryFor(Layout::Ring);
  int order[kChannels];
  CHECK(sideOrder(ring, Side::Right, true, order) == 3 && order[0] == 5 && order[2] == 7);
  CHECK(sideOrder(geometryFor(Layout::Temporal), Side::Right, false, order) == 4 && order[0] == 7 && order[1] == 4);

  // Right-hemisphere grid with two unused channels and an explicit order.
  mj::Value doc;
  std::string err;
  Session s;
  mj::parse(R"({"id":"c","layout":"custom",
    "placement":{"sites":["T8","TP8","CP6","P8","C6","","FT8",""],"order":[6,0,4,2,1,3]},
    "phases":[{"seconds":10,"pattern":{"type":"dc"},"spatial":{"mode":"rotate","dwellMs":10}}]})", doc);
  CHECK(sessionFromJson(doc, s, nullptr, &err));
  CHECK(s.layout == Layout::Custom && s.geometry.count == 6);
  CHECK(std::string(s.sites[2]) == "CP6" && s.sites[5][0] == '\0');
  CHECK(s.geometry.side[0] == 1 && s.geometry.side[5] == 0);
  float g[kChannels];
  const int expected[] = {6, 0, 4, 2, 1, 3, 6};
  for (int k = 0; k < 7; ++k) {
    spatialGains(s.phases[0].spatial, s.geometry, k * 10.0 + 1.0, g);
    CHECK(activeChannel(g) == expected[k]);
  }
  // "left" on an all-right placement drives nothing; "right" drives the 6 used coils only.
  SpatialParams right;
  right.mode = SpatialMode::Right;
  spatialGains(right, s.geometry, 0, g);
  CHECK(g[0] == 1 && g[5] == 0 && g[7] == 0);
  SpatialParams cyc;
  cyc.mode = SpatialMode::Cycle;
  cyc.side = Side::Left;
  spatialGains(cyc, s.geometry, 0, g);
  CHECK(activeChannel(g) == -1);  // no left coils: silent, no crash

  // Default order = used channels in index order.
  mj::parse(R"({"id":"c","layout":"custom","placement":{"sites":["F3","F4","","","","","",""]},
    "phases":[{"seconds":10,"pattern":{"type":"dc"},"spatial":{"mode":"alternate","alternateMs":100}}]})", doc);
  CHECK(sessionFromJson(doc, s, nullptr, &err));
  CHECK(s.geometry.count == 2 && s.geometry.order[0] == 0 && s.geometry.order[1] == 1);
  spatialGains(s.phases[0].spatial, s.geometry, 150, g);
  CHECK(g[0] == 0 && g[1] == 1);  // right side (F4) second

  // Errors.
  mj::parse(R"({"id":"c","layout":"custom","phases":[{"seconds":1,"pattern":{"type":"dc"}}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err) && err.find("placement") != std::string::npos);
  mj::parse(R"({"id":"c","layout":"custom","placement":{"sites":["Q9x","","","","","","",""]},"phases":[{"seconds":1,"pattern":{"type":"dc"}}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err) && err.find("Q9x") != std::string::npos);
  mj::parse(R"({"id":"c","layout":"custom","placement":{"sites":["T8","","","","","","",""],"order":[1]},"phases":[{"seconds":1,"pattern":{"type":"dc"}}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err));
  mj::parse(R"({"id":"c","layout":"ring","placement":{"sites":["T8","","","","","","",""]},"phases":[{"seconds":1,"pattern":{"type":"dc"}}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err) && err.find("custom") != std::string::npos);
  // Standard layouts carry their site names.
  mj::parse(R"({"id":"r","layout":"ring","phases":[{"seconds":1,"pattern":{"type":"dc"}}]})", doc);
  CHECK(sessionFromJson(doc, s, nullptr, &err) && std::string(s.sites[0]) == "Fpz" && std::string(s.sites[6]) == "T8");
}

static void testEngineV2() {
  std::printf("engine v2: tracks, inline tables, pm, noise, both-sides cycle\n");
  mj::Value doc;
  std::string err;
  Session s;

  // Phase-modulated sine: depth 0 = plain sine; values stay in [-1, 1].
  PatternParams pm = patternDefaults(PatternType::PhaseMod);
  pm.pointMs = 0;
  pm.depth = 0;
  CHECK_NEAR(patternValue(pm, 1000.0 / 160.0), 1.0, 1e-4);  // quarter period of 40 Hz
  pm.depth = 3;
  float lo = 1, hi = -1;
  for (int i = 0; i < 4000; ++i) {
    const float v = patternValue(pm, i * 0.5);
    lo = std::min(lo, v);
    hi = std::max(hi, v);
  }
  CHECK(lo >= -1 && hi <= 1 && lo < -0.99f && hi > 0.99f);

  // Band-limited noise: deterministic per seed, bounded, roughly zero-mean.
  PatternParams nz = patternDefaults(PatternType::Noise);
  nz.pointMs = 0;
  double mean = 0;
  for (int i = 0; i < 20000; ++i) mean += patternValue(nz, i * 0.5);
  CHECK(std::fabs(mean / 20000) < 0.1);
  CHECK(patternValue(nz, 123.0) == patternValue(nz, 123.0));
  PatternParams nz2 = nz;
  nz2.seed = 2;
  CHECK(patternValue(nz, 123.0) != patternValue(nz2, 123.0));

  // Two tracks (left burst / right sine) and per-pattern inline tables.
  mj::parse(R"({"id":"t","layout":"temporal","phases":[
    {"seconds":10,"tracks":[
      {"pattern":{"type":"table","pointMs":1,"data":[255,0]},"spatial":{"mode":"left"}},
      {"pattern":{"type":"table","pointMs":1,"data":[128,192,64]},"spatial":{"mode":"right"},"level":0.5}]},
    {"seconds":10,"pattern":{"type":"dc"},"spatial":{"mode":"cycle","side":"both","dirLeft":"cw","dirRight":"ccw","dwellMs":10}}]})", doc);
  CHECK(sessionFromJson(doc, s, nullptr, &err));
  CHECK(s.phases[0].hasTrack2 && s.table.size() == 5);
  CHECK(s.phases[0].pattern.tableOffset == 0 && s.phases[0].pattern2.tableOffset == 2);
  SessionRunner r;
  r.start(&s);
  auto f = r.advance(9999.5);  // inside phase 0, envelope 1 (fade-in done? 10 s fade -> 1)
  float v[kChannels];
  SessionRunner::Frame fr = f;
  fr.envelope = 1;
  fr.phaseMs = 1.5;  // point 1: left table 0 -> -1 ; right table 192 -> 0.504 * 0.5
  render(s, fr, v);
  CHECK_NEAR(v[0], -1.0, 1e-6);
  CHECK_NEAR(v[4], 64.0 / 127.0 * 0.5, 1e-4);
  // Both sides cycle simultaneously: one coil per side, left clockwise, right counter-clockwise.
  float g[kChannels];
  spatialGains(s.phases[1].spatial, s.geometry, 1.0, g);
  CHECK(g[0] == 1 && g[7] == 1);
  spatialGains(s.phases[1].spatial, s.geometry, 11.0, g);
  CHECK(g[3] == 1 && g[6] == 1);  // left CW: 0 -> 3 ; right CCW: 7 -> 6

  // Errors.
  mj::parse(R"({"id":"t","phases":[{"seconds":1,"tracks":[]}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err));
  mj::parse(R"({"id":"t","phases":[{"seconds":1,"pattern":{"type":"noise","f0":8,"f1":4}}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err) && err.find("noise") != std::string::npos);
  mj::parse(R"({"id":"t","phases":[{"seconds":1,"pattern":{"type":"dc"},"spatial":{"side":"top"}}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err));
}

static Session twoPhaseSession() {
  Session s;
  s.layout = Layout::Temporal;
  s.phaseCount = 2;
  s.fadeInMs = 100;
  s.fadeOutMs = 100;
  s.phases[0].durationMs = 1000;
  s.phases[0].pattern = patternDefaults(PatternType::DC);
  s.phases[0].spatial.mode = SpatialMode::Right;
  s.phases[1].durationMs = 1000;
  s.phases[1].pattern = patternDefaults(PatternType::DC);
  s.phases[1].spatial.mode = SpatialMode::Bilateral;
  s.phases[1].level = 0.5f;
  return s;
}

static void testSession() {
  std::printf("session\n");
  Session s = twoPhaseSession();
  CHECK(s.totalMs() == 2000);

  SessionRunner r;
  r.start(&s);
  CHECK(r.running());
  auto f = r.advance(50);
  CHECK_NEAR(f.envelope, 0.5, 1e-4);  // fade-in
  f = r.advance(450);
  CHECK(f.phase == 0);
  CHECK_NEAR(f.envelope, 1.0, 1e-6);

  float v[kChannels];
  render(s, f, v);
  CHECK(v[0] == 0.0f && v[4] == 1.0f);  // right side only

  f = r.advance(1000);  // t = 1500
  CHECK(f.phase == 1);
  CHECK_NEAR(f.phaseMs, 500, 1e-6);
  render(s, f, v);
  CHECK_NEAR(v[0], 0.5, 1e-6);  // phase level 0.5

  f = r.advance(450);  // t = 1950 -> fade-out halfway
  CHECK_NEAR(f.envelope, 0.5, 1e-4);
  f = r.advance(100);
  CHECK(!f.running);  // natural end

  // Skip jumps to the next phase; skipping the last phase starts a stop fade.
  r.start(&s);
  r.advance(200);
  r.skipPhase();
  f = r.frame();
  CHECK(f.phase == 1);
  CHECK_NEAR(f.programMs, 1000, 1e-6);
  CHECK_NEAR(f.elapsedMs, 200, 1e-6);
  r.skipPhase();
  CHECK(r.stopping());

  // Soft stop fades over 2 s, then finishes.
  r.start(&s);
  r.advance(300);
  r.requestStop();
  f = r.advance(1000);
  CHECK(f.running);
  CHECK_NEAR(f.envelope, 0.5, 1e-3);
  f = r.advance(1001);
  CHECK(!f.running);

  // Abrupt vs crossfaded phase switch.
  s.phases[1].crossfade = true;
  r.start(&s);
  f = r.advance(1500);
  CHECK_NEAR(f.envelope, 0.25, 1e-3);  // 500 ms into a 2000 ms ramp

  // Table binding survives.
  s.table = {10, 20, 30, 40};
  s.phases[0].pattern = patternDefaults(PatternType::Table);
  s.phases[0].pattern.tableOffset = 1;
  s.phases[0].pattern.tableLen = 3;
  s.bindTable();
  CHECK(s.phases[0].pattern.table == s.table.data() + 1);
  s.phases[0].pattern.tableLen = 9;  // out of range -> unbound, silent
  s.bindTable();
  CHECK(s.phases[0].pattern.table == nullptr);

  SessionRunner empty;
  Session none;
  empty.start(&none);
  CHECK(!empty.running());
}

static void testAstro() {
  std::printf("astro\n");
  // J2000.0 epoch: 2000-01-01 12:00 UTC -> GMST 18.697374558 h
  CHECK_NEAR(gmstHours(946728000.0), 18.697374558, 1e-6);
  CHECK_NEAR(lstHours(946728000.0, 15.0), 19.697374558, 1e-6);
  CHECK_NEAR(lstHours(946728000.0, -30.0), 16.697374558, 1e-6);
  // One sidereal day later the sidereal time repeats.
  CHECK_NEAR(gmstHours(1767225600.0 + 86164.0905), gmstHours(1767225600.0), 1e-4);
  // Solar day: sidereal time advances by ~3 min 56.6 s.
  CHECK_NEAR(std::fmod(gmstHours(1767225600.0 + 86400.0) - gmstHours(1767225600.0) + 24.0, 24.0),
             0.065710, 1e-4);
}

static void testJson() {
  std::printf("minijson\n");
  mj::Value v;
  std::string err;
  CHECK(mj::parse(R"({"a": 1.5, "b": [1, 2, {"c": "x\"yé"}], "t": true, "n": null})", v, &err));
  CHECK_NEAR(v["a"].num(), 1.5, 1e-12);
  CHECK(v["b"].size() == 3);
  CHECK(std::string(v["b"][2]["c"].str()) == "x\"y\xC3\xA9");
  CHECK(v["t"].boolean(false));
  CHECK(v["n"].isNull());
  CHECK(v["missing"]["deeper"].isNull());
  CHECK_NEAR(v["missing"].num(7), 7, 0);
  CHECK(!mj::parse("{\"a\": }", v, &err));
  CHECK(!mj::parse("[1, 2", v, &err));
  CHECK(!mj::parse("{} x", v, &err));
  CHECK(mj::parse("  [ ]  ", v, &err) && v.isArray() && v.size() == 0);
  CHECK(mj::parse("-2.5e3", v, &err) && v.num() == -2500);

  mj::Writer w;
  w.beginObject().key("s").string("a\"b\n").key("x").number(1.25).key("i").integer(-3);
  w.key("arr").beginArray().number(1).boolean(false).null().endArray();
  w.key("o").beginObject().endObject().endObject();
  CHECK(w.str() == R"({"s":"a\"b\n","x":1.25,"i":-3,"arr":[1,false,null],"o":{}})");
  CHECK(mj::parse(w.str(), v, &err));
}

static std::string readFile(const std::string& path) {
  std::ifstream in(path);
  std::stringstream ss;
  ss << in.rdbuf();
  return ss.str();
}

// The compact form written to the SD card (webapp/src/engine/compact.js):
// numeric "data"/"tableData" arrays become base64 strings of their bytes.
static std::string toBase64(const std::vector<uint8_t>& bytes) {
  static const char* kAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  for (size_t i = 0; i < bytes.size(); i += 3) {
    const uint32_t n = (bytes[i] << 16) | ((i + 1 < bytes.size() ? bytes[i + 1] : 0) << 8) |
                       (i + 2 < bytes.size() ? bytes[i + 2] : 0);
    out += kAlphabet[(n >> 18) & 63];
    out += kAlphabet[(n >> 12) & 63];
    out += i + 1 < bytes.size() ? kAlphabet[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.size() ? kAlphabet[n & 63] : '=';
  }
  return out;
}

static void writeCompact(mj::Writer& w, const mj::Value& v) {
  char num[40];
  switch (v.type()) {
    case mj::Value::Type::Object:
      w.beginObject();
      for (const auto& m : v.members()) {
        if ((m.first == "data" || m.first == "tableData") && m.second.isArray()) {
          std::vector<uint8_t> bytes;
          for (size_t i = 0; i < m.second.size(); ++i) bytes.push_back(static_cast<uint8_t>(m.second[i].num(0)));
          w.key((m.first + "B64").c_str()).string(toBase64(bytes));
        } else {
          w.key(m.first.c_str());
          writeCompact(w, m.second);
        }
      }
      w.endObject();
      break;
    case mj::Value::Type::Array:
      w.beginArray();
      for (size_t i = 0; i < v.size(); ++i) writeCompact(w, v[i]);
      w.endArray();
      break;
    case mj::Value::Type::Number:
      std::snprintf(num, sizeof num, "%.17g", v.num());
      w.raw(num);
      break;
    case mj::Value::Type::String: w.string(v.str()); break;
    case mj::Value::Type::Bool: w.boolean(v.boolean()); break;
    default: w.null(); break;
  }
}

static void testPresets(const char* dir) {
  std::printf("presets (%s)\n", dir);
  DIR* d = opendir(dir);
  CHECK(d != nullptr);
  if (!d) return;
  int count = 0;
  while (dirent* e = readdir(d)) {
    const std::string name = e->d_name;
    if (name.size() < 6 || name.substr(name.size() - 5) != ".json") continue;
    ++count;
    mj::Value doc;
    std::string err;
    const bool parsed = mj::parse(readFile(std::string(dir) + "/" + name), doc, &err);
    if (!parsed) std::printf("  %s: JSON error: %s\n", name.c_str(), err.c_str());
    CHECK(parsed);
    Session s;
    PresetInfo info;
    const bool ok = sessionFromJson(doc, s, &info, &err);
    if (!ok) std::printf("  %s: %s\n", name.c_str(), err.c_str());
    CHECK(ok);
    CHECK(name == std::string(s.id) + ".json");  // file name matches id

    // The compact SD-card form parses to the same tables and timeline.
    {
      mj::Writer w;
      writeCompact(w, doc);
      mj::Value compact;
      Session c;
      const bool cParsed = mj::parse(w.str(), compact, &err) && sessionFromJson(compact, c, nullptr, &err);
      if (!cParsed) std::printf("  %s (compact): %s\n", name.c_str(), err.c_str());
      CHECK(cParsed);
      CHECK(c.table == s.table);
      CHECK(c.totalMs() == s.totalMs() && c.phaseCount == s.phaseCount);
      bool same = true;
      for (int i = 0; i < s.phaseCount; ++i)
        same = same && c.phases[i].pattern.tableOffset == s.phases[i].pattern.tableOffset &&
               c.phases[i].pattern.tableLen == s.phases[i].pattern.tableLen &&
               c.phases[i].pattern2.tableOffset == s.phases[i].pattern2.tableOffset &&
               c.phases[i].pattern2.tableLen == s.phases[i].pattern2.tableLen;
      CHECK(same);
    }
    CHECK(s.totalMs() <= kMaxSessionMs);
    CHECK(!info.source.empty() && !info.summary.empty());
    CHECK(info.uT > 0 && info.uT <= 10);

    // Render the whole session at 2 kHz: outputs stay within [-1, 1].
    SessionRunner r;
    r.start(&s);
    float v[kChannels];
    float peak = 0;
    while (r.running()) {
      const auto f = r.advance(0.5);
      render(s, f, v);
      for (float x : v) peak = std::max(peak, std::fabs(x));
    }
    CHECK(peak <= 1.0f);
    // Sham designs (pattern "off" throughout) must stay silent; everything else must drive the coils.
    bool allOff = true;
    for (int i = 0; i < s.phaseCount; ++i)
      allOff = allOff && s.phases[i].pattern.type == PatternType::Off && (!s.phases[i].hasTrack2 || s.phases[i].pattern2.type == PatternType::Off);
    if (allOff) CHECK(peak == 0.0f);
    else CHECK(peak > 0.5f);
  }
  closedir(d);
  std::printf("  %d preset files\n", count);
  CHECK(count >= 10);

  // Invalid documents are rejected with a message.
  mj::Value doc;
  std::string err;
  Session s;
  mj::parse(R"({"id":"x","phases":[{"minutes":90,"pattern":{"type":"sine"}}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err) && err.find("60") != std::string::npos);
  mj::parse(R"({"id":"x","phases":[{"minutes":1,"pattern":{"type":"warp"}}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err) && err.find("warp") != std::string::npos);
  mj::parse(R"({"id":"x","phases":[{"minutes":1,"pattern":{"type":"sine"},"spatial":{"weights":[1,1]}}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err));
  // Negative weights reverse a coil's polarity; beyond -1..1 is an error.
  mj::parse(R"({"id":"x","phases":[{"minutes":1,"pattern":{"type":"dc"},"spatial":{"weights":[1,-1,0.5,-0.5,0,0,0,0]}}]})", doc);
  CHECK(sessionFromJson(doc, s, nullptr, &err));
  {
    SessionRunner r;
    r.start(&s);
    r.advance(20000);  // past the fade-in
    float v[kChannels];
    render(s, r.frame(), v);
    CHECK(std::fabs(v[0] - 1.0f) < 1e-6f && std::fabs(v[1] + 1.0f) < 1e-6f && std::fabs(v[3] + 0.5f) < 1e-6f);
  }
  mj::parse(R"({"id":"x","phases":[{"minutes":1,"pattern":{"type":"dc"},"spatial":{"weights":[1,-1.5,0,0,0,0,0,0]}}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err) && err.find("-1..1") != std::string::npos);
  mj::parse(R"({"id":"x","phases":[{"minutes":1,"pattern":{"type":"sine"},"spatial":{"dwell":[25,-2,11]}}]})", doc);
  CHECK(sessionFromJson(doc, s, nullptr, &err));
  CHECK(s.phases[0].spatial.dwellStepMs == -2);
}

static void testBleFrame() {
  std::printf("bleframe\n");
  std::string msg;
  for (int i = 0; i < 1000; ++i) msg += static_cast<char>('a' + i % 26);
  const auto packets = bleframe::split(msg, 7, 182);
  CHECK(packets.size() == 6);  // 180 payload bytes per packet
  CHECK(static_cast<uint8_t>(packets[0][0]) == 7);
  CHECK(static_cast<uint8_t>(packets[0][1]) == bleframe::kFirst);
  CHECK(static_cast<uint8_t>(packets[5][1]) == bleframe::kLast);
  bleframe::Reassembler r(4096);
  bool done = false;
  for (const auto& p : packets) done = r.push(reinterpret_cast<const uint8_t*>(p.data()), p.size());
  CHECK(done);
  CHECK(r.take() == msg);

  // Single packet carries both flags; empty message still produces one packet.
  const auto one = bleframe::split("{}", 1, 182);
  CHECK(one.size() == 1 && static_cast<uint8_t>(one[0][1]) == (bleframe::kFirst | bleframe::kLast));
  const auto empty = bleframe::split("", 2, 182);
  CHECK(empty.size() == 1);
  CHECK(r.push(reinterpret_cast<const uint8_t*>(empty[0].data()), empty[0].size()) && r.take().empty());

  // A new FIRST packet discards an unfinished message.
  r.push(reinterpret_cast<const uint8_t*>(packets[0].data()), packets[0].size());
  CHECK(r.push(reinterpret_cast<const uint8_t*>(one[0].data()), one[0].size()));
  CHECK(r.take() == "{}");

  // Continuation without FIRST is ignored; oversize messages are dropped.
  CHECK(!r.push(reinterpret_cast<const uint8_t*>(packets[2].data()), packets[2].size()) && r.dropped());
  bleframe::Reassembler small(100);
  for (const auto& p : packets) CHECK(!small.push(reinterpret_cast<const uint8_t*>(p.data()), p.size()));
  CHECK(small.dropped());
}

static void testTableData() {
  std::printf("tableData\n");
  mj::Value doc;
  std::string err;
  Session s;
  mj::parse(R"({"id":"t","phases":[{"seconds":10,"pattern":{"type":"table","pointMs":3}}],"tableData":[128,255,0,200]})", doc);
  CHECK(sessionFromJson(doc, s, nullptr, &err));
  CHECK(s.table.size() == 4 && s.table[0] == 0 && s.table[1] == 127 && s.table[2] == -127);
  CHECK(s.phases[0].pattern.tableLen == 4);
  mj::parse(R"({"id":"t","phases":[{"seconds":10,"pattern":{"type":"table"}}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err) && err.find("tableData") != std::string::npos);
  mj::parse(R"({"id":"t","phases":[{"seconds":10,"pattern":{"type":"table"}}],"tableData":[300]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err));

  // Base64 tables (SD-card programs): "gP8AyA==" = bytes 128, 255, 0, 200.
  mj::parse(R"({"id":"t","phases":[{"seconds":10,"pattern":{"type":"table","pointMs":3}}],"tableDataB64":"gP8AyA=="})", doc);
  CHECK(sessionFromJson(doc, s, nullptr, &err));
  CHECK(s.table.size() == 4 && s.table[0] == 0 && s.table[1] == 127 && s.table[2] == -127 && s.table[3] == 72);
  mj::parse(R"({"id":"t","phases":[{"seconds":10,"pattern":{"type":"table","dataB64":"gP8A"}}]})", doc);
  CHECK(sessionFromJson(doc, s, nullptr, &err) && s.phases[0].pattern.tableLen == 3);
  mj::parse(R"({"id":"t","phases":[{"seconds":10,"pattern":{"type":"table","dataB64":"gP$A"}}]})", doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err) && err.find("base64") != std::string::npos);
  const std::string big = R"({"id":"t","phases":[{"seconds":10,"pattern":{"type":"table","dataB64":")" +
                          toBase64(std::vector<uint8_t>(8193, 128)) + R"("}}]})";
  mj::parse(big, doc);
  CHECK(!sessionFromJson(doc, s, nullptr, &err) && err.find("8192") != std::string::npos);
}

// Tape-measure directions: the C++ port must match webapp/src/lib/tape.js
// for every 10-5 site at a typical and a measured head
// (fixture from `npm run sd-pack -- --fixture` in webapp/).
static void testTape(const char* fixturePath) {
  std::printf("tape directions (%s)\n", fixturePath);
  using namespace engine::tape;
  CHECK(toFixed1(1.25) == "1.3" && toFixed1(1.15) == "1.1" && toFixed1(2.8) == "2.8" && toFixed1(14) == "14.0");
  mj::Value fx;
  std::string err;
  const bool parsed = mj::parse(readFile(fixturePath), fx, &err);
  CHECK(parsed);
  if (!parsed) return;
  Template t;
  CHECK(templateFromJson(fx["template"], t));
  int mismatches = 0;
  const mj::Value& cases = fx["cases"];
  CHECK(cases.size() > 600);
  for (size_t i = 0; i < cases.size(); ++i) {
    const mj::Value& c = cases[i];
    const mj::Value& h = c["head"];
    const Head head = h.isArray() ? cleanHead(h[0].num(), h[1].num(), h[2].num()) : cleanHead(0, 0, 0);
    Recipe r;
    const bool ok = recipe(t, c["site"].str(), head, r);
    const bool same = ok && r.band == c["band"].str() && std::fabs(r.bandCm - c["bandCm"].num()) < 1e-9 &&
                      r.text == c["text"].str() && r.detail == c["detail"].str() && r.estimate == c["estimate"].boolean() &&
                      describeSite(c["site"].str()) == c["describe"].str();
    if (!same && ++mismatches <= 5)
      std::printf("  %s: C++ \"%s\" / \"%s\" vs JS \"%s\" / \"%s\"\n", c["site"].str(), r.text.c_str(),
                  describeSite(c["site"].str()).c_str(), c["text"].str(), c["describe"].str());
    CHECK(same);
  }
  Site s;
  CHECK(!parseSite("LPA", s) && !parseSite("Nz", s) && !parseSite("T7x", s));
  CHECK(parseSite("FTT7h", s) && s.kind == Kind::Row && s.f == 0.875 && s.ring == "FTT7" && s.mid == "FCCz");
  const Head typical = cleanHead(0, 0, 0);
  CHECK(typical.typical && typical.nasionInion == 36 && typical.earEar == 35 && typical.circumference == 56);
}

// Reference values for the web app's JavaScript engine port (webapp/test):
// a coarse pass over each whole preset (every 4985 ms) and a fine window of
// 300 samples 3.5 ms apart starting at 60 s.
static void dumpRow(std::FILE* out, const Session& s, const SessionRunner::Frame& f, bool first) {
  float v[kChannels];
  render(s, f, v);
  std::fprintf(out, "%s[%.1f,%d,%.5f", first ? "" : ",", f.programMs, f.phase, f.envelope);
  for (float x : v) std::fprintf(out, ",%.5f", x);
  std::fprintf(out, "]");
}

static int dumpReference(const char* dir, const char* outPath) {
  std::FILE* out = std::fopen(outPath, "w");
  if (!out) return 1;
  std::fprintf(out, "{\n");
  DIR* d = opendir(dir);
  bool first = true;
  while (dirent* e = readdir(d)) {
    const std::string name = e->d_name;
    if (name.size() < 6 || name.substr(name.size() - 5) != ".json") continue;
    mj::Value doc;
    mj::parse(readFile(std::string(dir) + "/" + name), doc);
    Session s;
    std::string err;
    if (!sessionFromJson(doc, s, nullptr, &err)) continue;
    std::fprintf(out, "%s\"%s\": {\"coarse\": [", first ? "" : ",\n", s.id);
    first = false;
    SessionRunner r;
    r.start(&s);
    for (int k = 0; r.running(); ++k) {
      const auto f = k == 0 ? r.frame() : r.advance(4985.0);
      if (f.running) dumpRow(out, s, f, k == 0);
    }
    std::fprintf(out, "], \"fine\": [");
    r.start(&s);
    auto f = r.advance(60000.0);
    for (int k = 0; k < 300 && f.running; ++k) {
      dumpRow(out, s, f, k == 0);
      f = r.advance(3.5);
    }
    std::fprintf(out, "]}");
  }
  closedir(d);
  std::fprintf(out, "\n}\n");
  std::fclose(out);
  return 0;
}

// The LED output test (control.cpp, test mode "leds"): AO1..AO8 in turn, 2 s
// each, + for 0.8 s then - for 0.8 s, nothing on the other outputs.
// Drives on all eight outputs at `when` (ms from the start); runner time only moves forward.
static void ledAt(const Session& s, SessionRunner& r, double& t, double when, float v[kChannels]) {
  const SessionRunner::Frame f = r.advance(when - t);
  t = when;
  render(s, f, v);
}

static void testLedChase() {
  std::printf("LED test (blink rates)\n");
  std::string err;
  // AO1..AO8 in turn at 1 Hz: each output 2 s = two blinks of + (250 ms), pause, - (250 ms), pause.
  {
    Session s;
    CHECK(ledTestSession(s, -1, 1.0f, 60, &err));
    CHECK(s.phaseCount == 1 && s.phases[0].durationMs == 60000);
    SessionRunner r;
    r.start(&s);
    float v[kChannels];
    double t = 0;
    for (int round = 0; round < 2; ++round) {
      for (int k = 0; k < 8; ++k) {
        for (int blink = 0; blink < 2; ++blink) {
          const double base = 16000.0 * round + 2000.0 * k + 1000.0 * blink;
          const double marks[4] = {125, 375, 625, 875};  // +, pause, -, pause
          for (int m = 0; m < 4; ++m) {
            if (base + marks[m] < 600) continue;  // fade-in
            ledAt(s, r, t, base + marks[m], v);
            for (int ch = 0; ch < kChannels; ++ch) {
              if (ch != k || m == 1 || m == 3) CHECK(v[ch] == 0.0f);
              else CHECK(m == 0 ? v[ch] > 0.99f : v[ch] < -0.99f);
            }
          }
        }
      }
    }
  }
  // One output, rising: 0.5, 1, 2, 5, 10 Hz, 8 s each; each step starts on its + pulse.
  {
    Session s;
    CHECK(ledTestSession(s, 2, 0.0f, 40, &err));
    CHECK(s.phaseCount == kLedRisingSteps);
    SessionRunner r;
    r.start(&s);
    float v[kChannels];
    double t = 0, start = 0;
    for (int i = 0; i < s.phaseCount; ++i) {
      CHECK(s.phases[i].durationMs == 8000);
      CHECK(std::string(s.phases[i].name).find(i == 0 ? "0.5 Hz" : i == 4 ? "10 Hz" : " Hz") != std::string::npos);
      const double q = 250.0 / kLedRisingHz[i];  // a quarter blink
      int flashes = 0;
      for (double at = start + q / 2; at < start + 8000 - 600; at += q) {  // clear of the fades
        if (at < 600) continue;
        ledAt(s, r, t, at, v);
        const int quarter = static_cast<int>((at - start) / q) % 4;
        CHECK(quarter == 0 ? v[2] > 0.99f : quarter == 2 ? v[2] < -0.99f : v[2] == 0.0f);
        if (quarter == 0) ++flashes;
        for (int ch = 0; ch < kChannels; ++ch) if (ch != 2) CHECK(v[ch] == 0.0f);
      }
      CHECK(flashes >= 8 * kLedRisingHz[i] * 0.85f - 1 && flashes <= 8 * kLedRisingHz[i] + 1);  // the rate changes
      start += 8000;
    }
  }
  // AO1..AO8 rising: each step is at least one whole round (8 x 2 s).
  {
    Session s;
    CHECK(ledTestSession(s, -1, 0.0f, 60, &err));
    CHECK(s.phaseCount == kLedRisingSteps);
    for (int i = 0; i < s.phaseCount; ++i) CHECK(s.phases[i].durationMs == 16000);
    CHECK(ledTestSession(s, -1, 0.0f, 80, &err) && s.phases[4].durationMs == 16000);
  }
  // A slow rate: one output per whole blink when that is longer than 2 s.
  {
    Session s;
    CHECK(ledTestSession(s, -1, 0.25f, 60, &err));
    CHECK(s.phases[0].spatial.dwellStartMs == 4000.0f);
  }
  Session s;
  CHECK(!ledTestSession(s, 8, 1.0f, 60, &err));
  CHECK(!ledTestSession(s, 0, 30.0f, 60, &err));
  CHECK(!ledTestSession(s, 0, -1.0f, 60, &err));
  CHECK(!ledTestSession(s, 0, 1.0f, 0, &err));
}

int main(int argc, char** argv) {
  if (argc == 4 && std::string(argv[1]) == "--dump") return dumpReference(argv[2], argv[3]);
  testAd5328Words();
  testDrive();
  testPatterns();
  testSpatial();
  testSession();
  testAstro();
  testJson();
  testBleFrame();
  testTableData();
  testCustomPlacement();
  testEngineV2();
  testLedChase();
  testPresets(argc > 1 ? argv[1] : "../presets");
  testTape(argc > 2 ? argv[2] : "test/tape/tape-reference.json");
  std::printf("\n%d checks, %d failures\n", g_checks, g_failures);
  return g_failures == 0 ? 0 : 1;
}
