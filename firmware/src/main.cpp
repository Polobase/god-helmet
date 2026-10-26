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
#ifdef RGB_BUILTIN
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
  gSettings.load();
  dac::begin(gSettings.dacGain2x, gSettings.dacBufferedRef);

  Serial.begin(115200);
  Serial.printf("\nGod helmet controller %s (%s)\n", kFirmwareVersion, BOARD_NAME);

  // 2. Real-time engine and the hardware STOP button.
  seq::begin();
  pinMode(pins::kStop, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(pins::kStop), onStopButton, FALLING);
#ifndef RGB_BUILTIN
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
