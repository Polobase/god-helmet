// Framing for JSON messages over BLE characteristics.
//
// A BLE write/notification carries at most MTU-3 bytes, so each message is
// split into packets:  [seq:u8][flags:u8][payload ...]
//   flags bit0 = FIRST packet of a message, bit1 = LAST packet.
// All packets of one message share `seq`. A FIRST packet discards any
// unfinished message. The web app (webapp/src/ble/frame.js) mirrors this.
#pragma once
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace bleframe {

constexpr uint8_t kFirst = 0x01;
constexpr uint8_t kLast = 0x02;
constexpr size_t kHeader = 2;

class Reassembler {
 public:
  explicit Reassembler(size_t maxBytes) : max_(maxBytes) {}

  // Feeds one packet; returns true when a complete message is available.
  bool push(const uint8_t* data, size_t len);
  std::string take() { return std::move(done_); }
  // True if the last message was dropped for exceeding maxBytes or for a
  // missing FIRST packet.
  bool dropped() const { return dropped_; }

 private:
  size_t max_;
  std::string buf_;
  std::string done_;
  int seq_ = -1;
  bool active_ = false;
  bool dropped_ = false;
};

// Splits `message` into packets of at most `packetSize` bytes (header included).
std::vector<std::string> split(const std::string& message, uint8_t seq, size_t packetSize);

}  // namespace bleframe
