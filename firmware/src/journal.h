// What a restart must not lose: who this helmet is, why it started, and how
// far the session had got that was running when it went down.
//
// While a session runs, the sequencer keeps a small progress record in RTC
// memory (lib/resume/progress.h): no flash access, and a crash, a watchdog or
// a software restart leaves it intact. At the next start the log entry of that
// session is closed from it, with the time it really ran and the reason
// "restart: <why>". After a power cut nothing survives; an entry that is
// still open is then closed as "power lost".
#pragma once
#include <cstdint>

#include "ident.h"
#include "progress.h"

namespace journal {

// Early in setup(), before the sequencer exists: reads the reset reason and
// the record the last run left behind, and numbers this start.
void begin();

const char* helmetId();     // 12 hex digits, fixed for this board
uint32_t bootId();          // a new number at every start (counts up)
resume::Reset reset();
const char* resetReason();  // "power-on", "panic", "task watchdog", ...
uint32_t uptimeS();

// In setup(), once the filesystem is mounted and before any request is
// served: closes the log entries the last run left open, then empties the record.
void recover();
// The entry closed by recover() at this start, 0 = none.
uint32_t recoveredLogId();

// Stores the running session's progress. Sequencer task only.
void save(const resume::Progress& progress);

}  // namespace journal
