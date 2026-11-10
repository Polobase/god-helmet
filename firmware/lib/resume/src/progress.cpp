#include "progress.h"

#include <cstddef>
#include <cstring>

namespace resume {
namespace {

uint32_t crc32(const uint8_t* data, size_t n) {
  uint32_t crc = 0xFFFFFFFFu;
  for (size_t i = 0; i < n; ++i) {
    crc ^= data[i];
    for (int b = 0; b < 8; ++b) crc = (crc >> 1) ^ (0xEDB88320u & (0u - (crc & 1u)));
  }
  return ~crc;
}

}  // namespace

uint32_t crcOf(const Progress& p) { return crc32(reinterpret_cast<const uint8_t*>(&p), offsetof(Progress, crc)); }

void seal(Progress& p) {
  p.magic = kProgressMagic;
  p.reason[sizeof p.reason - 1] = '\0';
  p.crc = crcOf(p);
}

bool valid(const Progress& p) {
  if (p.magic != kProgressMagic || p.crc != crcOf(p)) return false;
  if (p.state > static_cast<uint8_t>(RunState::Ended) || p.completed > 1) return false;
  return p.reason[sizeof p.reason - 1] == '\0';
}

int newest(const Progress slots[2]) {
  const bool a = valid(slots[0]), b = valid(slots[1]);
  if (a && b) return static_cast<int32_t>(slots[1].generation - slots[0].generation) > 0 ? 1 : 0;
  return a ? 0 : b ? 1 : -1;
}

void commit(Progress slots[2], Progress next) {
  const int cur = newest(slots);
  const int target = cur < 0 ? 0 : 1 - cur;
  next.generation = cur < 0 ? 1 : slots[cur].generation + 1;
  seal(next);
  std::memcpy(&slots[target], &next, sizeof next);
}

void clear(Progress slots[2]) { std::memset(slots, 0, 2 * sizeof(Progress)); }

}  // namespace resume
