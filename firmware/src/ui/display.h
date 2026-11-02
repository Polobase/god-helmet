// LCD + touch of the 2.8" ESP32-32E board (LovyanGFX).
// LCD: ILI9341 (E32R28T) or ST7789 (E32R28T-1) on HSPI, picked at boot by
// reading the controller ID. Touch: XPT2046 read bit-banged on its own pins;
// it must never use VSPI, which carries the DAC and the SD card.
#pragma once
#ifdef UI_SIM
#include "uisim_display.h"  // host screenshot tool (test/uisim): same API, drawn into memory
#else
#define LGFX_USE_V1
#include <LovyanGFX.hpp>

class Lcd : public lgfx::LGFX_Device {
 public:
  Lcd();
  void selectPanel(bool st7789, bool invert);

 private:
  lgfx::Bus_SPI bus_;
  lgfx::Panel_ILI9341 ili_;
  lgfx::Panel_ST7789 st_;
  lgfx::Touch_XPT2046 touch_;
};

namespace display {

Lcd& lcd();
// Starts the panel. panelSetting: 0 auto, 1 ILI9341, 2 ST7789, 3 ST7789 not inverted.
// Returns the panel name.
const char* begin(uint8_t panelSetting);
void backlight(uint8_t level);  // 0 = off .. 255
uint8_t backlightLevel();

}  // namespace display
#endif  // UI_SIM
