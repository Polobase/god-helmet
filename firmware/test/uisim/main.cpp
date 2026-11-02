// UI screenshot tool: runs the touchscreen UI (src/ui) on the host against
// stubs, taps through every screen and saves each one as a PNG.
//   test/uisim/run.sh [out dir]      (builds the program pack first)
#include <Arduino.h>

#include <cstdio>
#include <string>

#include "display.h"
#include "sequencer.h"
#include "settings.h"
#include "ui.h"
#include "widgets.h"

namespace sim {
extern uint32_t nowMs;
extern std::string packRoot;
extern bool timeValid;
extern bool restarted;
extern bool bootDown;
bool touchDown = false;
int touchX = 0, touchY = 0;
}  // namespace sim

namespace {

std::string gOut;
int gShot = 0;
int gFailures = 0;

void shot(const char* name) {
  size_t len = 0;
  void* png = display::lcd().createPng(&len, 0, 0, 240, 320);
  char path[512];
  std::snprintf(path, sizeof path, "%s/%02d-%s.png", gOut.c_str(), gShot++, name);
  if (FILE* f = std::fopen(path, "wb")) {
    std::fwrite(png, 1, len, f);
    std::fclose(f);
  }
  free(png);
  std::printf("  %s%s\n", path, display::backlightLevel() == 0 ? "  (backlight off)" : "");
}

void run(uint32_t ms) {
  const uint32_t end = sim::nowMs + ms;
  while (sim::nowMs < end) {
    ui::loop();
    sim::nowMs += 2;
  }
}

void tapAt(int x, int y) {
  run(350);  // a person's pause: taps within 300 ms of a new screen are ignored
  sim::touchDown = true;
  sim::touchX = x;
  sim::touchY = y;
  run(60);
  sim::touchDown = false;
  run(60);
}

void expect(bool ok, const char* what) {
  std::printf("  %s: %s\n", ok ? "ok" : "FAIL", what);
  if (!ok) ++gFailures;
}

bool tap(uint8_t id, const char* what) {
  const ui::Button* b = ui::button(id);
  if (!b) {
    std::printf("  FAIL: no button %d (%s)\n", id, what);
    ++gFailures;
    return false;
  }
  tapAt(b->x + b->w / 2, b->y + b->h / 2);
  return true;
}

}  // namespace

namespace sim {
void onCalibrate() { shot("calibrate"); }
}  // namespace sim

int main(int argc, char** argv) {
  if (argc < 3) {
    std::fprintf(stderr, "usage: uisim <pack dir containing godhelmet/> <out dir>\n");
    return 2;
  }
  sim::packRoot = argv[1];
  gOut = argv[2];
  using namespace ui;

  ui::begin();
  ui::bootStatus("Getting the time over WiFi (wifi.txt)...");
  shot("boot");
  ui::setClockStatus("no wifi.txt on the card");
  run(50);  // first loop: touch calibration, then the safety page
  shot("safety");
  for (int i = 0; i < 6; ++i) {
    const Button* b = button(1);
    if (!b || std::string(b->label) != "Read on") break;
    tap(1, "read on");
  }
  shot("safety-last");
  tap(1, "accept");
  shot("home");

  tap(1, "programs");
  shot("categories");
  tap(kIdNext, "next page");
  shot("categories-p2");
  tap(kIdPrev, "prev page");
  tap(0, "first category");
  shot("programs");
  tap(1, "second program");
  shot("program");
  tap(1, "coils");
  shot("coils");
  tap(2, "next coil");
  tap(2, "next coil");
  tap(2, "next coil");
  shot("coils-ch4");
  tapAt(150, 100);  // tap on the map
  shot("coils-map-tap");
  tap(kIdBack, "back");
  tap(2, "details");
  shot("details");
  tap(kIdNext, "next page");
  shot("details-p2");
  tap(kIdBack, "back");

  gSettings.sessionScreen = 2;  // dark after 10 s: the dark-screen STOP band is tested below
  tap(3, "start...");
  {
    const ui::Button* b = ui::button(4);  // "Start" sits where "Start..." was: a quick second tap
    if (b) {
      sim::touchDown = true, sim::touchX = b->x + b->w / 2, sim::touchY = b->y + b->h / 2;
      run(60);
      sim::touchDown = false;
      run(60);
    }
    expect(!seq::busy() && b && std::string(ui::button(4)->label) == "Start",
           "a double tap on Start... opens the Start screen, nothing more");
  }
  shot("start");
  for (int i = 0; i < 3; ++i) tap(2, "field +");
  tap(3, "blind");
  shot("start-blind");
  tap(4, "start");
  // The module cannot be detected: the first start after power-on asks for it.
  expect(!seq::busy() && ui::button(30) && std::string(ui::button(30)->label) == "Connected",
         "first start after power-on asks to confirm the AD5328 module");
  shot("module-gate");
  tap(31, "check it");
  shot("module-check-1");
  tap(30, "next");
  shot("module-check-2");
  tap(30, "next");
  tap(2, "next output");
  shot("module-check-3");
  tap(3, "+5 V");
  run(1000);
  shot("module-test");
  run(60000);
  expect(ui::button(32) != nullptr, "after the output test: back on the module check");
  tap(32, "module OK");
  tap(4, "start");
  shot("start-confirm");
  tap(4, "start again");
  run(1000);
  expect(seq::busy(), "Start after the module check starts the session");
  shot("session");
  run(11000);
  shot("session-dark");
  tapAt(120, 100);  // top: wakes the screen
  shot("session-wake");
  tap(3, "skip phase");
  run(400);
  shot("session-phase2");
  // A finger on the field buttons that slides onto STOP stops the session.
  sim::touchDown = true, sim::touchX = 120, sim::touchY = 186;
  run(100);
  sim::touchY = 290;
  run(40);
  expect(!seq::busy(), "a finger sliding onto STOP stops the session");
  sim::touchDown = false;
  run(400);
  shot("rate");
  tap(17, "rating 7");
  shot("rate-picked");
  tap(2, "save");
  shot("rate-revealed");
  tap(3, "done");
  shot("home-after");

  tap(2, "log");
  shot("log");
  tap(0, "unrated entry");
  shot("log-rate");
  tap(1, "later");
  tap(1, "rated entry");
  shot("log-entry");
  tap(kIdBack, "back");
  tap(kIdBack, "home");

  tap(3, "settings");
  shot("settings");
  tap(1, "clock");
  shot("clock");
  for (int i = 0; i < 10; ++i) tap(11, "year +");
  tap(30, "set clock");
  shot("settings-clock-set");
  tap(0, "head size");
  shot("head");
  tap(11, "nasion-inion +");
  tap(30, "save");
  tap(3, "screen in session");  // dark after 10 s -> on
  shot("settings-screen-on");
  tap(6, "led test");
  shot("led-test");
  tap(4, "all in turn");
  run(3000);
  expect(seq::busy(), "LED test running");
  shot("led-test-running");
  tapAt(120, 290);  // STOP
  run(400);
  expect(!seq::busy() && ui::button(4) != nullptr, "STOP ends the LED test and returns to its screen");
  tap(kIdBack, "back");
  tap(kIdNext, "settings page 2");
  shot("settings-p2");
  tap(0, "coil test");
  shot("coil-test");
  tap(11, "coil +");
  tap(30, "dc test");
  run(1000);
  shot("test-running");
  run(30000);
  shot("coil-test-after");
  tap(kIdBack, "back");
  tap(1, "bluetooth");
  shot("bluetooth");
  tap(kIdBack, "back");
  tap(5, "about");
  shot("about");
  tap(kIdBack, "back");
  tap(kIdBack, "home");
  shot("home-clock-set");

  // Coils with the user's head measurements.
  tap(1, "programs");
  tap(0, "first category");
  tap(1, "second program");
  tap(1, "coils");
  shot("coils-your-head");

  // BOOT held as STOP: no touch calibration after the session has ended.
  tap(kIdBack, "back");
  tap(3, "start...");
  tap(4, "start");
  if (ui::button(4) && std::string(ui::button(4)->label) == "Tap again to start") tap(4, "start again");
  run(500);
  expect(seq::busy(), "session running");
  sim::bootDown = true;
  seq::emergencyStop("STOP button");  // what the BOOT interrupt does
  run(4500);
  expect(ui::button(17) != nullptr, "BOOT held as STOP: the Rate screen stays (no touch calibration)");
  sim::bootDown = false;
  run(100);
  shot("rate-after-boot-stop");

  std::printf("%d screenshots, %d failures%s\n", gShot, gFailures, sim::restarted ? " (restart requested)" : "");
  return gFailures ? 1 : 0;
}
