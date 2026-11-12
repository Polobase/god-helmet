// Board wiring and fixed limits. One block per chip (docs/WIRING.md has the
// same tables); every block defines the same names, -1 = not present:
//   kSclk kMosi kSync kLdac  AD5328 module (kMiso only where an SD card shares the bus)
//   kArm                     PhotoMOS arming switch for the coil return
//   kStop                    external STOP button to GND
//   kBoot                    the board's BOOT button, a second STOP
//   kRgbLed / kStatusLed     status LED: addressable RGB, or a plain LED (high = on)
#pragma once
#include <cstdint>

#if CONFIG_IDF_TARGET_ESP32S3
// ESP32-S3-DevKitC-1 (N8R8 / N16R8). Avoids strapping pins (0, 3, 45, 46),
// USB (19, 20), UART0 (43, 44) and the octal flash/PSRAM pins (26-37). FSPI default pins.
namespace pins {
constexpr int kSclk = 12;   // -> AD5328 module CLK
constexpr int kMosi = 11;   // -> DIN
constexpr int kSync = 10;   // -> SYNC (manual chip select, high between words)
constexpr int kLdac = 9;    // -> LDAC (pulse low: all 8 outputs update together)
constexpr int kArm = 4;     // -> PhotoMOS LED via 330 Ω, 10 kΩ pull-down: closes coil return
constexpr int kStop = 5;    // <- STOP button to GND (internal pull-up)
constexpr int kMiso = -1;   // not used
constexpr int kBoot = 0;
constexpr int kRgbLed = 48;  // DevKitC-1 v1.0 (v1.1 boards have it on 38)
constexpr int kStatusLed = -1;
}  // namespace pins
#define BOARD_NAME "ESP32-S3"
#elif CONFIG_IDF_TARGET_ESP32C3
// ESP32-C3-DevKitM-1, also the small "C3 Super Mini" boards (single core).
// Avoids strapping pins (2, 8, 9), USB (18, 19), UART0 (20, 21) and flash (12-17).
// FSPI default pins.
namespace pins {
constexpr int kSclk = 4;
constexpr int kMosi = 6;
constexpr int kSync = 7;
constexpr int kLdac = 5;
constexpr int kArm = 10;
constexpr int kStop = 3;
constexpr int kMiso = -1;
constexpr int kBoot = 9;
constexpr int kRgbLed = 8;   // DevKitM-1 RGB LED (a Super Mini's blue LED on 8 just flickers)
constexpr int kStatusLed = -1;
}  // namespace pins
#define BOARD_NAME "ESP32-C3"
#elif CONFIG_IDF_TARGET_ESP32C6
// ESP32-C6-DevKitC-1 (single core). Avoids strapping pins (4, 5, 8, 9, 15),
// USB (12, 13), UART0 (16, 17) and flash (24-30). FSPI default pins.
namespace pins {
constexpr int kSclk = 21;
constexpr int kMosi = 19;
constexpr int kSync = 18;
constexpr int kLdac = 20;
constexpr int kArm = 22;
constexpr int kStop = 23;
constexpr int kMiso = -1;
constexpr int kBoot = 9;
constexpr int kRgbLed = 8;
constexpr int kStatusLed = -1;
}  // namespace pins
#define BOARD_NAME "ESP32-C6"
#elif defined(BOARD_ESP32E_LCD28)
// "2.8inch ESP32-32E Display" (LCDwiki E32R28T / E32N28T, ESP32-D0WD, 4 MB),
// standalone: touchscreen UI, programs on the microSD card (docs/STANDALONE.md).
// The AD5328 sits on the 4-pin SPI peripheral header and shares the VSPI bus
// with the SD card. No arming switch (coil returns go to module GND) and no
// external STOP button: STOP is the on-screen button and the BOOT button.
namespace pins {
constexpr int kSclk = 18;   // SPI header SCK (shared with the SD card)
constexpr int kMosi = 23;   // SPI header MOSI (shared)
constexpr int kMiso = 19;   // SD card data out (the AD5328 never answers)
constexpr int kSync = 27;   // SPI header CS
constexpr int kLdac = -1;   // no free pin: module LDAC tied to 3.3 V, software single update
constexpr int kArm = -1;    // no arming switch
constexpr int kStop = 0;    // BOOT button (on-board 10 kΩ pull-up)
constexpr int kBoot = 0;    // the same button
constexpr int kRgbLed = -1, kStatusLed = -1;  // its own RGB LED: kLedR/G/B below
constexpr int kSdCs = 5;
// LCD on HSPI (ILI9341 or ST7789), touch XPT2046 read bit-banged on its own pins.
constexpr int kLcdSclk = 14, kLcdMosi = 13, kLcdMiso = 12, kLcdCs = 15, kLcdDc = 2;
constexpr int kBacklight = 21;   // high = on (PWM)
constexpr int kTouchSclk = 25, kTouchMosi = 32, kTouchMiso = 39, kTouchCs = 33, kTouchIrq = 36;
constexpr int kAudioEnable = 4;  // low = amplifier on: held high (silent)
constexpr int kAudioOut = 26;
constexpr int kLedR = 22, kLedG = 16, kLedB = 17;  // RGB LED, common anode: low = on
}  // namespace pins
#define HAS_SD_CARD 1
#define BOARD_NAME "ESP32-32E 2.8in display"
#else
// ESP32 DevKitC (WROOM-32), VSPI.
namespace pins {
constexpr int kSclk = 18;
constexpr int kMosi = 23;
constexpr int kSync = 5;
constexpr int kLdac = 17;
constexpr int kArm = 26;
constexpr int kStop = 27;
constexpr int kMiso = -1;   // not used
constexpr int kBoot = 0;
constexpr int kRgbLed = -1;
constexpr int kStatusLed = 2;  // the blue LED of most ESP32 DevKit boards
}  // namespace pins
#define BOARD_NAME "ESP32"
#endif

namespace limits {
constexpr uint32_t kTickUs = 500;          // sequencer period: 2 kHz
constexpr uint32_t kSpiHz = 20000000;      // AD5328 accepts up to 30 MHz
constexpr float kMaxFieldUT = 10.0f;       // absolute ceiling accepted from the app (at 20 mm)
constexpr float kMaxTestMA = 4.6f;         // DC test current limit (hardware cap is 4.54 mA)
constexpr uint32_t kMaxTestSeconds = 120;
constexpr uint32_t kMinIntervalS = 72u * 3600u;  // Shakti guidance: >= 72 h between sessions
}  // namespace limits

constexpr const char* kFirmwareVersion = "0.4.1";
constexpr int kProtocolVersion = 1;
