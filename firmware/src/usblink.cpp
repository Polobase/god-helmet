#include "usblink.h"

#include <Arduino.h>

#include <cstdarg>
#include <cstdio>
#include <string>

#include "rpc.h"
#include "sequencer.h"

namespace usblink {
namespace {

constexpr uint32_t kBaud = 115200;      // ignored by the chips' own USB, which runs at full speed
constexpr size_t kRxBuffer = 8192;      // a request keeps arriving while the loop draws the screen
constexpr uint32_t kAttachedMs = 10000;  // the app asks for the status every 0.5-2 s
constexpr int kBytesPerLoop = 4096;     // the loop also serves Bluetooth and the touchscreen

struct Port {
  Stream* io;
  std::string line = {};
  bool overflow = false;
  bool attached = false;
  uint32_t lastRequestMs = 0;
};

#if ARDUINO_USB_CDC_ON_BOOT
// Serial is the chip's own USB socket, Serial0 the UART behind the board's USB bridge chip.
Port gPorts[] = {{&Serial}, {&Serial0}};
#else
Port gPorts[] = {{&Serial}};
#endif

void answer(Port& p) {
  // Only lines that look like a request: log text typed in a terminal is ignored.
  if (p.overflow || p.line.empty() || p.line[0] != '{') return;
  p.attached = true;
  p.lastRequestMs = millis();
  seq::keepalive();
  const std::string reply = rpc::handle(p.line);
  p.io->write('@');
  p.io->write(reinterpret_cast<const uint8_t*>(reply.data()), reply.size());
  p.io->write('\n');
}

}  // namespace

void begin() {
#if ARDUINO_USB_CDC_ON_BOOT
  Serial0.setRxBufferSize(kRxBuffer);  // UART: before begin()
  Serial0.begin(kBaud);
  Serial.setRxBufferSize(kRxBuffer);
  Serial.setTxTimeoutMs(20);  // an app that stops reading never holds up the loop for long
  Serial.begin(kBaud);
#else
  Serial.setRxBufferSize(kRxBuffer);
  Serial.begin(kBaud);
#endif
}

void loop() {
  for (Port& p : gPorts) {
    for (int budget = kBytesPerLoop; budget > 0 && p.io->available() > 0; --budget) {
      const int c = p.io->read();
      if (c < 0) break;
      if (c == '\n') {
        answer(p);
        p.overflow = false;
        if (p.line.capacity() > 1024) std::string().swap(p.line);  // give a big session's memory back
        else p.line.clear();
      } else if (c != '\r' && !p.overflow) {
        if (p.line.size() >= rpc::kMaxRequestBytes) {
          p.overflow = true;  // dropped: the app times out on it
          std::string().swap(p.line);
        } else {
          p.line.push_back(static_cast<char>(c));
        }
      }
    }
  }
}

int connections() {
  int n = 0;
  for (const Port& p : gPorts)
    if (p.attached && millis() - p.lastRequestMs < kAttachedMs) ++n;
  return n;
}

void logf(const char* fmt, ...) {
  char buf[256];
  va_list args;
  va_start(args, fmt);
  const int len = std::vsnprintf(buf, sizeof buf, fmt, args);
  va_end(args);
  if (len <= 0) return;
  const size_t n = len < static_cast<int>(sizeof buf) ? static_cast<size_t>(len) : sizeof buf - 1;
  for (Port& p : gPorts) p.io->write(reinterpret_cast<const uint8_t*>(buf), n);
}

}  // namespace usblink
