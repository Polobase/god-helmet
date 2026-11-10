#include "ident.h"

#include <cstdio>

namespace resume {

void helmetId(uint64_t efuseMac, char out[13]) {
  unsigned b[6];
  for (int i = 0; i < 6; ++i) b[i] = static_cast<unsigned>((efuseMac >> (8 * i)) & 0xFF);
  std::snprintf(out, 13, "%02X%02X%02X%02X%02X%02X", b[0], b[1], b[2], b[3], b[4], b[5]);
}

const char* resetName(Reset reset) {
  switch (reset) {
    case Reset::PowerOn: return "power-on";
    case Reset::External: return "external reset";
    case Reset::Software: return "software restart";
    case Reset::Panic: return "panic";
    case Reset::IntWatchdog: return "interrupt watchdog";
    case Reset::TaskWatchdog: return "task watchdog";
    case Reset::Watchdog: return "watchdog";
    case Reset::DeepSleep: return "wake from sleep";
    case Reset::Brownout: return "brownout";
    case Reset::Sdio: return "sdio";
    case Reset::Usb: return "usb";
    case Reset::Jtag: return "jtag";
    default: return "unknown";
  }
}

}  // namespace resume
