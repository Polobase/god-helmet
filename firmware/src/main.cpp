// 8-coil weak-field helmet controller (ESP32-S3 / ESP32 + AD5328 ±10 V module),
// controlled over BLE by the web app (webapp/, GitHub Pages), or on the
// 2.8" display board standalone from its touchscreen (docs/STANDALONE.md).
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
#ifdef STANDALONE_UI
#include "ui/ui.h"
#endif

namespace {

void IRAM_ATTR onStopButton() { seq::emergencyStopFromIsr(); }

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
// and real sessions. Idle: blue blink; app connected: steady blue; session: amber.
void updateLed() {
  const bool running = seq::busy();
  const bool connected = ble::connections() > 0;
  const bool blinkOn = (millis() / 1000) % 2 == 0;
#if defined(BOARD_ESP32E_LCD28)
  if (running) rgb(12, 4, 0);
  else if (connected || blinkOn) rgb(0, 0, 10);
  else rgb(0, 0, 0);
#elif defined(RGB_BUILTIN)
  if (running) neopixelWrite(RGB_BUILTIN, 12, 4, 0);
  else if (connected || blinkOn) neopixelWrite(RGB_BUILTIN, 0, 0, 10);
  else neopixelWrite(RGB_BUILTIN, 0, 0, 0);
#else
  digitalWrite(2, running || connected || blinkOn ? HIGH : LOW);
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

  Serial.begin(115200);
  Serial.printf("\nGod helmet controller %s (%s)\n", kFirmwareVersion, BOARD_NAME);

  // 2. Real-time engine and the hardware STOP button.
  seq::begin();
  // GPIO 34-39 are input only, without internal pull-ups (a button there needs an external one).
  pinMode(pins::kStop, pins::kStop >= 34 ? INPUT : INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(pins::kStop), onStopButton, FALLING);
#if !defined(RGB_BUILTIN) && !defined(BOARD_ESP32E_LCD28)
  pinMode(2, OUTPUT);
#endif

  // 3. Storage and clock. The SD card is read only now and between sessions.
  if (!LittleFS.begin(true)) Serial.println("LittleFS mount failed");
  ensureDirs();
  envdata::begin();
  timesync::applyTimezone();
#ifdef STANDALONE_UI
  ui::begin();  // boot screen while the card and the clock are read
#endif
  String clockStatus = "time not set";
  if (sdcard::begin()) {
    Serial.printf("SD: %s\n", sdcard::describe().c_str());
#ifdef STANDALONE_UI
    if (sdcard::exists(String(sdcard::kRoot) + "/wifi.txt")) ui::bootStatus("Getting the time over WiFi (wifi.txt)...");
#endif
    timesync::syncFromWifiFile(clockStatus);
    Serial.printf("Clock: %s\n", clockStatus.c_str());
  }

  // 4. Touchscreen (display board) and Bluetooth (optional there).
#ifdef STANDALONE_UI
  ui::setClockStatus(clockStatus);
#endif
  if (gSettings.bleEnabled) {
    const String name = bleName();
    ble::begin(name.c_str());
    Serial.printf("BLE advertising as \"%s\"\n", name.c_str());
  } else {
#if CONFIG_IDF_TARGET_ESP32
    // Bluetooth off: give its reserved memory back to the heap (until the next reboot).
    esp_bt_controller_mem_release(ESP_BT_MODE_BTDM);
#endif
    Serial.println("Bluetooth off");
  }
  Serial.printf("Free heap %lu bytes\n", static_cast<unsigned long>(ESP.getFreeHeap()));
}

void loop() {
  // App requests and the touchscreen run in this one task, so the log and the
  // settings are never changed from two places at once.
  ble::loop();

  seq::Finished finished;
  if (seq::popFinished(finished)) logbook::close(finished);

#ifdef STANDALONE_UI
  ui::loop();
#endif
  updateLed();
  delay(2);
}
