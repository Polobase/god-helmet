// 8-coil weak-field helmet controller (ESP32-S3 / ESP32 + AD5328 ±10 V module),
// controlled over BLE by the web app (webapp/, GitHub Pages).
//
// Boot order matters: the AD5328 powers up at code 0, which on the ±10 V
// module is about -10 V on every output. The coil return stays open (arming
// switch low) until the DAC has been reset and set to mid-scale (0 V).
#include <Arduino.h>
#include <LittleFS.h>

#include <cstdio>

#include "ble.h"
#include "config.h"
#include "dac.h"
#include "envdata.h"
#include "logbook.h"
#include "sequencer.h"
#include "settings.h"

namespace {

void IRAM_ATTR onStopButton() { seq::emergencyStopFromIsr(); }

#ifdef BOARD_ESP32E_LCD28
// Display board: keep the screen dark (sessions run in darkness), the speaker
// amplifier off and every other SPI device deselected.
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
  // 1. Coil return open, DAC outputs to 0 V before anything else.
  pinMode(pins::kArm, OUTPUT);
  digitalWrite(pins::kArm, LOW);
#ifdef BOARD_ESP32E_LCD28
  quietBoard();
#endif
  gSettings.load();
  dac::begin(gSettings.dacGain2x, gSettings.dacBufferedRef);

  Serial.begin(115200);
  Serial.printf("\nGod helmet controller %s (%s)\n", kFirmwareVersion, BOARD_NAME);

  // 2. Real-time engine and the hardware STOP button.
  seq::begin();
  // GPIO 34-39 are input only, without internal pull-ups (the button needs an external one).
  pinMode(pins::kStop, pins::kStop >= 34 ? INPUT : INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(pins::kStop), onStopButton, FALLING);
#ifdef BOARD_ESP32E_LCD28
  pinMode(pins::kStop2, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(pins::kStop2), onStopButton, FALLING);
#elif !defined(RGB_BUILTIN)
  pinMode(2, OUTPUT);
#endif

  // 3. Storage and BLE.
  if (!LittleFS.begin(true)) Serial.println("LittleFS mount failed");
  ensureDirs();
  envdata::begin();
  const String name = bleName();
  ble::begin(name.c_str());
  Serial.printf("BLE advertising as \"%s\"\n", name.c_str());
}

void loop() {
  ble::loop();

  seq::Finished finished;
  if (seq::popFinished(finished)) logbook::close(finished);

  updateLed();
  delay(2);
}
