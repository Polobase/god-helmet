// 8-coil weak-field helmet controller (ESP32, ESP32-S3, -C3 or -C6 + AD5328
// ±10 V module), controlled by the web app (webapp/, GitHub Pages) over
// Bluetooth or USB, or on the 2.8" display board standalone from its
// touchscreen (docs/STANDALONE.md).
//
// Boot order matters: the AD5328 powers up at code 0, which on the ±10 V
// module is about -10 V on every output. The DAC is reset to mid-scale (0 V)
// before anything else; boards with an arming switch keep the coil return
// open until then.
#include <Arduino.h>
#include <LittleFS.h>
#include <esp_bt.h>

#include <cstdio>

#include "ble.h"
#include "config.h"
#include "dac.h"
#include "envdata.h"
#include "logbook.h"
#include "sdcard.h"
#include "sequencer.h"
#include "settings.h"
#include "timesync.h"
#include "usblink.h"
#ifdef STANDALONE_UI
#include "ui/ui.h"
#endif

namespace {

void IRAM_ATTR onStopButton() { seq::emergencyStopFromIsr(); }

void attachStop(int pin) {
  if (pin < 0) return;
#if CONFIG_IDF_TARGET_ESP32
  // GPIO 34-39 are input only, without internal pull-ups (a button there needs an external one).
  pinMode(pin, pin >= 34 ? INPUT : INPUT_PULLUP);
#else
  pinMode(pin, INPUT_PULLUP);
#endif
  attachInterrupt(digitalPinToInterrupt(pin), onStopButton, FALLING);
}

#ifdef BOARD_ESP32E_LCD28
// Display board: speaker amplifier off, screen dark and every SPI device
// deselected until its driver takes over its pins.
void quietBoard() {
  for (int p : {pins::kBacklight, pins::kAudioOut}) {
    pinMode(p, OUTPUT);
    digitalWrite(p, LOW);
  }
  for (int p : {pins::kAudioEnable, pins::kSdCs, pins::kLcdCs, pins::kTouchCs, pins::kLedR, pins::kLedG, pins::kLedB}) {
    pinMode(p, OUTPUT);
    digitalWrite(p, HIGH);
  }
}

// Common-anode RGB LED, dimmed with PWM (0..255 brightness, inverted drive).
void rgb(uint8_t r, uint8_t g, uint8_t b) {
  analogWrite(pins::kLedR, 255 - r);
  analogWrite(pins::kLedG, 255 - g);
  analogWrite(pins::kLedB, 255 - b);
}
#endif

void ensureDirs() {
  for (const char* d : {"/log", "/trials"})
    if (!LittleFS.exists(d)) LittleFS.mkdir(d);
}

// Status LED, dim so it doesn't disturb a dark session. Identical for sham
// and real sessions. Idle: blue blink; app connected (Bluetooth or USB):
// steady blue; session: amber. Written only when it changes.
void updateLed() {
  enum class Led : uint8_t { Off, Blue, Amber };
  static Led last = Led::Amber;
  static bool first = true;
  const bool connected = ble::connections() > 0 || usblink::connections() > 0;
  const bool blinkOn = (millis() / 1000) % 2 == 0;
  const Led led = seq::busy() ? Led::Amber : (connected || blinkOn) ? Led::Blue : Led::Off;
  if (led == last && !first) return;
  last = led;
  first = false;
  const uint8_t r = led == Led::Amber ? 12 : 0, g = led == Led::Amber ? 4 : 0, b = led == Led::Blue ? 10 : 0;
#if defined(BOARD_ESP32E_LCD28)
  rgb(r, g, b);
#else
  if constexpr (pins::kRgbLed >= 0) neopixelWrite(pins::kRgbLed, r, g, b);
  if constexpr (pins::kStatusLed >= 0) digitalWrite(pins::kStatusLed, led == Led::Off ? LOW : HIGH);
#endif
}

String bleName() {
  if (gSettings.bleName.length() > 0) return gSettings.bleName;
  const uint64_t mac = ESP.getEfuseMac();
  char name[24];
  std::snprintf(name, sizeof name, "GodHelmet-%02X%02X", static_cast<unsigned>((mac >> 32) & 0xFF),
                static_cast<unsigned>((mac >> 40) & 0xFF));
  return name;
}

}  // namespace

void setup() {
  // 1. Coil return open (boards with an arming switch), DAC outputs to 0 V before anything else.
  if (pins::kArm >= 0) {
    pinMode(pins::kArm, OUTPUT);
    digitalWrite(pins::kArm, LOW);
  }
#ifdef BOARD_ESP32E_LCD28
  quietBoard();
#endif
  gSettings.load();
  dac::begin(gSettings.dacGain2x, gSettings.dacBufferedRef);

  usblink::begin();
  usblink::logf("\nGod helmet controller %s (%s, %s)\n", kFirmwareVersion, BOARD_NAME, ESP.getChipModel());

  // 2. Real-time engine and the STOP buttons (external and BOOT).
  seq::begin();
  attachStop(pins::kStop);
  if (pins::kBoot != pins::kStop) attachStop(pins::kBoot);
  if (pins::kStatusLed >= 0) pinMode(pins::kStatusLed, OUTPUT);

  // 3. Storage and clock. The SD card is read only now and between sessions.
  if (!LittleFS.begin(true)) usblink::logf("LittleFS mount failed\n");
  ensureDirs();
  envdata::begin();
  timesync::applyTimezone();
#ifdef STANDALONE_UI
  ui::begin();  // boot screen while the card and the clock are read
#endif
  String clockStatus = "time not set";
  if (sdcard::begin()) {
    usblink::logf("SD: %s\n", sdcard::describe().c_str());
#ifdef STANDALONE_UI
    if (sdcard::exists(String(sdcard::kRoot) + "/wifi.txt")) ui::bootStatus("Getting the time over WiFi (wifi.txt)...");
#endif
    timesync::syncFromWifiFile(clockStatus);
    usblink::logf("Clock: %s\n", clockStatus.c_str());
  }

  // 4. Touchscreen (display board) and Bluetooth (optional there).
#ifdef STANDALONE_UI
  ui::setClockStatus(clockStatus);
#endif
  if (gSettings.bleEnabled) {
    const String name = bleName();
    ble::begin(name.c_str());
    usblink::logf("BLE advertising as \"%s\"\n", name.c_str());
  } else {
#if CONFIG_IDF_TARGET_ESP32
    // Bluetooth off: give its reserved memory back to the heap (until the next reboot).
    esp_bt_controller_mem_release(ESP_BT_MODE_BTDM);
#endif
    usblink::logf("Bluetooth off\n");
  }
  usblink::logf("Free heap %lu bytes\n", static_cast<unsigned long>(ESP.getFreeHeap()));
}

void loop() {
  // App requests (Bluetooth and USB) and the touchscreen run in this one task,
  // so the log and the settings are never changed from two places at once.
  ble::loop();
  usblink::loop();

  seq::Finished finished;
  if (seq::popFinished(finished)) logbook::close(finished);

#ifdef STANDALONE_UI
  ui::loop();
#endif
  updateLed();
  delay(2);
}
