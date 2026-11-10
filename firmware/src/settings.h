// Persistent device settings (NVS via Preferences).
#pragma once
#include <Arduino.h>

#include "drive.h"

struct Settings {
  // Calibration: peak field per mA at the reference depth (20 mm from the coil
  // face, on axis). Default = air-core estimate for the 19x12 mm 495-turn coils;
  // replace with measured values (docs/CALIBRATION.md).
  // µT at 20 mm per mA; 1.8 = cored-coil model (docs/CALIBRATION.md), measure per coil.
  float uTperMA[8] = {1.8f, 1.8f, 1.8f, 1.8f, 1.8f, 1.8f, 1.8f, 1.8f};
  bool calibrated = false;
  engine::DriveConfig drive;
  bool dacGain2x = true;        // AD5328 GAIN bits (module expects 0..2*Vref; verify on bench)
  bool dacBufferedRef = false;
  float maxFieldUT = 5.0f;      // user ceiling at reference depth
  float defaultFieldUT = 1.0f;
  double longitudeDeg = 0.0;    // east positive; used for local sidereal time (set in the app)
  uint32_t keepaliveS = 0;      // stop a session when no app has been present this long: 0 = off, else 5..3600
  String bleName;               // empty -> "GodHelmet-XXXX"
  uint32_t lastSessionEpoch = 0;
  bool safetyAccepted = false;
#ifdef STANDALONE_UI
  bool bleEnabled = false;      // standalone board: Bluetooth only when switched on
#else
  bool bleEnabled = true;
#endif
  // On-device UI (display boards)
  uint8_t backlight = 160;      // 0..255 while the UI is in use
  uint8_t panel = 0;            // 0 auto, 1 ILI9341, 2 ST7789
  uint8_t sessionScreen = 0;    // during a session: 0 on, 1 dimmed, 2 dark after 10 s
  uint16_t touchCal[8] = {0};   // LovyanGFX touch calibration, all 0 = not calibrated
  float headNI = 0, headLR = 0, headC = 0;  // head measurements in cm, 0 = typical head
  String tz = "CET-1CEST,M3.5.0,M10.5.0/3";  // POSIX TZ for the clock shown on the device

  void load();
  void save() const;
  void saveLastSession() const;  // one NVS key only (written at every session start)
  // JSON for the app.
  String toJson() const;
  // Applies fields present in a JSON object; returns false with a message on bad input.
  bool applyJson(const String& body, String& error);
};

extern Settings gSettings;
