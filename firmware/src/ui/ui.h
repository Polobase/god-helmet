// Touchscreen UI of the standalone display board (docs/STANDALONE.md).
// Runs from the Arduino loop task, like the Bluetooth request handling, so the
// two never change the log or the settings at the same time.
#pragma once
#include <Arduino.h>

namespace ui {

// Starts the display and shows the boot screen (call right after the DAC is at 0 V).
void begin();
void bootStatus(const String& line);  // a line on the boot screen
void setClockStatus(const String& status);  // how the clock was set at boot (shown on Home)
void loop();  // from the Arduino loop: touch, screens, the running session

}  // namespace ui
