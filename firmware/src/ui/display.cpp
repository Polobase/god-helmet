#include "display.h"

#include <Arduino.h>

#include "../config.h"

namespace {

Lcd gLcd;
uint8_t gBacklight = 0;
constexpr int kBacklightHz = 12000;

}  // namespace

Lcd::Lcd() {
  {
    auto cfg = bus_.config();
    cfg.spi_host = HSPI_HOST;  // the LCD's own bus; VSPI belongs to the DAC and SD card
    cfg.spi_mode = 0;
    cfg.freq_write = 40000000;
    cfg.freq_read = 16000000;
    cfg.spi_3wire = false;
    cfg.use_lock = true;
    cfg.dma_channel = SPI_DMA_CH_AUTO;
    cfg.pin_sclk = pins::kLcdSclk;
    cfg.pin_mosi = pins::kLcdMosi;
    cfg.pin_miso = pins::kLcdMiso;
    cfg.pin_dc = pins::kLcdDc;
    bus_.config(cfg);
  }
  for (lgfx::Panel_LCD* p : {static_cast<lgfx::Panel_LCD*>(&ili_), static_cast<lgfx::Panel_LCD*>(&st_)}) {
    p->setBus(&bus_);
    auto cfg = p->config();
    cfg.pin_cs = pins::kLcdCs;
    cfg.pin_rst = -1;  // shared with EN (the board's RESET button)
    cfg.pin_busy = -1;
    cfg.panel_width = 240;
    cfg.panel_height = 320;
    cfg.offset_x = 0;
    cfg.offset_y = 0;
    cfg.offset_rotation = 0;
    cfg.dummy_read_pixel = 8;
    cfg.dummy_read_bits = 1;
    cfg.readable = true;
    cfg.invert = p == &st_;  // IPS ST7789 panels show inverted colours otherwise
    cfg.rgb_order = false;
    cfg.dlen_16bit = false;
    cfg.bus_shared = false;
    p->config(cfg);
  }
  {
    auto cfg = touch_.config();
    cfg.x_min = 300;  // rough limits until the user calibrates
    cfg.x_max = 3900;
    cfg.y_min = 200;
    cfg.y_max = 3700;
    cfg.pin_int = -1;  // GPIO36 interrupts are unreliable on the ESP32: poll
    cfg.bus_shared = false;
    cfg.offset_rotation = 0;
    cfg.spi_host = -1;  // bit-banged
    cfg.freq = 1000000;
    cfg.pin_sclk = pins::kTouchSclk;
    cfg.pin_mosi = pins::kTouchMosi;
    cfg.pin_miso = pins::kTouchMiso;
    cfg.pin_cs = pins::kTouchCs;
    touch_.config(cfg);
  }
  ili_.setTouch(&touch_);
  st_.setTouch(&touch_);
  setPanel(&ili_);
}

void Lcd::selectPanel(bool st7789, bool invert) {
  if (st7789) {
    auto cfg = st_.config();
    cfg.invert = invert;
    st_.config(cfg);
    setPanel(&st_);
  } else {
    setPanel(&ili_);
  }
}

namespace display {

Lcd& lcd() { return gLcd; }

const char* begin(uint8_t panelSetting) {
  ledcAttach(pins::kBacklight, kBacklightHz, 8);
  backlight(0);
  bool st7789 = panelSetting >= 2;
  gLcd.selectPanel(st7789, panelSetting != 3);
  gLcd.init();
  if (panelSetting == 0) {
    // RDDID (04h): an ST7789 answers 85 85 52; the ILI9341 does not.
    const uint32_t id = gLcd.panel()->readCommand(0x04, 0, 4);
    int n85 = 0, n52 = 0;
    for (int i = 0; i < 4; ++i) {
      const uint8_t b = (id >> (8 * i)) & 0xFF;
      n85 += b == 0x85;
      n52 += b == 0x52;
    }
    if (n85 >= 2 && n52 >= 1) {
      st7789 = true;
      gLcd.selectPanel(true, true);
      gLcd.init();
    }
  }
  gLcd.setRotation(0);  // portrait, USB-C on the right
  gLcd.fillScreen(TFT_BLACK);
  return st7789 ? "ST7789" : "ILI9341";
}

void backlight(uint8_t level) {
  gBacklight = level;
  ledcWrite(pins::kBacklight, level);
}

uint8_t backlightLevel() { return gBacklight; }

}  // namespace display
