// AD5328 16-bit serial words (datasheet Rev. F, pp. 16-18).
//
// DAC write:  0 A2 A1 A0 D11..D0            (bit 15 = 0, address A=0 .. H=7)
// Control:    1 C1 C0 ...                     (bit 15 = 1)
//   00 gain/reference: bit5 GAIN E-H, bit4 GAIN A-D, bit3 BUF E-H, bit2 BUF A-D,
//                      bit1 VDD E-H,  bit0 VDD A-D
//   01 LDAC mode:      bits1:0  00 low, 01 high (default), 10 single update
//   10 power-down:     bits7:0  channel mask H..A (outputs go three-state!)
//   11 reset:          bit12 0 = DAC data reset, 1 = data + control reset
#pragma once
#include <cstdint>

namespace ad5328 {

constexpr uint16_t kMidscale = 0x800;
constexpr uint16_t kMaxCode = 0xFFF;
constexpr int kChannels = 8;

constexpr uint16_t dacWord(uint8_t channel, uint16_t code) {
  return static_cast<uint16_t>(((channel & 0x7u) << 12) | (code & 0x0FFFu));
}

// Same settings applied to both DAC groups (A-D and E-H).
constexpr uint16_t gainRefWord(bool gain2x, bool bufferedRef, bool vddAsRef = false) {
  return static_cast<uint16_t>(0x8000u | (gain2x ? 0x30u : 0u) | (bufferedRef ? 0x0Cu : 0u) |
                               (vddAsRef ? 0x03u : 0u));
}

enum class LdacMode : uint8_t { Low = 0, High = 1, SingleUpdate = 2 };

constexpr uint16_t ldacWord(LdacMode mode) {
  return static_cast<uint16_t>(0xA000u | static_cast<uint16_t>(mode));
}

constexpr uint16_t powerDownWord(uint8_t channelMask) {
  return static_cast<uint16_t>(0xC000u | channelMask);
}

constexpr uint16_t resetDataWord() { return 0xE000u; }
constexpr uint16_t resetAllWord() { return 0xF000u; }

}  // namespace ad5328
