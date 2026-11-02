// Board wiring and fixed limits.
#pragma once
#include <cstdint>

#if CONFIG_IDF_TARGET_ESP32S3
// ESP32-S3-DevKitC-1 (N8R8 / N16R8). Avoids strapping pins (0, 3, 45, 46),
// USB (19, 20) and the octal flash/PSRAM pins (26-37). FSPI default pins.
namespace pins {
constexpr int kSclk = 12;   // -> AD5328 module CLK
constexpr int kMosi = 11;   // -> DIN
constexpr int kSync = 10;   // -> SYNC (manual chip select, high between words)
constexpr int kLdac = 9;    // -> LDAC (pulse low: all 8 outputs update together)
constexpr int kArm = 4;     // -> PhotoMOS LED via 330 Ω, 10 kΩ pull-down: closes coil return
constexpr int kStop = 5;    // <- STOP button to GND (internal pull-up)
constexpr int kMiso = -1;   // not used
}  // namespace pins
#define BOARD_NAME "ESP32-S3"
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

constexpr const char* kFirmwareVersion = "0.2.0";
constexpr int kProtocolVersion = 1;
