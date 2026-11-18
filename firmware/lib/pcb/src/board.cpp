#include "board.h"

#include <cmath>

namespace pcb {

// ---- DAC81408 ----

uint32_t dac81408Write(uint8_t reg, uint16_t data) { return (static_cast<uint32_t>(reg & 0x3F) << 16) | data; }

uint32_t dac81408Read(uint8_t reg) { return 0x800000u | (static_cast<uint32_t>(reg & 0x3F) << 16); }

bool dac81408Readback(uint32_t f, uint8_t reg, uint16_t& data) {
  if ((f & 0x800000u) == 0 || ((f >> 16) & 0x3F) != (reg & 0x3Fu)) return false;
  data = static_cast<uint16_t>(f);
  return true;
}

uint16_t dac81408Data(uint16_t code12) {
  if (code12 > 0xFFF) code12 = 0xFFF;
  return static_cast<uint16_t>(code12 << 4);  // 0x800 -> 8000h (0 V), 0xFFF -> FFF0h, 0 -> 0000h
}

namespace {
// Register values (SLASER3A 9.6): SPICONFIG 0A24h at reset with DEV-PWDWN (bit 5) cleared; GENCONFIG 7F00h with
// REF-PWDWN (bit 14) cleared, the read-only bits 13-8 as they read; DACRANGEn: 1110 = ±2.5 V in each nibble;
// SYNCCONFIG: DAC0-7-SYNC-EN are bits 4-11; DACPWDWN FFFFh with DAC0-7-PWDWN (bits 4-11) cleared.
constexpr uint16_t kSpiConfigOn = 0x0A04, kGenConfigRefOn = 0x3F00, kRangeAll2V5 = 0xEEEE, kSyncAll = 0x0FF0,
                   kPowerDownNone = 0xF00F;
}  // namespace

void dac81408Config(uint32_t f[kDacConfigFrames]) {
  int i = 0;
  f[i++] = dac81408Write(kDacSpiConfig, kSpiConfigOn);
  f[i++] = dac81408Write(kDacGenConfig, kGenConfigRefOn);
  f[i++] = dac81408Write(kDacRange0, kRangeAll2V5);  // DAC7-DAC4
  f[i++] = dac81408Write(kDacRange1, kRangeAll2V5);  // DAC3-DAC0
  for (uint8_t ch = 0; ch < 8; ++ch) f[i++] = dac81408Write(static_cast<uint8_t>(kDacData0 + ch), kDacMidscale);
  f[i++] = dac81408Write(kDacSyncConfig, kSyncAll);
  f[i++] = dac81408Write(kDacPowerDown, kPowerDownNone);
}

const DacExpect kDacExpect[kDacExpects] = {
    {kDacDeviceId, 0xFFFC, 0x298 << 2},  // DEVICEID bits 15-2: 298h (DAC81408); bits 1-0 the version
    {kDacStatus, 0x0005, 0x0000},        // no thermal alarm, no CRC alarm (DAC-BUSY is momentary)
    {kDacSpiConfig, 0x0E7E, kSpiConfigOn},
    {kDacGenConfig, 0x403C, 0x0000},     // reference on, no differential pairs
    {kDacSyncConfig, 0x0FF0, kSyncAll},
    {kDacPowerDown, 0x0FF0, 0x0000},
    {kDacData0 + 0, 0xFFFF, kDacMidscale}, {kDacData0 + 1, 0xFFFF, kDacMidscale},
    {kDacData0 + 2, 0xFFFF, kDacMidscale}, {kDacData0 + 3, 0xFFFF, kDacMidscale},
    {kDacData0 + 4, 0xFFFF, kDacMidscale}, {kDacData0 + 5, 0xFFFF, kDacMidscale},
    {kDacData0 + 6, 0xFFFF, kDacMidscale}, {kDacData0 + 7, 0xFFFF, kDacMidscale},
};

// ---- ADS8688 ----

uint16_t ads8688Manual(uint8_t ch) { return static_cast<uint16_t>(0xC000 | ((ch & 7) << 10)); }

uint16_t ads8688WriteReg(uint8_t reg, uint8_t value) { return static_cast<uint16_t>(((reg & 0x7F) << 9) | 0x100 | value); }

float ads8688FullScaleV(AdsRange r) { return r == AdsRange::V2_56 ? 2.56f : r == AdsRange::V5_12 ? 5.12f : 10.24f; }

float ads8688Volts(uint16_t code, AdsRange r) {
  return (static_cast<float>(code) - 32768.0f) * ads8688FullScaleV(r) / 32768.0f;
}

void ads8688Chain2(const uint8_t rx[6], uint16_t& onMiso, uint16_t& second) {
  onMiso = static_cast<uint16_t>((rx[2] << 8) | rx[3]);
  second = static_cast<uint16_t>((rx[4] << 8) | rx[5]);
}

float coilMA(float xVolts) { return xVolts / kRsOhm * 1000.0f; }

Ceiling ceilingFromVolts(float v) {
  if (v > 0.45f && v < 0.95f) return Ceiling::MA5;   // 0.684 V
  if (v > 2.40f && v < 3.05f) return Ceiling::MA20;  // 2.72 V
  return Ceiling::Unknown;
}

float ceilingMA(Ceiling c) { return c == Ceiling::MA20 ? 20.0f : c == Ceiling::MA5 ? 5.0f : 0.0f; }

float tripMA(Ceiling c) { return ceilingMA(c) * 1.1f; }

float p15FromVolts(float v) { return v * (100.0e3f + 10.0e3f) / 10.0e3f; }

float n15FromVolts(float v, float v3v3) {
  const float r1 = 150.0e3f, r2 = 22.0e3f;
  // v = (Vn/r1 + V3/r2) / (1/r1 + 1/r2)  ->  Vn = (v·(1/r1 + 1/r2) - V3/r2) · r1
  return (v * (1.0f / r1 + 1.0f / r2) - v3v3 / r2) * r1;
}

float ccOfferedMA(float v) {
  if (v >= 1.31f && v <= 2.04f) return 3000.0f;
  if (v >= 0.70f && v <= 1.16f) return 1500.0f;
  if (v >= 0.25f && v <= 0.61f) return 500.0f;
  return 0.0f;
}

CoilVerdict judgeCoil(const CoilReading& r, float railV) {
  CoilVerdict v;
  const float tol = std::fmax(0.05f, 0.1f * std::fabs(r.setMA));
  v.ok = std::fabs(r.senseMA - r.setMA) <= tol;
  // At the rail, or beyond what the monitor reads (±10.24 V: a driver at its rail reads full scale).
  const float railRead = std::fmin(railV - kRailHeadroomV - 0.5f, ads8688FullScaleV(kCoilRange) - 0.1f);
  const bool atRail = std::fabs(r.outV) >= railRead;
  v.open = !v.ok && atRail;
  // Not measurable without a current, or with OUT beyond what the monitor reads.
  if (std::fabs(r.senseMA) >= 0.05f && !atRail) v.ohms = (r.outV - r.xV) / (r.senseMA / 1000.0f);
  return v;
}

}  // namespace pcb
