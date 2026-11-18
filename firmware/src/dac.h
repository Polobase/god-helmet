// The coil DAC: AD5328 (16-bit words over VSPI, manual SYNC, hardware LDAC), or on the helmet-driver board the
// DAC81408 (dac.cpp).
#pragma once
#include <cstdint>

class SPIClass;

namespace dac {

// Configures pins and the DAC, then sets all outputs to mid-scale (0 V).
void begin(bool gain2x, bool bufferedRef);
// Re-sends reset + gain/reference words and mid-scale (used after settings change).
void reconfigure(bool gain2x, bool bufferedRef);
// Loads 8 input registers and pulses LDAC so all coils change at the same time.
// Call from one task only (the sequencer).
void writeAll(const uint16_t codes[8]);
void writeMidscale();
// The DAC's SPI bus, for devices that share it (the SD card on the display
// board; the monitor ADCs of the helmet-driver board, in short transactions).
// The SD card never uses it while a session runs: transactions lock the bus.
SPIClass& spi();
// The helmet-driver board only (HAS_PCB_DRIVER): sets the DAC81408 up after an arm, every output at 0 mA, and reads
// the configuration back. False when it does not read back as written: nothing may be driven then.
bool configure();

}  // namespace dac
