// How many output periods have passed, from the clock.
//
// The sequencer used to count timer wake-ups. When the processor is held up
// (a flash write stops everything for a moment) wake-ups are lost, the
// session's own clock falls behind real time, and nobody sees it. Counting
// periods from the microsecond clock keeps the session on time and makes
// every stall show up as an overrun.
#pragma once
#include <cstdint>

namespace resume {

// Whole periods since `lastUs`; advances `lastUs` by exactly that many, so no
// fraction is lost. A clock that went backwards counts as nothing.
inline uint32_t periodsSince(uint64_t nowUs, uint64_t& lastUs, uint32_t periodUs) {
  if (nowUs <= lastUs || periodUs == 0) return 0;
  const uint64_t n = (nowUs - lastUs) / periodUs;
  lastUs += n * periodUs;
  return n > 0xFFFFFFFFull ? 0xFFFFFFFFu : static_cast<uint32_t>(n);
}

}  // namespace resume
