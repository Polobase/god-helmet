#include "ui.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <memory>
#include <new>
#include <string>
#include <vector>

#include "../ble.h"
#include "../usblink.h"
#include "../config.h"
#include "../control.h"
#include "../envdata.h"
#include "../logbook.h"
#include "../sdcard.h"
#include "../sequencer.h"
#include "../settings.h"
#include "../timesync.h"
#include "display.h"
#include "minijson.h"
#include "pack.h"
#include "tape.h"
#include "widgets.h"

namespace ui {
namespace {

enum class Screen : uint8_t {
  Calibrate, Safety, Home, Categories, Programs, Program, Details, Coils, Start, Session, Rate, Log,
  Settings, Editor, Message, ModuleCheck, LedTest,
};

void go(Screen s);

Screen gScreen = Screen::Home;
String gClockStatus;
String gPanelName;
bool gFirstLoop = true;
int gShownMinute = -1;

// Program pack
int gPackPrograms = 0;
String gPackError;
std::vector<pack::Category> gCats;
int gCat = 0, gCatPage = 0;
std::vector<pack::Program> gProgs;
int gProgPage = 0;
pack::Program gProg;
std::string gText;                // t/NNN.txt of gProg
std::vector<std::string> gLines;  // wrapped text of the paged screens
int gLinePage = 0;

// Coil map and tape directions (loaded once)
std::vector<pack::SitePos> gSites;
engine::tape::Template gTape;
bool gCoilDataTried = false, gTapeOk = false;
int gCoil = 0;

// Start
std::unique_ptr<mj::Value> gDoc;
float gField = 1.0f;
float gProgramUT = 0;
int gPhases = 0;
bool gBlind = false;
bool gConfirmArmed = false;  // a warning is shown: the second tap within 5 s starts
uint32_t gConfirmAt = 0;

// Session
bool gSessUi = false, gSessTest = false;
bool gSessBlind = false;            // remembered: the sequencer clears it when the session ends
uint32_t gSessElapsedMs = 0, gSessTotalMs = 0;
bool gDrawnRunning = false;         // the session screen was drawn from a running snapshot
uint32_t gDrawnLogId = 0;           // ... of this session
uint32_t gSessLogId = 0;
String gSessName;
bool gDark = false, gSwallow = false;
uint32_t gSessWakeMs = 0, gTickMs = 0, gLevelsMs = 0, gKeepaliveMs = 0;
int gShownSec = -1, gShownPhase = -1;
float gShownField = -1;
seq::State gShownState = seq::State::Idle;
Screen gAfterTest = Screen::Editor;

// Rate
uint32_t gRateId = 0;
String gRateName, gRateInfo, gCondition;
bool gRateBlind = false, gRated = false;
int gRating = -1;
Screen gAfterRate = Screen::Home;

// Log
struct LogRow {
  uint32_t id = 0, start = 0, elapsedMs = 0, plannedMs = 0;
  String name, condition, reason;
  int rating = -1;
  bool blind = false, finished = false, completed = false;
  float fieldUT = 0;
};
std::vector<LogRow> gLog;
int gLogPage = 0, gLogTotal = 0;

int gSetPage = 0;
Screen gAfterCalibrate = Screen::Home;

// The AD5328 has no data-out pin, so the board cannot see whether it is
// connected: the user confirms it once per power-on before the first start.
bool gModuleConfirmed = false;
Screen gModuleBack = Screen::Settings;
int gModStep = 0, gModCh = 0;
int gLedCh = 0;
int gLedRate = 1;  // index into kLedRates: 1 Hz

// Number editor (head size, clock, brightness, limits, coil test)
struct Field {
  const char* label = "";
  float value = 0, min = 0, max = 0, step = 1;
  uint8_t decimals = 0;
  bool skipZero = false;
};
struct Editor {
  String title;
  Field f[5];
  int n = 0;
  String note;
  const char* actions[3] = {nullptr, nullptr, nullptr};
  void (*onAction)(int) = nullptr;
  void (*onChange)(int) = nullptr;
  Screen back = Screen::Settings;
};
Editor gEd;

struct Message {
  String title, body;
  const char* actions[2] = {nullptr, nullptr};
  void (*onAction)(int) = nullptr;
  Screen back = Screen::Home;
};
Message gMsg;

// Session screen geometry; in the dark the whole band below kStopZoneY is STOP.
constexpr int kStopY = 252;
constexpr int kStopZoneY = 236;
constexpr uint32_t kDarkAfterMs = 10000;

// ---------------------------------------------------------------- helpers

Lcd& lcd() { return display::lcd(); }

uint8_t dimLevel() { return static_cast<uint8_t>(std::min<int>(gSettings.backlight, 40)); }
// Backlight during a session (Settings > Screen in session): on, or dimmed.
uint8_t sessionLevel() { return gSettings.sessionScreen == 0 ? gSettings.backlight : dimLevel(); }
bool darkSessions() { return gSettings.sessionScreen == 2; }
const char* const kSessionScreenNames[] = {"on", "dimmed", "dark after 10 s"};
void lightNormal() {
  if (display::backlightLevel() != gSettings.backlight) display::backlight(gSettings.backlight);
}

int pageCount(int n, int per) { return n <= 0 ? 1 : (n + per - 1) / per; }

String minutesText(uint32_t s) {
  if (s < 60) return String(s) + " s";
  return String((s + 30) / 60) + " min";
}

String clockText(uint32_t s) {
  char buf[16];
  if (s >= 3600) std::snprintf(buf, sizeof buf, "%u:%02u:%02u", unsigned(s / 3600), unsigned(s / 60 % 60), unsigned(s % 60));
  else std::snprintf(buf, sizeof buf, "%u:%02u", unsigned(s / 60), unsigned(s % 60));
  return buf;
}

String ago(uint32_t s) {
  if (s < 3600) return String(s / 60) + " min";
  if (s < 48 * 3600) return String(s / 3600) + " h";
  return String(s / 86400) + " days";
}

String dateText(uint32_t epoch) {
  if (!epoch) return "no time";
  const time_t t = epoch;
  tm local{};
  localtime_r(&t, &local);
  char buf[20];
  strftime(buf, sizeof buf, "%d.%m. %H:%M", &local);
  return buf;
}

float round1(float v) { return std::round(v * 10.0f) / 10.0f; }

// Names from the sequencer and the log can be UTF-8 (programs sent by the app).
String ascii(const char* s) { return String(fold(s ? s : "").c_str()); }

float fieldCeiling() { return std::fmin(gSettings.maxFieldUT, control::maxReachableUT()); }

// Seconds since the last session, if it was less than 72 h ago.
bool recentSession(uint32_t& agoS) {
  if (!envdata::timeValid() || !gSettings.lastSessionEpoch) return false;
  const uint32_t now = envdata::now();
  if (now < gSettings.lastSessionEpoch) return false;
  agoS = now - gSettings.lastSessionEpoch;
  return agoS < limits::kMinIntervalS;
}

engine::tape::Head head() { return engine::tape::cleanHead(gSettings.headNI, gSettings.headLR, gSettings.headC); }

void message(const String& title, const String& body, Screen back, const char* a0 = nullptr,
             const char* a1 = nullptr, void (*onAction)(int) = nullptr) {
  gMsg = Message();
  gMsg.title = title;
  gMsg.body = body;
  gMsg.back = back;
  gMsg.actions[0] = a0;
  gMsg.actions[1] = a1;
  gMsg.onAction = onAction;
  go(Screen::Message);
}

void restartNow() {
  if (seq::busy()) return;
  display::backlight(0);
  delay(50);
  ESP.restart();
}

// Footer with one to three action buttons (ids 30..32), the first one primary.
void actionFooter(const char* const* labels, int n, int firstId = 30) {
  if (n <= 0) return;
  const int gap = 6, w = (kW - 2 * kMargin - gap * (n - 1)) / n;
  for (int i = 0; i < n; ++i)
    drawButton(addButton(kMargin + i * (w + gap), kFooterY, w, kFooterH, firstId + i, labels[i],
                         i == 0 ? Style::Primary : Style::Normal));
}

// Text pages (Safety, Details).
int linesPerPage(int y0, int y1) {
  fontSmall();
  return std::max(1, (y1 - y0) / lineHeight());
}

void drawLines(int y0, int y1) {
  fontSmall();
  const int lh = lineHeight(), per = linesPerPage(y0, y1);
  lcd().fillRect(0, y0, kW, y1 - y0, color::kBg);
  for (int i = 0; i < per; ++i) {
    const size_t k = static_cast<size_t>(gLinePage * per + i);
    if (k >= gLines.size()) break;
    text(gLines[k].c_str(), kMargin, y0 + i * lh, color::kText);
  }
}

// ---------------------------------------------------------------- program pack

void refreshPack() {
  if (!sdcard::mounted()) sdcard::begin();
  gPackPrograms = 0;
  gPackError = "no SD card";
  if (sdcard::mounted()) pack::check(gPackPrograms, gPackError);
  gCats.clear();
}

void openCategories();
void onRetrySd(int) {
  sdcard::remount();  // the card may have been swapped
  refreshPack();
  openCategories();
}

void openCategories() {
  if (gPackPrograms <= 0) refreshPack();
  if (!sdcard::mounted()) {
    message("No SD card",
            "Build the program pack on a computer (npm run sd-pack, see docs/STANDALONE.md), copy the godhelmet "
            "folder to a FAT32 microSD card, insert it and tap Retry.",
            Screen::Home, "Retry", nullptr, onRetrySd);
    return;
  }
  if (gPackPrograms <= 0) {
    message("No programs", gPackError, Screen::Home, "Retry", nullptr, onRetrySd);
    return;
  }
  String err;
  if (gCats.empty() && !pack::categories(gCats, err)) {
    message("SD card", err, Screen::Home);
    return;
  }
  go(Screen::Categories);
}

void loadCoilData() {
  if (gCoilDataTried) return;
  gCoilDataTried = true;
  String err;
  pack::sites(gSites, err);
  gTapeOk = pack::tapeTemplate(gTape, err);
}

// ---------------------------------------------------------------- calibration, safety

// Raw touch readings at the four corners, in LovyanGFX's calibrateTouch order,
// but it gives up after 30 s without a touch (or when a session starts from the
// app) and keeps Bluetooth served, so a dead touch panel cannot hang the board.
bool calibrateCorners(uint16_t cal[8]) {
  constexpr uint32_t kWaitMs = 30000;
  auto& d = lcd();
  lgfx::touch_point_t tp, tp2;
  // Waits while the panel reads `touched`; false on timeout or a session start.
  auto waitWhile = [&](bool touched) {
    const uint32_t t0 = millis();
    while ((d.getTouchRaw(&tp) > 0) == touched) {
      if (millis() - t0 > kWaitMs || seq::busy()) return false;
      ble::loop();
      usblink::loop();
      delay(5);
    }
    return true;
  };
  for (int i = 0; i < 4; ++i) {
    const int px = (kW - 1) * ((i >> 1) & 1), py = (kH - 1) * (i & 1);
    const int dx = px ? -1 : 1, dy = py ? -1 : 1;
    auto arrow = [&](uint16_t c) {
      d.fillTriangle(px, py, px + dx * 26, py + dy * 10, px + dx * 10, py + dy * 26, c);
      d.drawLine(px, py, px + dx * 34, py + dy * 34, c);
    };
    arrow(TFT_WHITE);
    bool ok = waitWhile(true);  // the finger from the last corner lifted
    delay(300);
    int32_t sx = 0, sy = 0;
    for (int n = 0; ok && n < 8;) {
      ok = waitWhile(false);
      if (!ok) break;
      delay(10);
      if (!d.getTouchRaw(&tp2) || std::abs(tp.x - tp2.x) > 20 || std::abs(tp.y - tp2.y) > 20) continue;
      sx += tp.x + tp2.x;
      sy += tp.y + tp2.y;
      ++n;
    }
    arrow(color::kBg);
    if (!ok) return false;
    cal[i * 2] = static_cast<uint16_t>(sx >> 4);
    cal[i * 2 + 1] = static_cast<uint16_t>(sy >> 4);
  }
  waitWhile(true);
  return true;
}

void runCalibration() {
  clear();
  display::backlight(gSettings.backlight);
  fontBold();
  text("Touch calibration", kW / 2, 110, color::kText, textdatum_t::top_center);
  fontSmall();
  drawWrapped("Touch the tip of each arrow as it appears, with a fingernail or a stylus. Nothing for 30 s: "
              "cancelled.",
              30, 140, kW - 60, color::kMuted, 230);
  uint16_t cal[8];
  if (calibrateCorners(cal) && !seq::busy()) {
    lcd().setTouchCalibrate(cal);
    memcpy(gSettings.touchCal, cal, sizeof cal);
    gSettings.save();
  }
  go(gAfterCalibrate);
}

const char* const kSafetyText =
    "This is an experimental, non-medical device. The fields are a few microtesla, about a million times weaker "
    "than TMS. Double-blind studies found little evidence that such fields cause any experience; expectation and "
    "setting explain most reports. Blind mode lets you test it yourself.\n\n"
    "Do not use it if you:\n"
    "- have epilepsy, a seizure history, or a close relative with epilepsy;\n"
    "- have a psychiatric condition, or take medication that lowers the seizure threshold;\n"
    "- have implanted electronics (pacemaker, cochlear implant, neurostimulator), are pregnant, or had a recent "
    "head injury;\n"
    "- have taken alcohol or drugs.\n\n"
    "Rules:\n"
    "- Power bank only while the helmet is worn, never mains or a PC.\n"
    "- Power the board first and wait for this screen before you put the helmet on. Never flash or reset the "
    "board with the helmet on: until the firmware runs, the coil outputs can sit at full drive.\n"
    "- Sit or lie down. No driving for an hour afterwards.\n"
    "- Stop at once on fear, headache, nausea or anything unusual: the red STOP button, or the BOOT button on "
    "the board. With the screen dark, its bottom quarter is STOP.\n"
    "- At most one session per 72 hours.\n"
    "- Never run the coils without the 2.2 kOhm series resistors.\n"
    "- No other stimulation devices during a session.";

constexpr int kSafetyTextBottom = 224;

void drawSafety() {
  clear();
  header("Safety", gSettings.safetyAccepted);
  fontSmall();
  gLines = wrap(kSafetyText, kW - 2 * kMargin);
  const int pages = pageCount(gLines.size(), linesPerPage(kTop, kSafetyTextBottom));
  gLinePage = std::min(gLinePage, pages - 1);
  drawLines(kTop, kSafetyTextBottom);
  pager(gLinePage, pages, kSafetyTextBottom + 2);
  if (!gSettings.safetyAccepted) {
    const bool last = gLinePage + 1 >= pages;
    drawButton(addButton(kMargin, kFooterY, kW - 2 * kMargin, kFooterH, 1, last ? "I accept the risks" : "Read on",
                         last ? Style::Primary : Style::Normal));
  }
}

void onSafety(uint8_t id) {
  const int pages = pageCount(gLines.size(), linesPerPage(kTop, kSafetyTextBottom));
  if (id == kIdBack) {
    go(Screen::Settings);
  } else if (id == kIdPrev && gLinePage > 0) {
    --gLinePage;
    drawSafety();
  } else if ((id == kIdNext || id == 1) && gLinePage + 1 < pages) {
    ++gLinePage;
    drawSafety();
  } else if (id == 1) {
    gSettings.safetyAccepted = true;
    gSettings.save();
    go(Screen::Home);
  }
}

// ---------------------------------------------------------------- home

void statusRow(int& y, const char* label, const String& value, uint16_t c) {
  fontSmall();
  text(label, kMargin, y, color::kMuted);
  text(fit(value, kW - 104 - kMargin), 104, y, c);
  y += 19;
}

void drawHome() {
  clear();
  header("God Helmet", false);
  int y = kTop + 4;
  if (!sdcard::mounted()) statusRow(y, "Programs", "no SD card", color::kWarn);
  else if (gPackPrograms > 0) statusRow(y, "Programs", String(gPackPrograms) + " on the card", color::kText);
  else statusRow(y, "Programs", "no program pack", color::kWarn);
  statusRow(y, "Clock", envdata::timeValid() ? timesync::localString(envdata::now()) : String("not set"),
            envdata::timeValid() ? color::kText : color::kWarn);
  uint32_t a = 0;
  if (!gSettings.lastSessionEpoch) statusRow(y, "Last session", "none yet", color::kText);
  else if (recentSession(a)) statusRow(y, "Last session", ago(a) + " ago: wait 72 h", color::kWarn);
  else if (envdata::timeValid() && envdata::now() >= gSettings.lastSessionEpoch)
    statusRow(y, "Last session", ago(envdata::now() - gSettings.lastSessionEpoch) + " ago", color::kText);
  else statusRow(y, "Last session", timesync::localString(gSettings.lastSessionEpoch), color::kText);
  statusRow(y, "Module", gModuleConfirmed ? "confirmed" : "not checked yet",
            gModuleConfirmed ? color::kText : color::kWarn);
  statusRow(y, "Bluetooth",
            gSettings.bleEnabled ? String(ble::connections() > 0 ? "on, app connected" : "on") : String("off"),
            color::kText);
  y += 4;
  const String hint = envdata::timeValid()
                          ? String("Sit or lie down in a dark, quiet room. STOP: the red button on the screen or "
                                   "the BOOT button on the board.")
                          : "Clock not set (" + gClockStatus +
                                "). Set it in Settings > Clock for the log times and the 72-hour check.";
  fontSmall();
  drawWrapped(hint.c_str(), kMargin, y, kW - 2 * kMargin, color::kMuted, 200);
  drawButton(addButton(kMargin, 204, kW - 2 * kMargin, 60, 1, "Programs", Style::Primary));
  drawButton(addButton(kMargin, kFooterY, 108, kFooterH, 2, "Log"));
  drawButton(addButton(kW - kMargin - 108, kFooterY, 108, kFooterH, 3, "Settings"));
}

void onHome(uint8_t id) {
  if (id == 1) openCategories();
  else if (id == 2) {
    gLogPage = 0;
    go(Screen::Log);
  } else if (id == 3) {
    gSetPage = 0;
    go(Screen::Settings);
  }
}

// ---------------------------------------------------------------- library

constexpr int kCatRows = 6, kCatRowH = 39;
constexpr int kProgRows = 4, kProgRowH = 58;

void drawCategories() {
  clear();
  header("Programs", true);
  const int n = gCats.size();
  for (int i = 0; i < kCatRows; ++i) {
    const int k = gCatPage * kCatRows + i;
    if (k >= n) break;
    Button& b = addButton(0, kTop - 4 + i * kCatRowH, kW, kCatRowH, i, gCats[k].label.c_str(), Style::Row);
    std::snprintf(b.sub, sizeof b.sub, "%d", gCats[k].count);
    drawButton(b);
  }
  pager(gCatPage, pageCount(n, kCatRows));
}

void onCategories(uint8_t id) {
  const int pages = pageCount(gCats.size(), kCatRows);
  if (id == kIdBack) go(Screen::Home);
  else if (id == kIdPrev && gCatPage > 0) {
    --gCatPage;
    drawCategories();
  } else if (id == kIdNext && gCatPage + 1 < pages) {
    ++gCatPage;
    drawCategories();
  } else if (id < kCatRows) {
    const int k = gCatPage * kCatRows + id;
    if (k >= static_cast<int>(gCats.size())) return;
    String err;
    if (!pack::programs(gCats[k].key, gProgs, err)) {
      message("SD card", err, Screen::Categories);
      return;
    }
    gCat = k;
    gProgPage = 0;
    go(Screen::Programs);
  }
}

String programMeta(const pack::Program& p) {
  String s = minutesText(p.seconds) + " - " + String(p.coils) + (p.coils == 1 ? " coil" : " coils");
  if (p.evidence.length()) s += " - " + p.evidence;
  return s;
}

void drawPrograms() {
  clear();
  header(gCat < static_cast<int>(gCats.size()) ? gCats[gCat].label : String("Programs"), true);
  const int n = gProgs.size();
  for (int i = 0; i < kProgRows; ++i) {
    const int k = gProgPage * kProgRows + i;
    if (k >= n) break;
    Button& b = addButton(0, kTop - 4 + i * kProgRowH, kW, kProgRowH, i, gProgs[k].name.c_str(), Style::Row);
    strlcpy(b.sub, programMeta(gProgs[k]).c_str(), sizeof b.sub);
    drawButton(b);
  }
  pager(gProgPage, pageCount(n, kProgRows));
}

void openProgram(const pack::Program& p) {
  gProg = p;
  String err;
  try {
    if (!sdcard::readFile(pack::textPath(p.num), gText, 16 * 1024, err)) gText = std::string(p.name.c_str());
  } catch (const std::bad_alloc&) {
    gText = std::string(p.name.c_str());
  }
  go(Screen::Program);
}

void onPrograms(uint8_t id) {
  const int pages = pageCount(gProgs.size(), kProgRows);
  if (id == kIdBack) go(Screen::Categories);
  else if (id == kIdPrev && gProgPage > 0) {
    --gProgPage;
    drawPrograms();
  } else if (id == kIdNext && gProgPage + 1 < pages) {
    ++gProgPage;
    drawPrograms();
  } else if (id < kProgRows) {
    const int k = gProgPage * kProgRows + id;
    if (k < static_cast<int>(gProgs.size())) openProgram(gProgs[k]);
  }
}

void drawProgram() {
  clear();
  header("Program", true);
  int y = kTop;
  fontBold();
  y = drawWrapped(gProg.name.c_str(), kMargin, y, kW - 2 * kMargin, color::kText, y + 3 * lineHeight());
  fontSmall();
  y += 2;
  text(fit(programMeta(gProg), kW - 2 * kMargin), kMargin, y, color::kMuted);
  y += lineHeight();
  y = drawWrapped(("Coils: " + gProg.placement).c_str(), kMargin, y, kW - 2 * kMargin, color::kMuted,
                  y + 2 * lineHeight());
  y += 4;
  // Preview: the text after the title line (evidence, summary).
  const size_t nl = gText.find('\n');
  if (nl != std::string::npos) drawWrapped(gText.substr(nl + 1, 700), kMargin, y, kW - 2 * kMargin, color::kText, 216);
  drawButton(addButton(kMargin, 222, 108, 42, 1, "Coils"));
  drawButton(addButton(kW - kMargin - 108, 222, 108, 42, 2, "Details"));
  drawButton(addButton(kMargin, kFooterY, kW - 2 * kMargin, kFooterH, 3, "Start...", Style::Primary));
}

void openStart();
void onProgram(uint8_t id) {
  if (id == kIdBack) go(Screen::Programs);
  else if (id == 1) {
    loadCoilData();
    gCoil = 0;
    while (gCoil < 7 && gProg.sites[gCoil].isEmpty()) ++gCoil;
    go(Screen::Coils);
  } else if (id == 2) {
    gLinePage = 0;
    go(Screen::Details);
  } else if (id == 3) {
    openStart();
  }
}

constexpr int kDetailsBottom = kFooterY - 4;

void drawDetails() {
  clear();
  header("Details", true);
  fontSmall();
  try {
    gLines = wrap(gText, kW - 2 * kMargin);
  } catch (const std::bad_alloc&) {
    gLines.assign(1, "Not enough memory to show the text.");
  }
  const int pages = pageCount(gLines.size(), linesPerPage(kTop, kDetailsBottom));
  gLinePage = std::min(gLinePage, pages - 1);
  drawLines(kTop, kDetailsBottom);
  pager(gLinePage, pages);
}

void onDetails(uint8_t id) {
  const int pages = pageCount(gLines.size(), linesPerPage(kTop, kDetailsBottom));
  if (id == kIdBack) go(Screen::Program);
  else if (id == kIdPrev && gLinePage > 0) {
    --gLinePage;
    drawLines(kTop, kDetailsBottom);
    pager(gLinePage, pages);
  } else if (id == kIdNext && gLinePage + 1 < pages) {
    ++gLinePage;
    drawLines(kTop, kDetailsBottom);
    pager(gLinePage, pages);
  }
}

// ---------------------------------------------------------------- coils

constexpr int kMapCx = 120, kMapCy = 88, kMapR = 38, kMapBottom = 146;

const pack::SitePos* sitePos(const String& name) {
  for (const auto& s : gSites)
    if (name == s.name) return &s;
  return nullptr;
}

int coilCount() {
  int n = 0;
  for (const String& s : gProg.sites) n += s.length() > 0;
  return n;
}

int coilOrdinal(int ch) {
  int n = 0;
  for (int i = 0; i <= ch && i < 8; ++i) n += gProg.sites[i].length() > 0;
  return n;
}

void drawMap() {
  auto& d = lcd();
  d.fillRect(56, kHeaderH, kW - 112, kMapBottom - kHeaderH, color::kBg);
  d.fillRect(0, kHeaderH, 56, 34, color::kBg);
  d.fillRect(0, 112, 56, kMapBottom - 112, color::kBg);
  d.fillRect(kW - 56, kHeaderH, 56, 34, color::kBg);
  d.fillRect(kW - 56, 112, 56, kMapBottom - 112, color::kBg);
  const int outline = kMapR * 13 / 10;
  d.drawCircle(kMapCx, kMapCy, outline, color::kMuted);
  d.drawTriangle(kMapCx - 7, kMapCy - outline + 1, kMapCx + 7, kMapCy - outline + 1, kMapCx, kMapCy - outline - 7,
                 color::kMuted);
  d.drawRoundRect(kMapCx - outline - 5, kMapCy - 9, 6, 18, 3, color::kMuted);
  d.drawRoundRect(kMapCx + outline - 1, kMapCy - 9, 6, 18, 3, color::kMuted);
  d.drawCircle(kMapCx, kMapCy, kMapR, color::kLine);
  fontSmall();
  text("L", kMapCx - outline - 4, kMapCy - 22, color::kMuted, textdatum_t::middle_center);
  text("R", kMapCx + outline + 4, kMapCy - 22, color::kMuted, textdatum_t::middle_center);
  const engine::tape::Head h = head();
  text(h.typical ? "typical head" : "your head", kMargin, kMapBottom - 16, h.typical ? color::kWarn : color::kMuted);
  text("from above", kW - kMargin, kMapBottom - 16, color::kMuted, textdatum_t::top_right);
  for (const auto& s : gSites)
    if (s.tenTen) d.fillCircle(kMapCx + std::lround(s.x * kMapR), kMapCy + std::lround(s.y * kMapR), 1, color::kLine);
  d.setFont(&fonts::Font0);
  for (int pass = 0; pass < 2; ++pass) {  // the selected coil last, on top
    for (int ch = 0; ch < 8; ++ch) {
      const bool sel = ch == gCoil;
      if (sel != (pass == 1)) continue;
      const pack::SitePos* p = sitePos(gProg.sites[ch]);
      if (!p) continue;
      const int x = kMapCx + std::lround(p->x * kMapR), y = kMapCy + std::lround(p->y * kMapR);
      d.fillCircle(x, y, sel ? 9 : 7, sel ? color::kAccentHi : color::kAccent);
      text(String(ch + 1), x + 1, y + 1, sel ? TFT_BLACK : TFT_WHITE, textdatum_t::middle_center);
    }
  }
}

void drawCoilInfo() {
  lcd().fillRect(0, kMapBottom, kW, kH - kMapBottom, color::kBg);
  const String& site = gProg.sites[gCoil];
  int y = kMapBottom + 4;
  const int bottom = kH - 4, w = kW - 2 * kMargin;
  fontBold();
  text("CH" + String(gCoil + 1) + "  " + site, kMargin, y, color::kText);
  fontSmall();
  text(String(coilOrdinal(gCoil)) + " of " + String(coilCount()), kW - kMargin, y + 2, color::kMuted,
       textdatum_t::top_right);
  y += 22;
  engine::tape::Recipe r;
  const bool ok = gTapeOk && engine::tape::recipe(gTape, site.c_str(), head(), r);
  if (ok) y = drawWrapped(fold(r.text), kMargin, y, w, color::kText, bottom);
  y = drawWrapped(fold(engine::tape::describeSite(site.c_str())), kMargin, y + 3, w, color::kMuted, bottom);
  if (ok) drawWrapped(fold(r.detail), kMargin, y + 3, w, color::kMuted, bottom);
  else if (!gTapeOk) drawWrapped("No tape.json on the card: positions only.", kMargin, y + 3, w, color::kWarn, bottom);
}

void drawCoils() {
  clear();
  header("Coils", true);
  if (coilCount() == 0) {
    fontSmall();
    drawWrapped("This program has no coil sites.", kMargin, kTop, kW - 2 * kMargin, color::kMuted, kFooterY);
    return;
  }
  addButton(56, kHeaderH, kW - 112, kMapBottom - kHeaderH, 3, "", Style::Normal, kNoDraw);
  drawMap();
  drawButton(addButton(4, 64, 48, 48, 1, "", Style::Normal, kRepeat, Icon::Left));
  drawButton(addButton(kW - 52, 64, 48, 48, 2, "", Style::Normal, kRepeat, Icon::Right));
  drawCoilInfo();
}

void selectCoil(int ch) {
  gCoil = ch;
  drawMap();
  drawCoilInfo();
}

void onCoils(uint8_t id, int16_t x, int16_t y) {
  if (id == kIdBack) {
    go(Screen::Program);
  } else if (id == 1 || id == 2) {
    for (int step = 1; step <= 8; ++step) {
      const int ch = (gCoil + (id == 2 ? step : 8 - step)) % 8;
      if (gProg.sites[ch].length()) {
        selectCoil(ch);
        return;
      }
    }
  } else if (id == 3) {  // tap on the map: nearest coil
    int best = -1;
    long bestD = 18 * 18;
    for (int ch = 0; ch < 8; ++ch) {
      const pack::SitePos* p = sitePos(gProg.sites[ch]);
      if (!p) continue;
      const long dx = kMapCx + std::lround(p->x * kMapR) - x, dy = kMapCy + std::lround(p->y * kMapR) - y;
      if (dx * dx + dy * dy < bestD) {
        bestD = dx * dx + dy * dy;
        best = ch;
      }
    }
    if (best >= 0 && best != gCoil) selectCoil(best);
  }
}

// ---------------------------------------------------------------- start

// Loads the selected program into gDoc; false with a message for the user.
bool loadProgram(String& err) {
  std::string json;
  try {
    if (!sdcard::readFile(pack::programPath(gProg.num), json, 48 * 1024, err)) return false;
    std::unique_ptr<mj::Value> doc(new mj::Value());
    std::string perr;
    if (!mj::parse(json, *doc, &perr)) {
      err = ("program file unreadable: " + perr).c_str();
      return false;
    }
    gDoc = std::move(doc);
  } catch (const std::bad_alloc&) {
    gDoc.reset();
    err = "not enough memory to load this program";
    return false;
  }
  return true;
}

void openStart() {
  String err;
  if (!loadProgram(err)) {
    message("Start", err, Screen::Program);
    return;
  }
  gProgramUT = static_cast<float>((*gDoc)["uT"].num(0));
  gPhases = (*gDoc)["phases"].size();
  gField = std::max(0.1f, round1(std::fmin(control::clampField(gProgramUT), fieldCeiling())));
  gBlind = false;
  go(Screen::Start);
}

String startWarning() {
  uint32_t a = 0;
  if (!envdata::timeValid()) return "Clock not set: no 72-hour check and no time in the log.";
  if (recentSession(a)) return "Last session " + ago(a) + " ago; at least 72 h between sessions is advised.";
  return "";
}

void drawStartField() {
  lcd().fillRect(110, 96, 72, 44, color::kBg);
  fontBody();
  text(String(gField, 1) + " uT", 146, 118, color::kText, textdatum_t::middle_center);
}

void drawStart() {
  gConfirmArmed = false;
  clear();
  header("Start", true);
  int y = kTop;
  fontBold();
  y = drawWrapped(gProg.name.c_str(), kMargin, y, kW - 2 * kMargin, color::kText, y + 2 * lineHeight());
  fontSmall();
  text(minutesText(gProg.seconds) + " - " + String(gPhases) + (gPhases == 1 ? " phase" : " phases") + " - " +
           String(gProg.coils) + " coils",
       kMargin, y, color::kMuted);
  text("Field", kMargin, 118, color::kMuted, textdatum_t::middle_left);
  drawButton(addButton(58, 96, 48, 44, 1, "", Style::Normal, kRepeat, Icon::Minus));
  drawButton(addButton(184, 96, 48, 44, 2, "", Style::Normal, kRepeat, Icon::Plus));
  drawStartField();
  fontSmall();
  text("program " + String(gProgramUT > 0 ? gProgramUT : gSettings.defaultFieldUT, 1) + " uT - max " +
           String(fieldCeiling(), 1) + " uT",
       kMargin, 144, color::kMuted);
  drawButton(addButton(kMargin, 164, kW - 2 * kMargin, 40, 3, gBlind ? "Blind: on" : "Blind: off",
                       gBlind ? Style::Selected : Style::Normal));
  fontSmall();
  const int ny = drawWrapped(gBlind ? "Real or sham drawn at random, revealed when you rate."
                                    : "Blind: real or sham at random, revealed when you rate.",
                             kMargin, 208, kW - 2 * kMargin, color::kMuted, 238);
  const String warn = startWarning();
  drawWrapped(warn.length()       ? warn.c_str()
              : darkSessions() ? "The screen goes dark after 10 s: touch the top to see it, the bottom is STOP."
                               : "STOP: the red button on the screen or the BOOT button on the board.",
              kMargin, ny + 2, kW - 2 * kMargin, warn.length() ? color::kWarn : color::kMuted, 270);
  drawButton(addButton(kMargin, kFooterY, kW - 2 * kMargin, kFooterH, 4, "Start", Style::Primary));
}

void beginSessionScreen(bool fromUi, bool test, uint32_t logId, const String& name);

void onModuleGate(int a) {
  if (a == 0) {
    gModuleConfirmed = true;
    go(gMsg.back);
  } else {
    gModuleBack = gMsg.back;
    gModStep = 0;
    go(Screen::ModuleCheck);
  }
}

// True when the module was confirmed since power-on; otherwise asks and returns false.
bool moduleGate(Screen back) {
  if (gModuleConfirmed) return true;
  message("AD5328 module",
          "The board cannot detect the module, so confirm it once after each power-on:\n"
          "- module LED on (5 V connected)\n"
          "- GND from the expansion header to the module\n"
          "- CLK, DIN and SYNC on the SPI header, LDAC to 3.3V\n"
          "- reference jumper on 1-2\n"
          "- coils on AO1 to AO8 through 2.2 kOhm\n\n"
          "Not sure? Check it step by step with a multimeter.",
          back, "Connected", "Check it", onModuleGate);
  return false;
}

void startProgram() {
  String err;
  if (!gDoc && !loadProgram(err)) {  // freed during a module test: load it again
    message("Not started", err, Screen::Program);
    return;
  }
  control::Result r;
  try {
    r = control::startFromDoc(*gDoc, gProg.id, gField, gBlind);
  } catch (const std::bad_alloc&) {
    r.ok = false;
    r.error = "not enough memory for this program";
  }
  gDoc.reset();
  if (!r.ok) {
    message("Not started", r.error, Screen::Program);
    return;
  }
  beginSessionScreen(true, false, r.logId, gProg.name);
}

void onStart(uint8_t id) {
  if (id == kIdBack) {
    go(Screen::Program);
  } else if (id == 1 || id == 2) {
    const float v = round1(gField + (id == 1 ? -0.1f : 0.1f));
    gField = std::max(0.1f, std::fmin(v, round1(fieldCeiling())));
    drawStartField();
  } else if (id == 3) {
    gBlind = !gBlind;
    drawStart();
  } else if (id == 4) {
    if (!moduleGate(Screen::Start)) return;
    if (startWarning().length() && !(gConfirmArmed && millis() - gConfirmAt < 5000)) {
      gConfirmArmed = true;
      gConfirmAt = millis();
      setButton(4, "Tap again to start", Style::Warn);
      return;
    }
    startProgram();
  }
}

void tickStart() {
  if (gConfirmArmed && millis() - gConfirmAt >= 5000) {
    gConfirmArmed = false;
    setButton(4, "Start", Style::Primary);
  }
}

// ---------------------------------------------------------------- session

void beginSessionScreen(bool fromUi, bool test, uint32_t logId, const String& name) {
  gSessUi = fromUi;
  gSessTest = test;
  gSessLogId = logId;
  gSessName = name;
  gSessBlind = seq::status().blind;
  gSessElapsedMs = gSessTotalMs = 0;
  gDark = false;
  gSwallow = false;
  gSessWakeMs = millis();
  display::backlight(sessionLevel());
  go(Screen::Session);
}

void tickSession(bool force);

void drawSession() {
  clear();
  const seq::Status st = seq::status();
  header(st.sessionName[0] ? ascii(st.sessionName) : gSessName, false);
  gShownSec = gShownPhase = -1;
  gShownField = -1;
  gDrawnRunning = st.state != seq::State::Idle;
  gDrawnLogId = st.logId;
  if (!st.test) {
    drawButton(addButton(kMargin, 166, 56, 40, 1, "", Style::Normal, kRepeat, Icon::Minus));
    drawButton(addButton(kW - kMargin - 56, 166, 56, 40, 2, "", Style::Normal, kRepeat, Icon::Plus));
    if (st.phaseCount > 1) drawButton(addButton(kMargin, 212, kW - 2 * kMargin, 34, 3, "Skip phase"));
  }
  drawButton(addButton(kMargin, kStopY, kW - 2 * kMargin, kH - kStopY - 4, 4, "STOP", Style::Danger, kOnPress));
  if (st.blind) {
    fontSmall();
    text("Blind: real or sham stays hidden", kW / 2, 150, color::kMuted, textdatum_t::middle_center);
  }
  tickSession(true);
}

void openRate(uint32_t id, const String& name, const String& info, bool blind, Screen after);

// `st` is the status after the end: idle, blind and test cleared, the stop reason set.
void endSession(const seq::Status& st) {
  gDark = false;
  display::backlight(sessionLevel());
  if (gSessTest && gSessUi) {
    lightNormal();
    go(gAfterTest);
  } else if (gSessUi && gSessLogId) {
    const String info = std::string(st.lastStopReason) == "completed"
                            ? "Completed (" + minutesText(gSessTotalMs / 1000) + ")"
                            : "Stopped after " + minutesText(gSessElapsedMs / 1000) + ": " + ascii(st.lastStopReason);
    openRate(gSessLogId, st.sessionName[0] ? ascii(st.sessionName) : gSessName, info, gSessBlind, Screen::Home);
  } else {
    go(Screen::Home);
  }
}

void tickSession(bool force) {
  if (!seq::busy()) {
    endSession(seq::status());
    return;
  }
  const seq::Status st = seq::status();
  if (st.state != seq::State::Idle) {
    if (gDrawnRunning && st.logId != gDrawnLogId) {
      // The app replaced the session between two ticks: show the new one (the
      // old one can still be rated in the Log).
      gSessUi = false;
      gSessTest = st.test;
      gSessName = "";
      gDrawnRunning = false;
    }
    if (!gSessUi) gSessLogId = st.logId;
    gSessBlind = st.blind;
    gSessElapsedMs = st.elapsedMs;
    gSessTotalMs = st.totalMs;
  }
  if (gDark) return;
  if (st.state != seq::State::Idle && !gDrawnRunning) {  // drawn before the sequencer had started it
    drawSession();
    return;
  }
  auto& d = lcd();
  const bool stopping = st.state == seq::State::Stopping;
  const uint32_t remainMs = st.totalMs > st.programMs ? st.totalMs - st.programMs : 0;
  const int sec = (remainMs + 999) / 1000;
  if (force || sec != gShownSec || st.state != gShownState) {
    gShownSec = sec;
    d.fillRect(0, 64, kW, 62, color::kBg);
    fontBig();
    text(clockText(sec), kW / 2, 88, stopping ? color::kWarn : color::kText, textdatum_t::middle_center);
    fontSmall();
    text(stopping ? String("stopping") : "left of " + clockText(st.totalMs / 1000), kW / 2, 118, color::kMuted,
         textdatum_t::middle_center);
    d.fillRect(kMargin, 130, kW - 2 * kMargin, 5, color::kPanel);
    if (st.totalMs)
      d.fillRect(kMargin, 130, (kW - 2 * kMargin) * std::min<uint32_t>(st.programMs, st.totalMs) / st.totalMs, 5,
                 color::kAccent);
  }
  if (force || st.phase != gShownPhase || st.state != gShownState) {
    gShownPhase = st.phase;
    gShownState = st.state;
    d.fillRect(0, kTop - 2, kW, 24, color::kBg);
    fontSmall();
    String ph = ascii(st.phaseName);
    if (st.phaseCount > 1) ph = "Phase " + String(st.phase + 1) + " of " + String(st.phaseCount) + ": " + ph;
    text(fit(ph, kW - 2 * kMargin), kW / 2, kTop + 8, color::kMuted, textdatum_t::middle_center);
  }
  const uint32_t now = millis();
  if (!st.blind && (force || now - gLevelsMs > 200)) {
    gLevelsMs = now;
    for (int ch = 0; ch < 8; ++ch) {
      const int x = 12 + ch * 28, h = std::lround(std::fmin(1.0f, st.levels[ch]) * 18);
      d.fillRect(x, 140, 20, 18 - h, color::kPanel);
      d.fillRect(x, 158 - h, 20, h, color::kAccent);
    }
  }
  if (st.test) {
    if (force) {
      fontBody();
      text("Test: " + String(st.testMA, 2) + " mA", kW / 2, 186, color::kText, textdatum_t::middle_center);
    }
  } else if (force || std::fabs(st.fieldUT - gShownField) > 0.001f) {
    gShownField = st.fieldUT;
    d.fillRect(70, 166, 100, 40, color::kBg);
    fontBody();
    text(String(st.fieldUT, 1) + " uT", kW / 2, 186, color::kText, textdatum_t::middle_center);
  }
}

void stopNow() {
  seq::emergencyStop("STOP on screen");
  gDark = false;
  display::backlight(sessionLevel());
}

void onSession(uint8_t id) {
  const seq::Status st = seq::status();
  if (id == 4) {
    stopNow();
  } else if (id == 1 || id == 2) {
    const float v = round1(st.fieldUT + (id == 1 ? -0.1f : 0.1f));
    seq::setField(std::max(0.1f, std::fmin(v, round1(fieldCeiling()))));
  } else if (id == 3) {
    seq::skipPhase();
  }
}

// ---------------------------------------------------------------- rate

void openRate(uint32_t id, const String& name, const String& info, bool blind, Screen after) {
  gRateId = id;
  gRateName = name;
  gRateInfo = info;
  gRateBlind = blind;
  gRating = -1;
  gRated = false;
  gCondition = "";
  gAfterRate = after;
  go(Screen::Rate);
}

void drawRateButtons() {
  for (int r = 0; r <= 10; ++r) {
    const bool row1 = r <= 5;
    const int x = row1 ? kMargin + r * 38 : kMargin + (r - 6) * 46;
    Button& b = addButton(x, row1 ? 160 : 210, row1 ? 34 : 41, 44, 10 + r, String(r).c_str(),
                          r == gRating ? Style::Selected : Style::Normal);
    drawButton(b);
  }
}

void drawRate() {
  clear();
  header("Rate the session", false);
  int y = kTop;
  fontBold();
  y = drawWrapped(gRateName.c_str(), kMargin, y, kW - 2 * kMargin, color::kText, y + 2 * lineHeight());
  fontSmall();
  if (gRateInfo.length()) {
    text(fit(gRateInfo, kW - 2 * kMargin), kMargin, y, color::kMuted);
    y += lineHeight();
  }
  if (!gRated) {
    drawWrapped("How strong was the experience? 0 = nothing, 10 = profound. Rate before you look anything up.",
                kMargin, y + 4, kW - 2 * kMargin, color::kText, 156);
    drawRateButtons();
    drawButton(addButton(kMargin, kFooterY, 100, kFooterH, 1, "Later", Style::Ghost));
    drawButton(addButton(kW - kMargin - 116, kFooterY, 116, kFooterH, 2, "Save",
                         gRating >= 0 ? Style::Primary : Style::Ghost));
    return;
  }
  y += 12;
  fontBody();
  text("Saved: " + String(gRating) + " / 10", kMargin, y, color::kText);
  y += 34;
  if (gRateBlind) {
    fontSmall();
    text("This blind session was:", kMargin, y, color::kMuted);
    y += 20;
    lcd().setFont(&fonts::DejaVu24);
    const bool sham = gCondition == "sham";
    text(sham ? "Sham: no field" : "Real field", kMargin, y, sham ? color::kWarn : color::kAccentHi);
  }
  drawButton(addButton(kMargin, kFooterY, kW - 2 * kMargin, kFooterH, 3, "Done", Style::Primary));
}

void onRate(uint8_t id) {
  if (id >= 10 && id <= 20 && !gRated) {
    gRating = id - 10;
    drawRateButtons();
    setButton(2, "Save", Style::Primary);
  } else if (id == 1 || id == 3) {
    go(gAfterRate);
  } else if (id == 2 && gRating >= 0 && !gRated) {
    String json, err;
    if (!control::rate(gRateId, gRating, "", json, err)) {
      message("Rating not saved", err, gAfterRate);
      return;
    }
    mj::Value v;
    if (mj::parse(json.c_str(), json.length(), v)) gCondition = v["condition"].str("");
    gRated = true;
    drawRate();
  }
}

// ---------------------------------------------------------------- log

constexpr int kLogRows = 4, kLogRowH = 58;

void loadLog() {
  gLog.clear();
  mj::Writer w;
  w.beginObject();
  logbook::writeList(w, gLogPage * kLogRows, kLogRows);
  w.endObject();
  mj::Value v;
  if (!mj::parse(w.str(), v)) return;
  gLogTotal = static_cast<int>(v["total"].num(0));
  const mj::Value& items = v["items"];
  for (size_t i = 0; i < items.size(); ++i) {
    const mj::Value& e = items[i];
    LogRow r;
    r.id = static_cast<uint32_t>(e["id"].num(0));
    r.start = static_cast<uint32_t>(e["start"].num(0));
    r.elapsedMs = static_cast<uint32_t>(e["elapsedMs"].num(0));
    r.plannedMs = static_cast<uint32_t>(e["plannedMs"].num(0));
    r.name = ascii(e["presetName"].str(""));
    if (r.name.isEmpty()) r.name = ascii(e["presetId"].str("session"));
    r.condition = e["condition"].str("");
    r.reason = ascii(e["reason"].str(""));
    r.rating = static_cast<int>(e["rating"].num(-1));
    r.blind = e["blind"].boolean(false);
    r.finished = e["finished"].boolean(false);
    r.completed = e["completed"].boolean(false);
    r.fieldUT = static_cast<float>(e["fieldUT"].num(0));
    gLog.push_back(r);
  }
}

String ranText(const LogRow& r) {
  if (!r.finished) return "interrupted";
  if (r.completed) return minutesText(r.plannedMs / 1000);
  return String(r.elapsedMs / 60000) + "/" + minutesText(r.plannedMs / 1000);
}

void drawLog() {
  clear();
  header("Log", true);
  loadLog();
  const int pages = pageCount(gLogTotal, kLogRows);
  if (gLogPage >= pages && gLogPage > 0) {
    gLogPage = pages - 1;
    loadLog();
  }
  if (gLog.empty()) {
    fontSmall();
    text("No sessions yet.", kMargin, kTop + 8, color::kMuted);
  }
  for (size_t i = 0; i < gLog.size(); ++i) {
    const LogRow& r = gLog[i];
    Button& b = addButton(0, kTop - 4 + i * kLogRowH, kW, kLogRowH, i, r.name.c_str(), Style::Row);
    // Rating first: the line is cut at the right edge.
    String sub = (r.rating >= 0 ? String(r.rating) + "/10" : String("rate it")) + " - " + dateText(r.start) + " - " +
                 ranText(r);
    if (r.blind) sub += " - blind";
    strlcpy(b.sub, sub.c_str(), sizeof b.sub);
    drawButton(b);
  }
  pager(gLogPage, pages);
}

void onLog(uint8_t id) {
  const int pages = pageCount(gLogTotal, kLogRows);
  if (id == kIdBack) go(Screen::Home);
  else if (id == kIdPrev && gLogPage > 0) {
    --gLogPage;
    drawLog();
  } else if (id == kIdNext && gLogPage + 1 < pages) {
    ++gLogPage;
    drawLog();
  } else if (id < gLog.size()) {
    const LogRow& r = gLog[id];
    if (r.rating < 0) {
      openRate(r.id, r.name, dateText(r.start) + " - " + ranText(r), r.blind, Screen::Log);
      return;
    }
    String body = r.name + "\n\nStarted: " + (r.start ? timesync::localString(r.start) : String("no time")) + "\n";
    body += "Ran: " + String(r.elapsedMs / 60000) + " of " + minutesText(r.plannedMs / 1000) + (r.completed ? " (completed)" : r.reason.length() ? " (" + r.reason + ")" : "") + "\n";
    body += "Field: " + String(r.fieldUT, 1) + " uT\n";
    if (r.blind) body += "Blind: it was " + String(r.condition == "sham" ? "sham (no field)" : "a real field") + "\n";
    body += "Rating: " + String(r.rating) + " / 10";
    message(r.name, body, Screen::Log);
  }
}

// ---------------------------------------------------------------- editor

int fieldY(int i) { return kTop + i * 44; }

void drawFieldValue(int i) {
  const Field& f = gEd.f[i];
  lcd().fillRect(146, fieldY(i), 48, 36, color::kBg);
  fontBody();
  text(String(f.value, static_cast<unsigned>(f.decimals)), 170, fieldY(i) + 18, color::kText,
       textdatum_t::middle_center);
}

void drawEditorNote() {
  const int y = fieldY(gEd.n) + 2;
  lcd().fillRect(0, y, kW, kFooterY - y, color::kBg);
  if (!gEd.note.length()) return;
  fontSmall();
  drawWrapped(gEd.note.c_str(), kMargin, y, kW - 2 * kMargin, color::kMuted, kFooterY - 2);
}

void drawEditor() {
  clear();
  header(gEd.title, true);
  for (int i = 0; i < gEd.n; ++i) {
    fontSmall();
    const int lines = std::min<int>(2, wrap(gEd.f[i].label, 94).size());
    drawWrapped(gEd.f[i].label, kMargin, fieldY(i) + 18 - lines * lineHeight() / 2, 94, color::kMuted,
                fieldY(i) + 36);
    drawButton(addButton(104, fieldY(i), 40, 36, 10 + 2 * i, "", Style::Normal, kRepeat, Icon::Minus));
    drawButton(addButton(196, fieldY(i), 40, 36, 11 + 2 * i, "", Style::Normal, kRepeat, Icon::Plus));
    drawFieldValue(i);
  }
  drawEditorNote();
  int n = 0;
  while (n < 3 && gEd.actions[n]) ++n;
  actionFooter(gEd.actions, n);
}

void onEditor(uint8_t id) {
  if (id == kIdBack) {
    go(gEd.back);
  } else if (id >= 10 && id < 10 + 2 * gEd.n) {
    const int i = (id - 10) / 2;
    Field& f = gEd.f[i];
    const float dir = (id - 10) % 2 ? 1.0f : -1.0f;
    const float scale = std::pow(10.0f, f.decimals);
    float v = std::round((f.value + dir * f.step) * scale) / scale;
    if (f.skipZero && std::fabs(v) < f.step / 2) v = dir * f.step;
    f.value = std::max(f.min, std::min(f.max, v));
    drawFieldValue(i);
    if (gEd.onChange) gEd.onChange(i);
  } else if (id >= 30 && id < 33 && gEd.onAction) {
    gEd.onAction(id - 30);
  }
}

void openEditor() {
  gEd.back = Screen::Settings;
  go(Screen::Editor);
}

// Head size
void headAction(int a) {
  if (a == 0) {
    gSettings.headNI = gEd.f[0].value;
    gSettings.headLR = gEd.f[1].value;
    gSettings.headC = gEd.f[2].value;
  } else {
    gSettings.headNI = gSettings.headLR = gSettings.headC = 0;
  }
  gSettings.save();
  go(Screen::Settings);
}

void openHead() {
  const engine::tape::Head h = head();
  gEd = Editor();
  gEd.title = "Head size (cm)";
  gEd.n = 3;
  gEd.f[0] = {"Nasion to inion", static_cast<float>(h.nasionInion), 25, 45, 0.5f, 1};
  gEd.f[1] = {"Ear to ear", static_cast<float>(h.earEar), 25, 45, 0.5f, 1};
  gEd.f[2] = {"Band line round", static_cast<float>(h.circumference), 40, 70, 0.5f, 1};
  gEd.note = String(h.typical ? "Typical values until you save.\n" : "") +
             "Over the crown: nose dent to the bump at the back, and tragus to tragus. Band line: round the "
             "head through Fpz, above the ears and Oz.";
  gEd.actions[0] = "Save";
  gEd.actions[1] = "Typical";
  gEd.onAction = headAction;
  openEditor();
}

// Clock
int daysInMonth(int year, int month) {
  static const uint8_t kDays[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  const bool leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
  return month == 2 && leap ? 29 : kDays[(month - 1) % 12];
}

void clockAction(int) {
  if (std::lround(gEd.f[2].value) > daysInMonth(std::lround(gEd.f[0].value), std::lround(gEd.f[1].value)) ||
      !timesync::setLocal(std::lround(gEd.f[0].value), std::lround(gEd.f[1].value), std::lround(gEd.f[2].value),
                          std::lround(gEd.f[3].value), std::lround(gEd.f[4].value))) {
    gEd.note = "That date does not exist.";
    drawEditorNote();
    return;
  }
  gClockStatus = "set on the screen";
  go(Screen::Settings);
}

void openClock() {
  uint32_t epoch = envdata::timeValid() ? envdata::now() : gSettings.lastSessionEpoch;
  tm local{};
  if (epoch) {
    const time_t t = epoch;
    localtime_r(&t, &local);
  } else {  // the firmware's build date ("Nov  2 2026")
    static const char kMonths[] = "JanFebMarAprMayJunJulAugSepOctNovDec";
    const char* d = __DATE__;
    const char* m = std::strstr(kMonths, std::string(d, 3).c_str());
    local.tm_mon = m ? static_cast<int>(m - kMonths) / 3 : 0;
    local.tm_mday = std::atoi(d + 4);
    local.tm_year = std::atoi(d + 7) - 1900;
    local.tm_hour = 12;
  }
  gEd = Editor();
  gEd.title = "Clock";
  gEd.n = 5;
  gEd.f[0] = {"Year", static_cast<float>(local.tm_year + 1900), 2024, 2099, 1, 0};
  gEd.f[1] = {"Month", static_cast<float>(local.tm_mon + 1), 1, 12, 1, 0};
  gEd.f[2] = {"Day", static_cast<float>(local.tm_mday), 1, 31, 1, 0};
  gEd.f[3] = {"Hour", static_cast<float>(local.tm_hour), 0, 23, 1, 0};
  gEd.f[4] = {"Minute", static_cast<float>(local.tm_min), 0, 59, 1, 0};
  gEd.actions[0] = "Set clock";
  gEd.onAction = clockAction;
  openEditor();
}

// Brightness
void brightnessChange(int) { display::backlight(static_cast<uint8_t>(gEd.f[0].value)); }
void brightnessAction(int) {
  gSettings.backlight = static_cast<uint8_t>(gEd.f[0].value);
  gSettings.save();
  go(Screen::Settings);
}

void openBrightness() {
  gEd = Editor();
  gEd.title = "Brightness";
  gEd.n = 1;
  gEd.f[0] = {"Screen", static_cast<float>(gSettings.backlight), 10, 255, 5, 0};
  gEd.note = "During a session the screen follows Settings > Screen in session: on at this brightness, "
             "dimmed, or dark after 10 s.";
  gEd.actions[0] = "Save";
  gEd.onAction = brightnessAction;
  gEd.onChange = brightnessChange;
  openEditor();
}

// Field limits
void limitsAction(int) {
  gSettings.maxFieldUT = gEd.f[0].value;
  gSettings.defaultFieldUT = std::min(gEd.f[1].value, gEd.f[0].value);
  gSettings.save();
  go(Screen::Settings);
}

void openLimits() {
  gEd = Editor();
  gEd.title = "Field limits";
  gEd.n = 2;
  gEd.f[0] = {"Max (uT)", gSettings.maxFieldUT, 0.1f, limits::kMaxFieldUT, 0.1f, 1};
  gEd.f[1] = {"Default (uT)", gSettings.defaultFieldUT, 0.1f, limits::kMaxFieldUT, 0.1f, 1};
  gEd.note = "Peak field 20 mm from the coil face. With the current calibration the weakest coil reaches " +
             String(control::maxReachableUT(), 1) + " uT. Programs without their own field use the default.";
  gEd.actions[0] = "Save";
  gEd.onAction = limitsAction;
  openEditor();
}

// Coil test and calibration
void coilChange(int i) {
  if (i != 0) return;
  gEd.f[3].value = gSettings.uTperMA[std::lround(gEd.f[0].value) - 1];
  drawFieldValue(3);
}

void coilAction(int a) {
  const int ch = std::lround(gEd.f[0].value) - 1;
  if (a == 2) {
    gSettings.uTperMA[ch] = gEd.f[3].value;
    gSettings.calibrated = true;
    gSettings.save();
    gEd.note = "Saved: CH" + String(ch + 1) + " " + String(gEd.f[3].value, 2) + " uT per mA.";
    drawEditorNote();
    return;
  }
  if (!moduleGate(Screen::Editor)) return;
  control::TestRequest t;
  t.mode = a == 0 ? "dc" : "rotate";
  t.channel = ch;
  t.mA = gEd.f[1].value;
  t.seconds = static_cast<uint32_t>(gEd.f[2].value);
  const control::Result r = control::startTest(t);
  if (!r.ok) {
    gEd.note = "Not started: " + r.error;
    drawEditorNote();
    return;
  }
  gAfterTest = Screen::Editor;
  beginSessionScreen(true, true, 0, a == 0 ? "DC test" : "Rotation test");
}

void openCoilTest() {
  gEd = Editor();
  gEd.title = "Coil test";
  gEd.n = 4;
  gEd.f[0] = {"Coil (CH)", 1, 1, 8, 1, 0};
  gEd.f[1] = {"Current mA", 1.0f, -4.5f, 4.5f, 0.1f, 1, true};
  gEd.f[2] = {"Seconds", 30, 5, static_cast<float>(limits::kMaxTestSeconds), 5, 0};
  gEd.f[3] = {"uT per mA", gSettings.uTperMA[0], 0.1f, 20, 0.05f, 2};
  gEd.note = "DC: one coil, steady current. Measure 20 mm from the coil face, divide by mA, Save. Rotate: "
             "every coil in turn (wiring check).";
  gEd.actions[0] = "DC test";
  gEd.actions[1] = "Rotate";
  gEd.actions[2] = "Save";
  gEd.onAction = coilAction;
  gEd.onChange = coilChange;
  openEditor();
}

// ---------------------------------------------------------------- module check

// DC test current that puts 5 V on a module output (with or without a coil).
float fiveVoltMA() { return 5000.0f / (gSettings.drive.seriesOhm + gSettings.drive.coilOhm); }

const char* const kModuleSteps[] = {
    "Step 1 of 3: power and wiring\n"
    "Module LED1 is on. Multimeter on DC volts, black probe on a GND screw of the module, red probe on the "
    "test pads:\n"
    "5V: about 5 V\n"
    "12V: about +12 V\n"
    "-12V: about -12 V\n"
    "VREF: 2.50 V (0 V: reference jumper not on 1-2)\n"
    "Wires: CLK to IO18, DIN to IO23, SYNC to IO27, LDAC to 3.3V, GND to the expansion header.",
    "Step 2 of 3: outputs at rest\n"
    "The board holds every output at 0 V now. Measure AO1 to AO8 against GND: each within 0.05 V of 0 V.\n\n"
    "All near -10 V or +10 V: the module has power but gets no data. Check CLK, DIN, SYNC and GND, then "
    "restart the board.\n\n"
    "All 0 V with LED1 off: the module has no power.",
    "Step 3 of 3: each output\n"
    "Tap +5 V: the output reads about +5 V against GND for 60 s (-5 V: -5 V). STOP ends it early. Opposite "
    "sign on every output: the module inverts. 0 V: check that output.",
};
void drawModuleCheck() {
  clear();
  header("Module check", true);
  fontSmall();
  drawWrapped(kModuleSteps[gModStep], kMargin, kTop, kW - 2 * kMargin, color::kText,
              gModStep == 2 ? 168 : kFooterY - 4);
  if (gModStep == 2) {
    drawButton(addButton(kMargin, 172, 56, 40, 1, "", Style::Normal, 0, Icon::Left));
    drawButton(addButton(kW - kMargin - 56, 172, 56, 40, 2, "", Style::Normal, 0, Icon::Right));
    fontBold();
    text("AO" + String(gModCh + 1), kW / 2, 192, color::kText, textdatum_t::middle_center);
    drawButton(addButton(kMargin, 222, 108, 42, 3, "+5 V"));
    drawButton(addButton(kW - kMargin - 108, 222, 108, 42, 4, "-5 V"));
  }
  if (gModStep > 0) drawButton(addButton(kMargin, kFooterY, 108, kFooterH, 31, "Previous"));
  if (gModStep < 2) drawButton(addButton(kW - kMargin - 108, kFooterY, 108, kFooterH, 30, "Next", Style::Primary));
  else drawButton(addButton(kW - kMargin - 108, kFooterY, 108, kFooterH, 32, "Module OK", Style::Primary));
}

void onModuleCheck(uint8_t id) {
  if (id == kIdBack) {
    go(gModuleBack);
  } else if (id == 30 && gModStep < 2) {
    ++gModStep;
    drawModuleCheck();
  } else if (id == 31 && gModStep > 0) {
    --gModStep;
    drawModuleCheck();
  } else if (id == 32) {
    gModuleConfirmed = true;
    go(gModuleBack);
  } else if (id == 1 || id == 2) {
    gModCh = (gModCh + (id == 2 ? 1 : 7)) % 8;
    drawModuleCheck();
  } else if (id == 3 || id == 4) {
    control::TestRequest t;
    t.mode = "dc";
    t.channel = gModCh;
    t.mA = id == 3 ? fiveVoltMA() : -fiveVoltMA();
    t.seconds = 60;
    const control::Result r = control::startTest(t);
    if (!r.ok) {
      message("Not started", r.error, Screen::ModuleCheck);
      return;
    }
    gAfterTest = Screen::ModuleCheck;
    beginSessionScreen(true, true, 0, "AO" + String(gModCh + 1) + (id == 3 ? " +5 V" : " -5 V"));
  }
}

// ---------------------------------------------------------------- LED test

constexpr float kLedTestMA = 4.0f;  // about 3 mA through a red LED behind the 2.2 kOhm resistor
// Blink rates to pick from; 0 = rising, 0.5 to 10 Hz in one run.
constexpr float kLedRates[] = {0.5f, 1.0f, 2.0f, 5.0f, 10.0f, 0.0f};
constexpr int kLedRateCount = sizeof kLedRates / sizeof kLedRates[0];

String ledRateName(float hz) {
  if (hz == 0.0f) return "0.5 to 10 Hz";
  char buf[16];
  std::snprintf(buf, sizeof buf, "%g Hz", hz);
  return buf;
}

void drawLedTest() {
  clear();
  header("LED test", true);
  fontSmall();
  drawWrapped("Two LEDs where a coil goes, one each way round, from the 2.2 kOhm resistor to GND.",
              kMargin, kTop, kW - 2 * kMargin, color::kText, 88);
  drawButton(addButton(kMargin, 92, 48, 36, 1, "", Style::Normal, 0, Icon::Left));
  drawButton(addButton(kW - kMargin - 48, 92, 48, 36, 2, "", Style::Normal, 0, Icon::Right));
  drawButton(addButton(kMargin, 134, 48, 36, 5, "", Style::Normal, 0, Icon::Left));
  drawButton(addButton(kW - kMargin - 48, 134, 48, 36, 6, "", Style::Normal, 0, Icon::Right));
  fontBold();
  text("AO" + String(gLedCh + 1), kW / 2, 110, color::kText, textdatum_t::middle_center);
  text(ledRateName(kLedRates[gLedRate]), kW / 2, 152, color::kAccent, textdatum_t::middle_center);
  drawButton(addButton(kMargin, 178, 108, 44, 3, "This output", Style::Primary));
  drawButton(addButton(kW - kMargin - 108, 178, 108, 44, 4, "All in turn"));
  fontSmall();
  drawWrapped(kLedRates[gLedRate] == 0.0f
                  ? "Flashes at 0.5, 1, 2, 5, then 10 Hz. "
                    "One LED on +, the other on -. An LED that stays lit, even with no test running: "
                    "the module gets no data (Module check)."
                  : "Each LED flashes at this rate, one on +, the other on -. An LED that stays lit, even "
                    "with no test running: the module gets no data (Module check).",
              kMargin, 228, kW - 2 * kMargin, color::kMuted, kH - 2);
}

void onLedTest(uint8_t id) {
  if (id == kIdBack) {
    go(Screen::Settings);
  } else if (id == 1 || id == 2) {
    gLedCh = (gLedCh + (id == 2 ? 1 : 7)) % 8;
    drawLedTest();
  } else if (id == 5 || id == 6) {
    gLedRate = (gLedRate + (id == 6 ? 1 : kLedRateCount - 1)) % kLedRateCount;
    drawLedTest();
  } else if (id == 3 || id == 4) {
    const float hz = kLedRates[gLedRate];
    control::TestRequest t;
    t.mode = id == 3 ? "led" : "leds";
    t.channel = gLedCh;
    t.mA = kLedTestMA;
    t.blinkHz = hz;
    // Rising: five steps, 8 s on one output or one 16 s round of AO1..AO8 each.
    t.seconds = hz != 0.0f ? 60 : id == 3 ? 40 : 80;
    const control::Result r = control::startTest(t);
    if (!r.ok) {
      message("Not started", r.error, Screen::LedTest);
      return;
    }
    gAfterTest = Screen::LedTest;
    beginSessionScreen(true, true, 0, id == 3 ? "LED test AO" + String(gLedCh + 1) : String("LED test"));
  }
}

// ---------------------------------------------------------------- settings

const char* const kPanelNames[] = {"auto", "ILI9341", "ST7789", "ST7789, not inverted"};

void onBleToggle(int) {
  gSettings.bleEnabled = !gSettings.bleEnabled;
  gSettings.save();
  restartNow();
}

void onPanel(int) {
  gSettings.panel = (gSettings.panel + 1) % 4;
  gSettings.save();
  restartNow();
}

String aboutText() {
  String s = "Firmware " + String(kFirmwareVersion) + "\n" + BOARD_NAME + ", display " + gPanelName + "\n";
  s += "SD: " + sdcard::describe() + "\n";
  s += "Programs: " + String(gPackPrograms) + "\n";
  s += "Clock: " + (envdata::timeValid() ? timesync::localString(envdata::now()) : String("not set")) + " (" +
       gClockStatus + ")\n";
  s += "Module: " + String(gModuleConfirmed ? "confirmed" : "not checked since power-on") + "\n";
  s += "Bluetooth: " + String(gSettings.bleEnabled ? "on" : "off") + "\n";
  s += "Calibrated: " + String(gSettings.calibrated ? "yes" : "no (default 1.8 uT/mA)") + "\n";
  s += "Free memory: " + String(ESP.getFreeHeap() / 1024) + " KB\n";
  s += "Uptime: " + ago(millis() / 1000);
  return s;
}

constexpr int kSetRows = 7, kSetRowH = 33, kSetItems = 13;

void settingItem(int i, String& label, String& value) {
  switch (i) {
    case 0: {
      const engine::tape::Head h = head();
      label = "Head size";
      value = h.typical ? "typical" : String(h.nasionInion, 1) + "/" + String(h.earEar, 1) + "/" + String(h.circumference, 1);
      break;
    }
    case 1: {
      label = "Clock";
      if (envdata::timeValid()) {
        const time_t t = envdata::now();
        tm local{};
        localtime_r(&t, &local);
        char buf[8];
        strftime(buf, sizeof buf, "%H:%M", &local);
        value = buf;
      } else {
        value = "not set";
      }
      break;
    }
    case 2: label = "Brightness"; value = String(gSettings.backlight); break;
    case 3: label = "Screen in session"; value = kSessionScreenNames[gSettings.sessionScreen % 3]; break;
    case 4: label = "Field limits"; value = "max " + String(gSettings.maxFieldUT, 1) + " uT"; break;
    case 5: label = "Module check"; value = gModuleConfirmed ? "confirmed" : "not checked"; break;
    case 6: label = "LED test"; value = "outputs"; break;
    case 7: label = "Coil test"; value = gSettings.calibrated ? "calibrated" : "not calibrated"; break;
    case 8: label = "Bluetooth"; value = gSettings.bleEnabled ? "on" : "off"; break;
    case 9: label = "Touch calibration"; value = ""; break;
    case 10: label = "Display"; value = kPanelNames[gSettings.panel % 4]; break;
    case 11: label = "Safety page"; value = ""; break;
    default: label = "About"; value = kFirmwareVersion; break;
  }
}

void drawSettings() {
  clear();
  header("Settings", true);
  for (int r = 0; r < kSetRows; ++r) {
    const int i = gSetPage * kSetRows + r;
    if (i >= kSetItems) break;
    String label, value;
    settingItem(i, label, value);
    Button& b = addButton(0, kTop - 4 + r * kSetRowH, kW, kSetRowH, r, label.c_str(), Style::Row);
    strlcpy(b.sub, value.c_str(), sizeof b.sub);
    drawButton(b);
  }
  pager(gSetPage, pageCount(kSetItems, kSetRows));
}

void onSettings(uint8_t id) {
  const int pages = pageCount(kSetItems, kSetRows);
  if (id == kIdBack) {
    go(Screen::Home);
    return;
  }
  if (id == kIdPrev && gSetPage > 0) {
    --gSetPage;
    drawSettings();
    return;
  }
  if (id == kIdNext && gSetPage + 1 < pages) {
    ++gSetPage;
    drawSettings();
    return;
  }
  if (id >= kSetRows) return;
  switch (gSetPage * kSetRows + id) {
    case 0: openHead(); break;
    case 1: openClock(); break;
    case 2: openBrightness(); break;
    case 3:  // on -> dimmed -> dark after 10 s
      gSettings.sessionScreen = (gSettings.sessionScreen + 1) % 3;
      gSettings.save();
      drawSettings();
      break;
    case 4: openLimits(); break;
    case 5:
      gModuleBack = Screen::Settings;
      gModStep = 0;
      go(Screen::ModuleCheck);
      break;
    case 6: go(Screen::LedTest); break;
    case 7: openCoilTest(); break;
    case 8:
      message("Bluetooth",
              String(gSettings.bleEnabled ? "Bluetooth is on: the web app can connect. "
                                          : "Bluetooth is off. Turn it on to use the web app as well. ") +
                  "Changing it restarts the controller (take the helmet off first).",
              Screen::Settings, gSettings.bleEnabled ? "Turn off" : "Turn on", nullptr, onBleToggle);
      break;
    case 9:
      gAfterCalibrate = Screen::Settings;
      go(Screen::Calibrate);
      break;
    case 10:
      message("Display",
              "Driver: " + String(kPanelNames[gSettings.panel % 4]) + " (in use: " + gPanelName +
                  "). If colours or the picture look wrong, try the next driver: auto, ILI9341, ST7789, ST7789 not "
                  "inverted. The controller restarts.",
              Screen::Settings, "Next driver", nullptr, onPanel);
      break;
    case 11:
      gLinePage = 0;
      go(Screen::Safety);
      break;
    default: message("About", aboutText(), Screen::Settings); break;
  }
}

// ---------------------------------------------------------------- message

void drawMessage() {
  clear();
  header(gMsg.title, true);
  fontSmall();
  drawWrapped(gMsg.body.c_str(), kMargin, kTop, kW - 2 * kMargin, color::kText, kFooterY - 4);
  const int n = gMsg.actions[1] ? 2 : gMsg.actions[0] ? 1 : 0;
  actionFooter(gMsg.actions, n);
}

void onMessage(uint8_t id) {
  if (id == kIdBack) go(gMsg.back);
  else if ((id == 30 || id == 31) && gMsg.onAction) gMsg.onAction(id - 30);
}

// ---------------------------------------------------------------- dispatch

void go(Screen s) {
  cancelPress();
  gScreen = s;
  if (s != Screen::Start && s != Screen::Message && s != Screen::ModuleCheck) gDoc.reset();
  if (s != Screen::Details && s != Screen::Safety) std::vector<std::string>().swap(gLines);
  if (s == Screen::Home || s == Screen::Categories || s == Screen::Programs || s == Screen::Log ||
      s == Screen::Settings)
    std::string().swap(gText);
  if (s != Screen::Session && s != Screen::Rate && s != Screen::Editor) lightNormal();
  switch (s) {
    case Screen::Calibrate: runCalibration(); break;
    case Screen::Safety: drawSafety(); break;
    case Screen::Home: drawHome(); break;
    case Screen::Categories: drawCategories(); break;
    case Screen::Programs: drawPrograms(); break;
    case Screen::Program: drawProgram(); break;
    case Screen::Details: drawDetails(); break;
    case Screen::Coils: drawCoils(); break;
    case Screen::Start: drawStart(); break;
    case Screen::Session: drawSession(); break;
    case Screen::Rate: drawRate(); break;
    case Screen::Log: drawLog(); break;
    case Screen::Settings: drawSettings(); break;
    case Screen::Editor: drawEditor(); break;
    case Screen::Message: drawMessage(); break;
    case Screen::ModuleCheck: drawModuleCheck(); break;
    case Screen::LedTest: drawLedTest(); break;
  }
}

void onButton(uint8_t id, int16_t x, int16_t y) {
  switch (gScreen) {
    case Screen::Safety: onSafety(id); break;
    case Screen::Home: onHome(id); break;
    case Screen::Categories: onCategories(id); break;
    case Screen::Programs: onPrograms(id); break;
    case Screen::Program: onProgram(id); break;
    case Screen::Details: onDetails(id); break;
    case Screen::Coils: onCoils(id, x, y); break;
    case Screen::Start: onStart(id); break;
    case Screen::Session: onSession(id); break;
    case Screen::Rate: onRate(id); break;
    case Screen::Log: onLog(id); break;
    case Screen::Settings: onSettings(id); break;
    case Screen::Editor: onEditor(id); break;
    case Screen::Message: onMessage(id); break;
    case Screen::ModuleCheck: onModuleCheck(id); break;
    case Screen::LedTest: onLedTest(id); break;
    case Screen::Calibrate: break;
  }
}

bool calibrated() {
  for (uint16_t v : gSettings.touchCal)
    if (v) return true;
  return false;
}

void firstScreen() {
  if (seq::busy()) return;  // the app started one already: loop() shows it
  if (!calibrated()) {
    gAfterCalibrate = gSettings.safetyAccepted ? Screen::Home : Screen::Safety;
    gLinePage = 0;
    go(Screen::Calibrate);
  } else if (!gSettings.safetyAccepted) {
    gLinePage = 0;
    go(Screen::Safety);
  } else {
    go(Screen::Home);
  }
}

}  // namespace

void begin() {
  gPanelName = display::begin(gSettings.panel);
  if (calibrated()) display::lcd().setTouchCalibrate(gSettings.touchCal);
  clear();
  fontBold();
  text("God Helmet", kW / 2, 130, color::kText, textdatum_t::top_center);
  fontSmall();
  text(String("firmware ") + kFirmwareVersion, kW / 2, 154, color::kMuted, textdatum_t::top_center);
  display::backlight(gSettings.backlight);
}

void bootStatus(const String& line) {
  lcd().fillRect(0, 180, kW, 40, color::kBg);
  fontSmall();
  drawWrapped(line.c_str(), 20, 180, kW - 40, color::kMuted, 220);
}

void setClockStatus(const String& status) {
  gClockStatus = status;
  if (sdcard::mounted()) pack::check(gPackPrograms, gPackError);
}

void loop() {
  if (gFirstLoop) {
    gFirstLoop = false;
    firstScreen();
  }
  const uint32_t now = millis();

  // A session started from the app (or still running): show it with its STOP button.
  if (seq::busy() && gScreen != Screen::Session) beginSessionScreen(false, seq::status().test, seq::status().logId, "");

  if (gScreen == Screen::Session) {
    if (now - gTickMs >= 100) {
      gTickMs = now;
      tickSession(false);
    }
    if (gScreen == Screen::Session && darkSessions() && !gDark && now - lastTouchMs() > kDarkAfterMs &&
        now - gSessWakeMs > kDarkAfterMs) {
      gDark = true;
      display::backlight(0);
    }
    if (gSessUi && now - gKeepaliveMs >= 1000) {
      gKeepaliveMs = now;
      seq::keepalive();  // the screen is the controlling UI here
    }
  } else if (gScreen == Screen::Start) {
    tickStart();
  }

  // BOOT held for 3 s while idle: touch calibration (when the touch is too far
  // off to reach Settings). BOOT is also STOP, which is harmless when idle.
  // A press that began during a session (or on its Rate screen) was STOP and
  // stays ignored until BOOT is released.
  static uint32_t bootDownMs = 0;
  static bool bootWasStop = false;
  if (digitalRead(pins::kStop) == LOW) {
    if (seq::busy() || gScreen == Screen::Session || gScreen == Screen::Rate) bootWasStop = true;
    if (!bootWasStop) {
      if (!bootDownMs) bootDownMs = now ? now : 1;
      if (now - bootDownMs > 3000) {
        bootDownMs = 0;
        bootWasStop = true;  // once per press
        gAfterCalibrate = gSettings.safetyAccepted ? Screen::Home : Screen::Safety;
        go(Screen::Calibrate);
        return;
      }
    }
  } else {
    bootDownMs = 0;
    bootWasStop = false;
  }

  // Header clock, once a minute.
  if (envdata::timeValid() && !gDark) {
    const int minute = static_cast<int>(envdata::now() / 60);
    if (minute != gShownMinute) {
      gShownMinute = minute;
      headerClock();
    }
  }

  const TouchEvent e = pollTouch();
  if (e.type == TouchEvent::None) return;
  if (gScreen == Screen::Session) {
    // STOP: any touch on the STOP area, new or held (a finger that slides onto
    // it, a palm); in the dark the whole bottom band.
    if ((e.type == TouchEvent::Down || e.type == TouchEvent::Hold) && e.y >= (gDark ? kStopZoneY : kStopY) &&
        seq::busy()) {
      stopNow();
      gSwallow = true;  // the rest of this touch does nothing
      return;
    }
    if (gDark) {
      if (e.type == TouchEvent::Down) {
        // Wake dimmed; this touch does nothing else.
        gDark = false;
        gSwallow = true;
        gSessWakeMs = now;
        display::backlight(sessionLevel());
        drawSession();
      }
      return;
    }
  }
  // A tap within 300 ms of a new screen belongs to the old one (double tap,
  // bounce): ignored, so "Start..." then "Start" cannot fire together.
  if (e.type == TouchEvent::Down && now - lastClearMs() < 300) {
    cancelPress();
    gSwallow = true;
    return;
  }
  if (gSwallow) {
    if (e.type == TouchEvent::Up) gSwallow = false;
    return;
  }
  int16_t x = 0, y = 0;
  const uint8_t id = handleTouch(e, x, y);
  if (id != kIdNone) onButton(id, x, y);
}

}  // namespace ui
