// Wall clock for boards without the app (the ESP32 has no battery-backed RTC).
// At boot the time comes from the internet if /godhelmet/wifi.txt is on the
// SD card (WiFi is switched off again right after); otherwise the user sets it
// on the screen. The app, when connected, still sets it as before (time.set).
#pragma once
#include <Arduino.h>

namespace timesync {

// Applies the stored timezone (Settings::tz) to the C library.
void applyTimezone();
// Reads wifi.txt (ssid=, password=, optional tz=) and syncs via NTP.
// Returns true when the clock is set. Takes up to ~20 s; call before the UI starts.
bool syncFromWifiFile(String& status);
// Sets the clock from local date/time fields (as typed on the screen).
bool setLocal(int year, int month, int day, int hour, int minute);
// "2026-11-02 14:30" in local time, or "time not set".
String localString(uint32_t epoch);

}  // namespace timesync
