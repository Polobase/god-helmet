#include "outbox.h"

#include "bleframe.h"

namespace hlink {

void Outbox::push(std::string message, bool replaceable) {
  if (replaceable) {
    for (Job& j : jobs_) {
      if (j.replaceable && !j.started) {
        j.message = std::move(message);
        return;
      }
    }
  }
  Job j;
  j.message = std::move(message);
  j.replaceable = replaceable;
  jobs_.push_back(std::move(j));
}

const std::string* Outbox::next(uint32_t nowMs, size_t payload) {
  while (!jobs_.empty()) {
    Job& j = jobs_.front();
    if (!j.started) {
      j.packets = bleframe::split(j.message, seq_++, payload);
      std::string().swap(j.message);
      j.started = true;
      j.dueMs = nowMs;
      j.progressMs = nowMs;
    }
    if (nowMs - j.progressMs > kStallMs) {
      jobs_.pop_front();  // the link takes nothing any more
      continue;
    }
    if (static_cast<int32_t>(nowMs - j.dueMs) < 0) return nullptr;
    return &j.packets[j.index];
  }
  return nullptr;
}

void Outbox::sent(uint32_t nowMs) {
  if (jobs_.empty()) return;
  Job& j = jobs_.front();
  if (++j.index >= j.packets.size()) {
    jobs_.pop_front();
    return;
  }
  j.progressMs = nowMs;
  j.dueMs = nowMs + kGapMs;
}

void Outbox::congested(uint32_t nowMs) {
  if (!jobs_.empty()) jobs_.front().dueMs = nowMs + kRetryMs;
}

void Outbox::clear() { jobs_.clear(); }

}  // namespace hlink
