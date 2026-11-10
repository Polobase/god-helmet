// After a restart: what to write into the log entry of the session that was
// running when the helmet went down.
#pragma once
#include <cstdint>

#include "ident.h"
#include "progress.h"

namespace resume {

struct Closure {
  bool close = false;        // there is an entry to close
  uint32_t logId = 0;
  uint32_t elapsedMs = 0;
  bool completed = false;
  float fieldUT = 0;
  uint16_t fieldChanges = 0;
  uint16_t skips = 0;
  char reason[40] = {0};
};

// `record`: the newest valid progress record, or nullptr when none survived.
//   still running  -> closed with the time it had run, "restart: <why>"
//   already ended  -> closed with its own reason (the restart came between
//                     the end of the session and the write to the log)
//   none, or a test (logId 0) -> nothing to close from the record; entries
//                     that are still open are then marked "power lost".
Closure decide(const Progress* record, Reset reset);

}  // namespace resume
