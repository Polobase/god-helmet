#include "bleframe.h"

namespace bleframe {

bool Reassembler::push(const uint8_t* data, size_t len) {
  if (len < kHeader) return false;
  const uint8_t seq = data[0];
  const uint8_t flags = data[1];
  const char* payload = reinterpret_cast<const char*>(data + kHeader);
  const size_t n = len - kHeader;

  if (flags & kFirst) {
    buf_.clear();
    seq_ = seq;
    active_ = true;
    dropped_ = false;
  } else if (!active_ || seq != seq_) {
    // Continuation without a start: ignore. One report per lost message (its
    // packets share a seq), none for the tail of a message already dropped.
    if (!dropped_ || seq != dropSeq_) {
      drop_ = Drop::NoStart;
      dropSeq_ = seq;
    }
    dropped_ = true;
    return false;
  }
  if (buf_.size() + n > max_) {
    active_ = false;
    dropped_ = true;
    drop_ = Drop::TooLarge;
    dropSeq_ = seq_;
    std::string().swap(buf_);  // give the memory back, not only the contents
    return false;
  }
  buf_.append(payload, n);
  if (flags & kLast) {
    active_ = false;
    done_ = std::move(buf_);
    buf_.clear();
    return true;
  }
  return false;
}

void Reassembler::abandon() {
  std::string().swap(buf_);
  if (active_) dropSeq_ = seq_;
  active_ = false;
  dropped_ = true;
}

std::vector<std::string> split(const std::string& message, uint8_t seq, size_t packetSize) {
  std::vector<std::string> packets;
  const size_t chunk = packetSize > kHeader ? packetSize - kHeader : 1;
  size_t pos = 0;
  do {
    const size_t n = message.size() - pos < chunk ? message.size() - pos : chunk;
    uint8_t flags = 0;
    if (pos == 0) flags |= kFirst;
    if (pos + n >= message.size()) flags |= kLast;
    std::string p;
    p.reserve(kHeader + n);
    p.push_back(static_cast<char>(seq));
    p.push_back(static_cast<char>(flags));
    p.append(message, pos, n);
    packets.push_back(std::move(p));
    pos += n;
  } while (pos < message.size());
  return packets;
}

}  // namespace bleframe
