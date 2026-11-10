// How far the running session has got, kept where a restart does not erase it.
//
// The record lives in RTC memory: a crash, a watchdog or a software restart
// leaves it intact, and writing it costs no flash access (which would stall
// the outputs). A power cut clears it. After a restart the firmware reads it
// and closes the session's log entry with the time it really ran.
//
// It is kept twice and written alternately; each copy carries a counter and a
// checksum. A restart in the middle of a write leaves the other copy good.
#pragma once
#include <cstdint>

namespace resume {

enum class RunState : uint8_t { None = 0, Running = 1, Ended = 2 };

struct Progress {
  uint32_t magic = 0;        // kProgressMagic: also the layout's version
  uint32_t generation = 0;   // counts writes; the higher valid copy wins
  uint32_t bootId = 0;
  uint32_t logId = 0;
  uint32_t elapsedMs = 0;
  uint32_t startEpoch = 0;
  float fieldUT = 0;
  uint16_t fieldChanges = 0;
  uint16_t skips = 0;
  uint8_t state = 0;         // RunState
  uint8_t completed = 0;
  char reason[34] = {0};     // why it ended (state Ended)
  uint32_t crc = 0;
};
static_assert(sizeof(Progress) == 72, "Progress layout changed: bump kProgressMagic");

constexpr uint32_t kProgressMagic = 0x48504731;  // "HPG1"

uint32_t crcOf(const Progress& p);
void seal(Progress& p);  // sets the magic and the checksum
bool valid(const Progress& p);

// Index of the newest valid copy, or -1 when neither is.
int newest(const Progress slots[2]);
// Writes `next` over the older (or invalid) copy, with the next counter.
void commit(Progress slots[2], Progress next);
// Marks both copies empty.
void clear(Progress slots[2]);

}  // namespace resume
