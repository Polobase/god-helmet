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

// Why a message was thrown away.
enum class Drop : uint8_t { None, NoStart, TooLarge };

class Reassembler {
 public:
  explicit Reassembler(size_t maxBytes) : max_(maxBytes) {}

  // Feeds one packet; returns true when a complete message is available.
  bool push(const uint8_t* data, size_t len);
  std::string take() { return std::move(done_); }
  // True if the last message was dropped for exceeding maxBytes or for a
  // missing FIRST packet.
  bool dropped() const { return dropped_; }
  // The reason, reported once per dropped message (then None until the next
  // drop), so the sender can be told once.
  Drop takeDrop() {
    const Drop d = drop_;
    drop_ = Drop::None;
    return d;
  }
  // Gives up the message being received (its memory too) without a report:
  // the caller has told the sender already. Its remaining packets are ignored.
  void abandon();

 private:
  size_t max_;
  std::string buf_;
  std::string done_;
  int seq_ = -1;
  bool active_ = false;
  bool dropped_ = false;
  Drop drop_ = Drop::None;
  int dropSeq_ = -1;  // seq of the message whose drop was last reported
};

// Splits `message` into packets of at most `packetSize` bytes (header included).
std::vector<std::string> split(const std::string& message, uint8_t seq, size_t packetSize);

}  // namespace bleframe
