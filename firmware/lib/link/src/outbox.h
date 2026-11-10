// Messages waiting to go out on one Bluetooth connection, one packet at a time.
//
// The loop task asks next() for the packet that is due, tries to send it and
// reports what happened: sent (the following packet is due after a short gap,
// so the radio's queue can drain), congested (the same packet again a little
// later), or gone (the connection is closed: everything is dropped). A message
// that makes no progress for kStallMs is dropped, so a dead link cannot hold
// memory for ever. Messages are split into packets only when their turn
// comes: the packet size may still change while they wait (MTU exchange).
#pragma once
#include <cstdint>
#include <deque>
#include <string>
#include <vector>

namespace hlink {

class Outbox {
 public:
  static constexpr uint32_t kGapMs = 8;       // between packets of one message
  static constexpr uint32_t kRetryMs = 20;    // after "congested"
  static constexpr uint32_t kStallMs = 5000;  // no progress: drop the message

  // `replaceable`: a newer message of the same kind takes the place of one
  // that has not started yet (status: only the latest is worth sending).
  void push(std::string message, bool replaceable = false);
  // The packet to send now, or nullptr. `payload` is the packet size for a
  // message that starts now.
  const std::string* next(uint32_t nowMs, size_t payload);
  void sent(uint32_t nowMs);
  void congested(uint32_t nowMs);
  void clear();
  bool empty() const { return jobs_.empty(); }
  size_t size() const { return jobs_.size(); }

 private:
  struct Job {
    std::string message;
    bool replaceable = false;
    bool started = false;
    std::vector<std::string> packets;
    size_t index = 0;
    uint32_t dueMs = 0;
    uint32_t progressMs = 0;
  };
  std::deque<Job> jobs_;
  uint8_t seq_ = 0;
};

}  // namespace hlink
