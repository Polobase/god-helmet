// The helmet-driver board's own hardware beyond the coil DAC (dac.cpp): the latches, the ESP32's ADC pins, the
// two monitor ADCs (ADS8688, daisy chain) on the coil DAC's SPI bus, and the isolated tES island on its own SPI bus. Only on that board (HAS_PCB_DRIVER);
// the conversions behind it are in lib/pcb and unit-tested on the host.
//
// Who touches what:
//   - the sequencer task (2 kHz): the latch inputs, the island's DAC and heartbeat (tesWrite, tesBeat);
//   - the monitor task started by begin() (about 100 Hz): the coil ADCs, the island's ADC, the ESP32's ADC pins;
//   - everyone else reads the snapshot.
#pragma once
#include "config.h"

#ifdef HAS_PCB_DRIVER
#include <cstdint>

#include "board.h"
#include "tes.h"

namespace pcbboard {

void begin();

// ---- latches (read directly, any task) ----
bool tripLatched();     // a coil current crossed the ceiling + 10 %
bool stopLatched();     // the STOP button or jack
bool tesFaultLatched(); // the island's 4.64 mA trip
// Pulses CLEAR and reads back: true when both coil latches are clear (a latch whose cause persists stays set).
// Only while nothing runs.
bool clearLatches();

// ---- monitor snapshot ----
struct Snapshot {
  bool valid = false;           // the coil ADCs answered
  uint32_t ms = 0;              // when it was taken
  pcb::Ceiling ceiling = pcb::Ceiling::Unknown;
  float vth = 0;                // the threshold voltage the ceiling is read from
  float p15 = 0, n15 = 0;       // rails
  float usbMA = 0;              // what the USB-C source offers (0 = unknown)
  bool usbHost = false;         // a computer, not a power bank, on the USB socket
  float coilMA[8] = {0};        // measured currents
  float coilOutV[8] = {0};      // driver outputs
  float coilRmsMA[8] = {0};     // RMS since resetCoilRms()
  bool tesAdcOk = false;        // the island's ADC echoed its range settings (the island has power)
  float tesMA[tes::kChannels] = {0};    // measured (VS)
  float tesSetMA[tes::kChannels] = {0}; // what the source receives (TSP)
  float tesPairV[tes::kChannels] = {0}; // electrode A minus B
  float tesRmsV[tes::kChannels] = {0}, tesRmsMA[tes::kChannels] = {0};  // since resetTesRms()
};
Snapshot snapshot();
void resetCoilRms();
void resetTesRms();
// The ceiling the switch sets, freshly read (slow: ESP32 ADC). 0 = unknown, nothing may run.
float ceilingMA();

// ---- the tES island (sequencer task) ----
void tesEnable(bool on);         // TES_EN; the relays also need the heartbeat and no trip
void tesWrite(const float mA[tes::kChannels]);  // both channels' currents, loaded together
void tesBeat();                  // toggles the heartbeat line: call at every tick while tES runs
// The monitor's verdict on a running tES session (tes::watchStep), or nullptr; cleared by tesWatchReset().
const char* tesWatchReason();
void tesWatchReset(bool active);

}  // namespace pcbboard

#endif  // HAS_PCB_DRIVER
