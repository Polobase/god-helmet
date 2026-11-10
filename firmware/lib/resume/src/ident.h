// Who this helmet is, and why it last started.
#pragma once
#include <cstdint>

namespace resume {

// The helmet's fixed id: the chip's factory MAC address as 12 hex digits
// (upper case), in the order printed on the module. Its last four digits are
// the suffix of the default Bluetooth name "GodHelmet-XXXX".
// `efuseMac` as ESP.getEfuseMac() returns it (first MAC byte in the low byte).
void helmetId(uint64_t efuseMac, char out[13]);

enum class Reset : uint8_t {
  PowerOn, External, Software, Panic, IntWatchdog, TaskWatchdog, Watchdog, DeepSleep, Brownout, Sdio, Usb, Jtag, Unknown,
};

// "power-on", "external reset", "software restart", "panic", "interrupt
// watchdog", "task watchdog", "watchdog", "wake from sleep", "brownout",
// "sdio", "usb", "jtag", "unknown"
const char* resetName(Reset reset);

}  // namespace resume
