// AD5328 driver: 16-bit words over VSPI, manual SYNC, hardware LDAC.
#pragma once
#include <cstdint>

namespace dac {

// Configures pins and the DAC, then sets all outputs to mid-scale (0 V).
void begin(bool gain2x, bool bufferedRef);
// Re-sends reset + gain/reference words and mid-scale (used after settings change).
void reconfigure(bool gain2x, bool bufferedRef);
// Loads 8 input registers and pulses LDAC so all coils change at the same time.
// Call from one task only (the sequencer).
void writeAll(const uint16_t codes[8]);
void writeMidscale();

}  // namespace dac
