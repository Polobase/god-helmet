#include "dac.h"

#include <Arduino.h>
#include <SPI.h>

#include "ad5328_words.h"
#include "config.h"
#include "fastio.h"
#ifdef HAS_PCB_DRIVER
#include "board.h"
#endif

#ifdef HAS_PCB_DRIVER
// The helmet-driver board (rev B): one DAC81408 for the eight coils, 24-bit frames (lib/pcb/src/board.h), on the
// SPI bus it shares with the two monitor ADCs (pcbboard.cpp; SPI transactions keep them apart). Its outputs are
// synchronous: the data registers take the codes, then the LDAC pin (active low) loads all eight at once. The board
// holds the DAC in RESET while not armed (every output tied to ground, 0 mA), so it is configured after every arm:
// configure(), called by the sequencer once the rails are up.
namespace dac {
namespace {

SPIClass gSpi(FSPI);
const SPISettings kSpiSettings(limits::kSpiHz, MSBFIRST, SPI_MODE1);  // SDI taken on SCLK falling edges
// Reading back: SDO changes on SCLK rising edges (FSDO 0, the reset value) and is read on falling ones; slower.
const SPISettings kReadSettings(8000000, MSBFIRST, SPI_MODE1);

uint32_t frame(uint32_t word) {
  fastWrite<pins::kCsDac>(false);
  const uint32_t hi = gSpi.transfer(static_cast<uint8_t>(word >> 16));
  const uint32_t lo = gSpi.transfer16(static_cast<uint16_t>(word));
  fastWrite<pins::kCsDac>(true);
  return (hi << 16) | lo;
}

void pulseLdac() {
  fastWrite<pins::kLdac>(false);  // at least 10 ns low
  delayMicroseconds(1);
  fastWrite<pins::kLdac>(true);
}

}  // namespace

void begin(bool, bool) {
  pinMode(pins::kCsDac, OUTPUT);
  digitalWrite(pins::kCsDac, HIGH);
  pinMode(pins::kLdac, OUTPUT);
  digitalWrite(pins::kLdac, HIGH);
  gSpi.begin(pins::kSclk, pins::kMiso, pins::kMosi, -1);
  // Nothing to write: the DAC sits in RESET until the board is armed.
}

// No gain or reference words: configure() sets the DAC up after every arm.
void reconfigure(bool, bool) {}

bool configure() {
  uint32_t f[pcb::kDacConfigFrames];
  pcb::dac81408Config(f);
  gSpi.beginTransaction(kSpiSettings);
  for (uint32_t w : f) {
    frame(w);
    delayMicroseconds(3);  // tDACWAIT: 2.4 µs between output updates (the data writes update at once here)
  }
  gSpi.endTransaction();
  // Read back: each read command, then a NOP frame that brings its value (SLASER3A Table 3).
  bool ok = true;
  gSpi.beginTransaction(kReadSettings);
  for (const pcb::DacExpect& e : pcb::kDacExpect) {
    frame(pcb::dac81408Read(e.reg));
    uint16_t v = 0;
    const bool got = pcb::dac81408Readback(frame(pcb::dac81408Write(pcb::kDacNop, 0)), e.reg, v);
    ok = ok && got && (v & e.mask) == e.value;
  }
  gSpi.endTransaction();
  return ok;
}

void writeAll(const uint16_t codes[8]) {
  gSpi.beginTransaction(kSpiSettings);
  for (uint8_t ch = 0; ch < 8; ++ch)
    frame(pcb::dac81408Write(static_cast<uint8_t>(pcb::kDacData0 + ch), pcb::dac81408Data(codes[ch])));
  gSpi.endTransaction();
  pulseLdac();
}

void writeMidscale() {
  const uint16_t mid[8] = {0x800, 0x800, 0x800, 0x800, 0x800, 0x800, 0x800, 0x800};
  writeAll(mid);
}

SPIClass& spi() { return gSpi; }

}  // namespace dac

#else

namespace dac {
namespace {

#if CONFIG_IDF_TARGET_ESP32
SPIClass gSpi(VSPI);
#else
SPIClass gSpi(FSPI);
#endif
const SPISettings kSpiSettings(limits::kSpiHz, MSBFIRST, SPI_MODE1);  // data latched on SCLK falling edge

// Boards without a free pin tie LDAC high and latch with the software
// "single update" word instead (datasheet: LDAC pin high, mode bits as required).
constexpr bool kHardLdac = pins::kLdac >= 0;

inline void syncLow() { fastWrite<pins::kSync>(false); }
inline void syncHigh() { fastWrite<pins::kSync>(true); }
inline void ldacLow() { fastWrite<pins::kLdac>(false); }
inline void ldacHigh() { fastWrite<pins::kLdac>(true); }

// One 16-bit frame; SYNC must return high after the 16th falling SCLK edge.
inline void sendWord(uint16_t word) {
  syncLow();
  gSpi.transfer16(word);
  syncHigh();
}

void pulseLdac() {
  ldacLow();
  delayMicroseconds(1);  // t9 >= 20 ns
  ldacHigh();
}

// All 8 DAC registers take their input registers at once. Call inside the
// SPI transaction; the hardware pulse follows endTransaction().
inline void latchWord() {
  if (!kHardLdac) sendWord(ad5328::ldacWord(ad5328::LdacMode::SingleUpdate));
}
inline void latchPin() {
  if (kHardLdac) pulseLdac();
}

// No reset word: a reset loads code 0, which on the ±10 V module is -10 V on
// every coil until the mid-scale words follow. Each control register is set
// explicitly instead, so a warm reset or a settings change never passes
// through full scale.
void configure(bool gain2x, bool bufferedRef) {
  gSpi.beginTransaction(kSpiSettings);
  sendWord(ad5328::gainRefWord(gain2x, bufferedRef));
  sendWord(ad5328::ldacWord(ad5328::LdacMode::High));  // DAC registers update on the LDAC pin only
  sendWord(ad5328::powerDownWord(0));                   // all channels powered (normal output)
  for (uint8_t ch = 0; ch < ad5328::kChannels; ++ch) sendWord(ad5328::dacWord(ch, ad5328::kMidscale));
  latchWord();
  gSpi.endTransaction();
  latchPin();
}

}  // namespace

void begin(bool gain2x, bool bufferedRef) {
  pinMode(pins::kSync, OUTPUT);
  syncHigh();
  if (kHardLdac) {
    pinMode(pins::kLdac, OUTPUT);
    ldacHigh();
  }
  gSpi.begin(pins::kSclk, pins::kMiso, pins::kMosi, -1);  // MISO only where an SD card shares the bus
  configure(gain2x, bufferedRef);
}

void reconfigure(bool gain2x, bool bufferedRef) { configure(gain2x, bufferedRef); }

void writeAll(const uint16_t codes[8]) {
  gSpi.beginTransaction(kSpiSettings);
  for (uint8_t ch = 0; ch < ad5328::kChannels; ++ch) sendWord(ad5328::dacWord(ch, codes[ch]));
  latchWord();
  gSpi.endTransaction();
  latchPin();
}

SPIClass& spi() { return gSpi; }

void writeMidscale() {
  const uint16_t mid[8] = {ad5328::kMidscale, ad5328::kMidscale, ad5328::kMidscale, ad5328::kMidscale,
                           ad5328::kMidscale, ad5328::kMidscale, ad5328::kMidscale, ad5328::kMidscale};
  writeAll(mid);
}

}  // namespace dac

#endif  // HAS_PCB_DRIVER
