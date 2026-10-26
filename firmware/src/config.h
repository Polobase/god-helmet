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
