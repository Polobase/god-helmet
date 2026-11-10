// How full the internal filesystem is, measured only while no session runs.
//
// Asking LittleFS walks the whole filesystem with the flash cache switched
// off, which holds up the 2 kHz output for that long. An app asks for these
// numbers every time it connects ("hello"), also in the middle of a session,
// so they are measured while idle and remembered.
#pragma once
#include <cstdint>

namespace storage {

void begin();    // after the filesystem is mounted
void changed();  // a file was written or removed
void loop();     // measures again when something changed and nothing runs
uint32_t usedBytes();
uint32_t totalBytes();

}  // namespace storage
