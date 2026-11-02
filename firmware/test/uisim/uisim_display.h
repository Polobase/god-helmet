// Host stand-in for src/ui/display.h: the same Lcd API, drawn into a 240x320
// sprite that the screenshot tool saves as PNG. Touch comes from the script.
#pragma once
#define LGFX_USE_V1
#include <LovyanGFX.hpp>

namespace sim {
extern bool touchDown;
extern int touchX, touchY;
void onCalibrate();  // the tool saves a screenshot of the calibration screen
}  // namespace sim

class Lcd : public lgfx::LGFX_Sprite {
 public:
  template <typename T>
  uint_fast8_t getTouch(T* x, T* y, uint_fast8_t = 0) {
    if (!sim::touchDown) return 0;
    *x = sim::touchX;
    *y = sim::touchY;
    return 1;
  }
  // Calibration: a finger that touches each corner for 16 readings, then lifts.
  uint_fast8_t getTouchRaw(lgfx::touch_point_t* tp, uint_fast8_t = 1) {
    static int calls = 0;
    if (calls++ == 0) sim::onCalibrate();  // first arrow drawn: screenshot
    const int k = calls % 18;
    if (k == 0 || k == 17) return 0;
    tp->x = 2000;
    tp->y = 2000;
    return 1;
  }
  void setTouchCalibrate(uint16_t*) {}
};

namespace display {
Lcd& lcd();
const char* begin(uint8_t panelSetting);
void backlight(uint8_t level);
uint8_t backlightLevel();
}  // namespace display
