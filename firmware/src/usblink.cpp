#include "usblink.h"

#include <Arduino.h>

#include <cstdarg>
#include <cstdio>
#include <new>
#include <string>

#include "rpc.h"
#include "sequencer.h"
#include "wire.h"

namespace usblink {
namespace {

constexpr uint32_t kBaud = 115200;      // ignored by the chips' own USB, which runs at full speed
constexpr size_t kRxBuffer = 8192;      // a request keeps arriving while the loop draws the screen
constexpr uint32_t kAttachedMs = 10000;  // the app asks for the status every 0.5-2 s
constexpr int kBytesPerLoop = 4096;     // the loop also serves Bluetooth and the touchscreen
constexpr size_t kHead = 96;            // of a request that is dropped: enough to name it in the error reply

struct Port {
  Stream* io;
  std::string line = {};
  bool overflow = false;      // this line is dropped; `line` keeps its first bytes
  const char* dropped = "";   // why
  bool attached = false;
  uint32_t lastRequestMs = 0;
};

#if ARDUINO_USB_CDC_ON_BOOT
// Serial is the chip's own USB socket, Serial0 the UART behind the board's USB bridge chip.
Port gPorts[] = {{&Serial}, {&Serial0}};
#else
Port gPorts[] = {{&Serial}};
#endif

void send(Port& p, const std::string& reply) {
  if (reply.empty()) return;
  p.io->write('@');
  p.io->write(reinterpret_cast<const uint8_t*>(reply.data()), reply.size());
  p.io->write('\n');
}

void answer(Port& p) {
  // Only lines that look like a request: log text typed in a terminal is ignored.
  if (p.line.empty() || p.line[0] != '{') return;
  if (p.overflow) {
    // Dropped, but not in silence: the app hears why at once.
    long long c = 0, id = 0;
    hlink::peekTag(p.line.data(), p.line.size(), c, id);
    send(p, hlink::errorReply(c, id, p.dropped));
    return;
  }
  bool valid = false;
  const std::string reply = rpc::handle(std::move(p.line), &valid);  // leaves p.line empty
  // Only a real request counts as "an app is there" (status LED, keepalive):
  // noise on the line or a boot message echoed back does not.
  if (valid) {
    p.attached = true;
    p.lastRequestMs = millis();
    seq::keepalive();
  }
  send(p, reply);
}

// Stops collecting this line; its start is kept for the error reply. Allocates nothing.
void drop(Port& p, const char* why) {
  p.overflow = true;
  p.dropped = why;
  if (p.line.size() > kHead) p.line.resize(kHead);
  p.line.shrink_to_fit();  // gives the large buffer back where it can
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
      // Running out of memory here must never restart the board: a session may be running.
      try {
        if (c == '\n') {
          answer(p);
        } else if (c != '\r' && !p.overflow) {
          if (p.line.size() >= rpc::kMaxRequestBytes) drop(p, "request too large (96 KB at most)");
          else p.line.push_back(static_cast<char>(c));
        }
      } catch (const std::bad_alloc&) {
        if (c != '\n') drop(p, "out of memory");  // else: not even room for the reply; the app times out
      }
      if (c == '\n') {
        p.overflow = false;
        if (p.line.capacity() > 1024) std::string().swap(p.line);  // give a big session's memory back
        else p.line.clear();
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
