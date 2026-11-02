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
}  // namespace pins
#define BOARD_NAME "ESP32-S3"
#elif defined(BOARD_ESP32E_LCD28)
// "2.8inch ESP32-32E Display" (LCDwiki E32R28T / E32N28T, ESP32-D0WD, 4 MB).
// Almost every pin drives the LCD, touch, SD card, speaker or RGB LED, so the
// AD5328 sits on the 4-pin SPI peripheral header (shared with the SD card)
// and the display stays dark. See docs/WIRING.md.
namespace pins {
constexpr int kSclk = 18;   // SPI header SCK
constexpr int kMosi = 23;   // SPI header MOSI
constexpr int kSync = 27;   // SPI header CS
constexpr int kLdac = -1;   // no free pin: module LDAC tied to 3.3 V, software single update
constexpr int kArm = 19;    // SPI header MISO (the AD5328 never answers) -> PhotoMOS LED, 1 kΩ pull-down
constexpr int kStop = 35;   // expansion header, input only: external 10 kΩ pull-up to 3.3 V
constexpr int kStop2 = 0;   // BOOT button as a second STOP (on-board pull-up)
// On-board parts held quiet: dark screen, silent speaker, SD card off the shared bus.
constexpr int kBacklight = 21;   // high = on
constexpr int kAudioEnable = 4;  // low = amplifier on
constexpr int kAudioOut = 26;
constexpr int kSdCs = 5;
constexpr int kLcdCs = 15;
constexpr int kTouchCs = 33;
constexpr int kLedR = 22, kLedG = 16, kLedB = 17;  // RGB LED, common anode: low = on
}  // namespace pins
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
