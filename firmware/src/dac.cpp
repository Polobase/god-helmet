#include "dac.h"

#include <Arduino.h>
#include <SPI.h>
#include <soc/gpio_struct.h>

#include "ad5328_words.h"
#include "config.h"

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
constexpr uint32_t kLdacMask = kHardLdac ? 1u << pins::kLdac : 0u;

inline void syncLow() { GPIO.out_w1tc = 1u << pins::kSync; }
inline void syncHigh() { GPIO.out_w1ts = 1u << pins::kSync; }
inline void ldacLow() { GPIO.out_w1tc = kLdacMask; }
inline void ldacHigh() { GPIO.out_w1ts = kLdacMask; }

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

void configure(bool gain2x, bool bufferedRef) {
  gSpi.beginTransaction(kSpiSettings);
  sendWord(ad5328::resetAllWord());
  sendWord(ad5328::gainRefWord(gain2x, bufferedRef));
  sendWord(ad5328::ldacWord(ad5328::LdacMode::High));  // DAC registers update on the LDAC pin only
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
  gSpi.begin(pins::kSclk, -1, pins::kMosi, -1);
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

void writeMidscale() {
  const uint16_t mid[8] = {ad5328::kMidscale, ad5328::kMidscale, ad5328::kMidscale, ad5328::kMidscale,
                           ad5328::kMidscale, ad5328::kMidscale, ad5328::kMidscale, ad5328::kMidscale};
  writeAll(mid);
}

}  // namespace dac
