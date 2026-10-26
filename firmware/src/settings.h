// Persistent device settings (NVS via Preferences).
#pragma once
#include <Arduino.h>

#include "drive.h"

struct Settings {
  // Calibration: peak field per mA at the reference depth (20 mm from the coil
  // face, on axis). Default = air-core estimate for the 19x12 mm 495-turn coils;
  // replace with measured values (docs/CALIBRATION.md).
  float uTperMA[8] = {0.73f, 0.73f, 0.73f, 0.73f, 0.73f, 0.73f, 0.73f, 0.73f};
  bool calibrated = false;
  engine::DriveConfig drive;
  bool dacGain2x = true;        // AD5328 GAIN bits (module expects 0..2*Vref; verify on bench)
  bool dacBufferedRef = false;
  float maxFieldUT = 5.0f;      // user ceiling at reference depth
  float defaultFieldUT = 1.0f;
  double longitudeDeg = 0.0;    // east positive; used for local sidereal time (set in the app)
  uint32_t keepaliveS = 0;      // stop if no app is connected this long while running (0 = off)
  String bleName;               // empty -> "GodHelmet-XXXX"
  uint32_t lastSessionEpoch = 0;
  bool safetyAccepted = false;

  void load();
  void save() const;
  // JSON for the app.
  String toJson() const;
  // Applies fields present in a JSON object; returns false with a message on bad input.
  bool applyJson(const String& body, String& error);
};

extern Settings gSettings;
