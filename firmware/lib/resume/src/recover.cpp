#include "recover.h"

#include <cstdio>

namespace resume {

Closure decide(const Progress* record, Reset reset) {
  Closure c;
  if (record == nullptr || record->logId == 0) return c;
  const RunState state = static_cast<RunState>(record->state);
  if (state == RunState::None) return c;
  c.close = true;
  c.logId = record->logId;
  c.elapsedMs = record->elapsedMs;
  c.fieldUT = record->fieldUT;
  c.fieldChanges = record->fieldChanges;
  c.skips = record->skips;
  if (state == RunState::Ended) {
    c.completed = record->completed != 0;
    std::snprintf(c.reason, sizeof c.reason, "%s", record->reason);
  } else {
    std::snprintf(c.reason, sizeof c.reason, "restart: %s", resetName(reset));
  }
  return c;
}

}  // namespace resume
