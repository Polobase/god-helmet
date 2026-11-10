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
#include "conn.h"
#include "hold.h"
#include "ident.h"
#include "keepalive.h"
#include "outbox.h"
#include "progress.h"
#include "recover.h"
#include "start.h"
#include "ticks.h"
#include "wire.h"
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

  // Each dropped message is reported once, with its reason.
  CHECK(small.takeDrop() == bleframe::Drop::TooLarge);  // six packets, one report
  CHECK(small.takeDrop() == bleframe::Drop::None);
  bleframe::Reassembler lost(4096);
  CHECK(lost.takeDrop() == bleframe::Drop::None);
  for (size_t i = 1; i < packets.size(); ++i) lost.push(reinterpret_cast<const uint8_t*>(packets[i].data()), packets[i].size());
  CHECK(lost.takeDrop() == bleframe::Drop::NoStart);    // the start was lost: five packets, one report
  CHECK(lost.takeDrop() == bleframe::Drop::None);
  const auto other = bleframe::split(msg, 9, 182);
  lost.push(reinterpret_cast<const uint8_t*>(other[3].data()), other[3].size());
  CHECK(lost.takeDrop() == bleframe::Drop::NoStart);    // another message, also without its start
  CHECK(lost.push(reinterpret_cast<const uint8_t*>(one[0].data()), one[0].size()) && lost.takeDrop() == bleframe::Drop::None);

  // Given up half way (no memory): the rest of it is ignored without a second report.
  bleframe::Reassembler gone(4096);
  gone.push(reinterpret_cast<const uint8_t*>(packets[0].data()), packets[0].size());
  gone.push(reinterpret_cast<const uint8_t*>(packets[1].data()), packets[1].size());
  gone.abandon();
  bool completed = false;
  for (size_t i = 2; i < packets.size(); ++i) completed |= gone.push(reinterpret_cast<const uint8_t*>(packets[i].data()), packets[i].size());
  CHECK(!completed && gone.dropped() && gone.takeDrop() == bleframe::Drop::None);
  CHECK(gone.push(reinterpret_cast<const uint8_t*>(one[0].data()), one[0].size()) && gone.take() == "{}");
}

// ---------------------------------------------------------------- lib/link

static void testConn() {
  std::printf("link: connection state\n");
  using namespace hlink;
  Conn c;
  c.connected = true;
  c.subStatus = true;
  c.generation = 200;
  c.mtu = 185;
  const Conn back = unpack(pack(c));
  CHECK(back.connected && back.subStatus && !back.subResponse && !back.congested && back.generation == 200 && back.mtu == 185);

  uint32_t w = 0;
  CHECK(!unpack(w).connected && payloadSize(w) == 20);
  w = onConnect(w);
  CHECK(unpack(w).connected && unpack(w).generation == 1 && unpack(w).mtu == 23 && payloadSize(w) == 20);
  w = onMtu(w, 185);
  CHECK(payloadSize(w) == 182);
  w = onMtu(w, 515);
  CHECK(payloadSize(w) == 512);
  w = onMtu(w, 517);
  CHECK(payloadSize(w) == 512);  // never more than the stack's 512-byte buffer, whatever the link allows
  CHECK(unpack(onMtu(w, 9000)).mtu == 517 && unpack(onMtu(w, 5)).mtu == 23);
  w = onSubscribe(w, Channel::Status, 0x0001);
  CHECK(wantsStatus(w) && !unpack(w).subResponse);
  w = onSubscribe(w, Channel::Response, 0x0001);
  CHECK(unpack(w).subResponse);
  CHECK(!wantsStatus(onSubscribe(w, Channel::Status, 0x0000)));
  CHECK(!wantsStatus(onSubscribe(w, Channel::Status, 0x0002)));  // indications only: not what we send
  CHECK(unpack(onCongest(w, true)).congested && !unpack(onCongest(onCongest(w, true), false)).congested);
  CHECK(canReply(w, 1) && !canReply(w, 2));

  // A drop, then another app on the same id: nothing of the first one is left.
  const uint32_t gone = onDisconnect(w);
  CHECK(!unpack(gone).connected && !wantsStatus(gone) && !canReply(gone, 1));
  CHECK(onDisconnect(gone) == gone);  // a second disconnect event changes nothing
  const uint32_t again = onConnect(gone);
  CHECK(unpack(again).generation == 2 && !wantsStatus(again) && unpack(again).mtu == 23);
  CHECK(!canReply(again, 1) && canReply(again, 2));  // a reply for the first app is not sent to the second
  // Events for a slot that is not connected are ignored.
  CHECK(onMtu(gone, 200) == gone && onSubscribe(gone, Channel::Status, 1) == gone && onCongest(gone, true) == gone);
  // A request from a slot we thought gone brings it back (a missed connect event).
  CHECK(unpack(onTraffic(gone)).connected && onTraffic(again) == again);
  // The generation wraps.
  Conn last;
  last.generation = 255;
  CHECK(unpack(onConnect(pack(last))).generation == 0);

  // Two apps; one leaves; a stray disconnect for a free slot.
  uint32_t slots[kSlots] = {0, 0, 0, 0};
  slots[0] = onConnect(slots[0]);
  slots[1] = onSubscribe(onConnect(slots[1]), Channel::Status, 1);
  CHECK(connectedCount(slots) == 2 && statusSubscribers(slots) == 1);
  slots[0] = onDisconnect(slots[0]);
  slots[3] = onDisconnect(slots[3]);
  slots[0] = onDisconnect(slots[0]);
  CHECK(connectedCount(slots) == 1 && statusSubscribers(slots) == 1);
}

static void testOutbox() {
  std::printf("link: outbox\n");
  using hlink::Outbox;
  std::string msg;
  for (int i = 0; i < 500; ++i) msg += static_cast<char>('a' + i % 26);

  Outbox box;
  CHECK(box.empty() && box.next(0, 20) == nullptr);
  box.push("{}");
  const std::string* p = box.next(100, 182);
  CHECK(p != nullptr && p->size() == 4 && static_cast<uint8_t>((*p)[1]) == (bleframe::kFirst | bleframe::kLast));
  box.sent(100);
  CHECK(box.empty());

  // A long message at the smallest packet size: all of it arrives, paced.
  box.push(msg);
  bleframe::Reassembler r(4096);
  uint32_t now = 1000;
  int packets = 0;
  bool done = false;
  while (!box.empty() && packets < 100) {
    p = box.next(now, 20);
    if (p == nullptr) {
      ++now;
      continue;
    }
    if (packets > 0) CHECK(now - 1000 >= static_cast<uint32_t>(packets) * Outbox::kGapMs);
    done = r.push(reinterpret_cast<const uint8_t*>(p->data()), p->size());
    box.sent(now);
    ++packets;
  }
  CHECK(packets == 28 && done && r.take() == msg);  // 18 payload bytes per packet

  // Congested: the same packet again, later; nothing is skipped.
  box.push(msg);
  p = box.next(5000, 182);
  const std::string first = *p;
  box.congested(5000);
  CHECK(box.next(5000 + Outbox::kRetryMs - 1, 182) == nullptr);
  p = box.next(5000 + Outbox::kRetryMs, 182);
  CHECK(p != nullptr && *p == first);
  box.sent(5020);
  p = box.next(5020 + Outbox::kGapMs, 182);
  CHECK(p != nullptr && *p != first && !(static_cast<uint8_t>((*p)[1]) & bleframe::kFirst));

  // No progress for five seconds: the message is given up, the next one starts.
  box.push("{\"next\":1}");
  box.congested(5028);
  CHECK(box.next(5028 + Outbox::kStallMs + 100, 182) != nullptr);
  CHECK(box.size() == 1);
  box.clear();
  CHECK(box.empty());

  // Status: only the newest waits; one that has started is finished first.
  box.push("status-1", true);
  box.push("status-2", true);
  CHECK(box.size() == 1);
  p = box.next(9000, 182);
  CHECK(p != nullptr && p->substr(2) == "status-2");
  box.push("status-3", true);
  box.push("reply", false);
  box.push("status-4", true);
  CHECK(box.size() == 3);  // the started one, status-4 in status-3's place, the reply
  box.sent(9000);
  p = box.next(9008, 182);
  CHECK(p != nullptr && p->substr(2) == "status-4");
  // Each message has its own sequence number.
  const uint8_t seqA = static_cast<uint8_t>((*p)[0]);
  box.sent(9008);
  p = box.next(9016, 182);
  CHECK(p != nullptr && p->substr(2) == "reply" && static_cast<uint8_t>((*p)[0]) != seqA);
}

static void testWire() {
  std::printf("link: error replies\n");
  long long c = -1, id = -1;
  const char* req = "{\"c\":1234567,\"id\":42,\"op\":\"session.start\",\"session\":{\"id\":\"x\"}}";
  hlink::peekTag(req, std::strlen(req), c, id);
  CHECK(c == 1234567 && id == 42);
  hlink::peekTag(req, 16, c, id);  // a first packet that ends inside "id"
  CHECK(c == 1234567 && id == 0);
  hlink::peekTag("{\"c\": 7, \"id\": 8}", 18, c, id);
  CHECK(c == 7 && id == 8);
  hlink::peekTag("garbage without members", 23, c, id);
  CHECK(c == 0 && id == 0);
  hlink::peekTag("", 0, c, id);
  CHECK(c == 0 && id == 0);
  // "id" inside the program, far from the start, is not taken for the request's id.
  std::string late = "{\"op\":\"x\",\"pad\":\"" + std::string(120, 'p') + "\",\"id\":9}";
  hlink::peekTag(late.data(), late.size(), c, id);
  CHECK(id == 0);

  mj::Value v;
  CHECK(mj::parse(hlink::errorReply(1234567, 42, "busy: request dropped"), v));
  CHECK(v["c"].num(0) == 1234567 && v["id"].num(0) == 42 && !v["ok"].boolean(true));
  CHECK(std::string(v["error"].str("")) == "busy: request dropped");
  CHECK(mj::parse(hlink::errorReply(0, 0, "a \"quoted\" \\ text"), v));
  CHECK(std::string(v["error"].str("")) == "a \"quoted\" \\ text");
}

static void testKeepalive() {
  std::printf("link: keepalive\n");
  using namespace hlink;
  CHECK(clampKeepaliveS(0) == 0 && clampKeepaliveS(-5) == 0 && clampKeepaliveS(0.4) == 0);
  CHECK(clampKeepaliveS(std::nan("")) == 0);
  CHECK(clampKeepaliveS(1) == 5 && clampKeepaliveS(4.9) == 5 && clampKeepaliveS(5) == 5 && clampKeepaliveS(30) == 30);
  CHECK(clampKeepaliveS(3600) == 3600 && clampKeepaliveS(86400) == 3600 && clampKeepaliveS(4.3e9) == 3600);
  CHECK(!keepaliveExpired(1000000, 0, 0));           // off: never
  CHECK(!keepaliveExpired(10000, 0, 10));            // exactly ten seconds: not yet
  CHECK(keepaliveExpired(10001, 0, 10));
  CHECK(!keepaliveExpired(5, 0xFFFFFFF0u, 10));      // across the 49-day wrap of millis()
  CHECK(keepaliveExpired(10100, 0xFFFFFFF0u, 10));
  CHECK(!keepaliveExpired(3600000, 0, 3600) && keepaliveExpired(3600001, 0, 3600));  // no overflow at the maximum
}

// ---------------------------------------------------------------- lib/resume

static void testHold() {
  std::printf("resume: BOOT must be held\n");
  using resume::HoldDetector;
  // The pulse a USB port produces when it opens: a few ms, sampled every 0.5 ms.
  HoldDetector usb;
  bool fired = false;
  for (uint32_t us = 0; us < 5000; us += 500) fired |= usb.sample(true, us / 1000);
  for (uint32_t ms = 5; ms < 100; ++ms) fired |= usb.sample(false, ms);
  CHECK(!fired);
  HoldDetector almost;
  for (uint32_t ms = 0; ms <= 39; ++ms) fired |= almost.sample(true, ms);
  CHECK(!fired);
  CHECK(almost.sample(true, 40));    // 40 ms: a press
  int count = 1;
  for (uint32_t ms = 41; ms < 2000; ++ms) count += almost.sample(true, ms) ? 1 : 0;
  CHECK(count == 1);                 // held on: still one press
  almost.sample(false, 2000);
  for (uint32_t ms = 2001; ms < 2100; ++ms) count += almost.sample(true, ms) ? 1 : 0;
  CHECK(count == 2);                 // released and pressed again
  // A bounce starts the count again.
  HoldDetector bounce;
  for (uint32_t ms = 0; ms < 30; ++ms) fired |= bounce.sample(true, ms);
  fired |= bounce.sample(false, 30);
  for (uint32_t ms = 31; ms < 60; ++ms) fired |= bounce.sample(true, ms);
  CHECK(!fired);
  // Two samples far apart are not a hold (the task was held up in between).
  HoldDetector sparse;
  CHECK(!sparse.sample(true, 0) && !sparse.sample(true, 60));
  CHECK(sparse.sample(true, 61));
}

static void testTicks() {
  std::printf("resume: periods from the clock\n");
  uint64_t last = 1000;
  CHECK(resume::periodsSince(1000, last, 500) == 0 && last == 1000);
  CHECK(resume::periodsSince(1499, last, 500) == 0 && last == 1000);
  CHECK(resume::periodsSince(1500, last, 500) == 1 && last == 1500);
  CHECK(resume::periodsSince(2750, last, 500) == 2 && last == 2500);  // the half period is kept
  CHECK(resume::periodsSince(3000, last, 500) == 1 && last == 3000);
  CHECK(resume::periodsSince(53000, last, 500) == 100 && last == 53000);  // a 50 ms stall: 100 periods, none lost
  CHECK(resume::periodsSince(52000, last, 500) == 0 && last == 53000);    // a clock going back counts nothing
}

static void testStart() {
  std::printf("resume: repeated start\n");
  using namespace resume;
  CHECK(validToken("a") && validToken("Abc-123_xyz") && validToken("123456789012345678901234"));
  CHECK(!validToken("") && !validToken(nullptr) && !validToken("1234567890123456789012345"));
  CHECK(!validToken("with space") && !validToken("quote\"") && !validToken("\xc3\xa4"));
  CHECK(decideStart(false, "", "") == StartDecision::Start);
  CHECK(decideStart(false, "", "tok1") == StartDecision::Start);
  CHECK(decideStart(true, "tok1", "") == StartDecision::Busy);
  CHECK(decideStart(true, "tok1", "tok2") == StartDecision::Busy);
  CHECK(decideStart(true, "tok1", "tok1") == StartDecision::Already);   // the reply was lost: the same session again
  CHECK(decideStart(false, "tok1", "tok1") == StartDecision::Already);  // it has ended meanwhile: still not started twice
  CHECK(decideStart(false, "tok1", "tok2") == StartDecision::Start);
  CHECK(decideStart(true, "", "") == StartDecision::Busy);              // no token never matches "no token"
  CHECK(decideStart(false, nullptr, nullptr) == StartDecision::Start);
}

static void testIdent() {
  std::printf("resume: identity\n");
  char id[13];
  // ESP.getEfuseMac() for the MAC 24:6F:28:AB:CD:EF.
  resume::helmetId(0x0000EFCDAB286F24ull, id);
  CHECK(std::string(id) == "246F28ABCDEF");
  CHECK(std::string(id).substr(8) == "CDEF");  // the suffix of the default name GodHelmet-CDEF
  for (int r = 0; r <= static_cast<int>(resume::Reset::Unknown); ++r) {
    const char* name = resume::resetName(static_cast<resume::Reset>(r));
    CHECK(name != nullptr && std::strlen(name) > 0 && std::strlen(name) < 30);
  }
  CHECK(std::string(resume::resetName(resume::Reset::TaskWatchdog)) == "task watchdog");
}

static void testProgress() {
  std::printf("resume: progress record\n");
  using namespace resume;
  Progress slots[2];
  std::memset(slots, 0xFF, sizeof slots);  // RTC memory after power-on is arbitrary
  CHECK(!valid(slots[0]) && newest(slots) == -1);
  std::memset(slots, 0, sizeof slots);
  CHECK(!valid(slots[0]) && newest(slots) == -1);

  Progress p;
  p.bootId = 77;
  p.logId = 12;
  p.elapsedMs = 1000;
  p.state = static_cast<uint8_t>(RunState::Running);
  commit(slots, p);
  CHECK(newest(slots) == 0 && slots[0].generation == 1 && valid(slots[0]));
  p.elapsedMs = 1250;
  commit(slots, p);
  CHECK(newest(slots) == 1 && slots[1].elapsedMs == 1250 && slots[0].elapsedMs == 1000);
  p.elapsedMs = 1500;
  commit(slots, p);
  CHECK(newest(slots) == 0 && slots[0].elapsedMs == 1500 && slots[0].generation == 3);

  // Any flipped bit makes a copy invalid; the other one is then used.
  for (size_t bit = 0; bit < sizeof(Progress) * 8; bit += 7) {
    Progress damaged = slots[0];
    reinterpret_cast<uint8_t*>(&damaged)[bit / 8] ^= static_cast<uint8_t>(1u << (bit % 8));
    CHECK(!valid(damaged));
  }
  Progress half[2] = {slots[0], slots[1]};
  std::memset(&half[0], 0xA5, sizeof(Progress) / 2);  // a restart in the middle of writing copy 0
  CHECK(newest(half) == 1 && half[1].elapsedMs == 1250);
  // A copy from another layout version is not read.
  Progress old = slots[0];
  old.magic = kProgressMagic + 1;
  old.crc = crcOf(old);
  CHECK(!valid(old));
  // The counter wraps.
  Progress wrap[2];
  std::memset(wrap, 0, sizeof wrap);
  Progress w;
  w.state = static_cast<uint8_t>(RunState::Running);
  w.generation = 0xFFFFFFFEu;
  seal(w);
  wrap[0] = w;
  commit(wrap, w);
  CHECK(newest(wrap) == 1 && wrap[1].generation == 0xFFFFFFFFu);
  commit(wrap, w);
  CHECK(newest(wrap) == 0 && wrap[0].generation == 0);
  clear(slots);
  CHECK(newest(slots) == -1);
}

static void testRecover() {
  std::printf("resume: closing a session after a restart\n");
  using namespace resume;
  CHECK(!decide(nullptr, Reset::PowerOn).close);  // nothing survived: the open entries become "power lost"
  Progress p;
  p.logId = 12;
  p.elapsedMs = 61250;
  p.fieldUT = 1.5f;
  p.fieldChanges = 2;
  p.skips = 1;
  p.state = static_cast<uint8_t>(RunState::Running);
  Closure c = decide(&p, Reset::Panic);
  CHECK(c.close && c.logId == 12 && c.elapsedMs == 61250 && !c.completed);
  CHECK(std::string(c.reason) == "restart: panic" && c.fieldChanges == 2 && c.skips == 1);
  CHECK_NEAR(c.fieldUT, 1.5, 1e-6);
  CHECK(std::string(decide(&p, Reset::TaskWatchdog).reason) == "restart: task watchdog");
  for (int r = 0; r <= static_cast<int>(Reset::Unknown); ++r) {
    c = decide(&p, static_cast<Reset>(r));
    CHECK(c.close && std::strlen(c.reason) < sizeof c.reason && std::strncmp(c.reason, "restart: ", 9) == 0);
  }
  // The session had ended; only the write to the log was still to come.
  p.state = static_cast<uint8_t>(RunState::Ended);
  p.completed = 1;
  std::snprintf(p.reason, sizeof p.reason, "completed");
  c = decide(&p, Reset::Software);
  CHECK(c.close && c.completed && std::string(c.reason) == "completed");
  p.completed = 0;
  std::snprintf(p.reason, sizeof p.reason, "stopped from app");
  c = decide(&p, Reset::Brownout);
  CHECK(c.close && !c.completed && std::string(c.reason) == "stopped from app");
  // A test has no log entry; an empty record closes nothing.
  p.logId = 0;
  CHECK(!decide(&p, Reset::Panic).close);
  p.logId = 12;
  p.state = static_cast<uint8_t>(RunState::None);
  CHECK(!decide(&p, Reset::Panic).close);
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
  testConn();
  testOutbox();
  testWire();
  testKeepalive();
  testHold();
  testTicks();
  testStart();
  testIdent();
  testProgress();
  testRecover();
  testTableData();
  testCustomPlacement();
  testEngineV2();
  testLedChase();
  testPresets(argc > 1 ? argv[1] : "../presets");
  testTape(argc > 2 ? argv[2] : "test/tape/tape-reference.json");
  std::printf("\n%d checks, %d failures\n", g_checks, g_failures);
  return g_failures == 0 ? 0 : 1;
}
