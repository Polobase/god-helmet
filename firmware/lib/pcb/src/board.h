// The helmet-driver board (hardware/pcb/modules/helmet-driver, rev B): the words its converters take and what its
// monitor readings mean. Portable (no Arduino), unit-tested on the host (test/run_host_tests.sh).
//
// Coil channel k: DAC81408 output k-1 on its ±2.5 V range -> setpoint filter -> one half of an OPA2197 with the coil
// in its feedback loop, so the coil current is SET / Rs whatever the coil: ±20.16 mA at full scale (Rs = 124 Ω). A
// board-wide switch sets the trip thresholds: 5 mA (open) or 20 mA. The board's tES island is in tes.h.
#pragma once
#include <cstdint>

namespace pcb {

// ---- DAC81408 (TI SLASER3A, 9.5.1 and 9.6) ----------------------------------------------------------------------
// 24-bit frame (Table 2): bit 23 R/W (0 = write), bit 22 don't care, bits 21-16 the register, bits 15-0 data; SDI
// taken on SCLK falling edges (SPI mode 1). A read is two frames: the read command, then any frame (a NOP write),
// during which SDO returns bit 23 and the address of the command with the register's data (Table 3).
// After power-up and after every RESET pulse (the board holds RESET low while not armed) the DAC is in power-down:
// every output tied to ground through 10 kΩ, registers at their defaults (9.3.3), so it is configured after every arm.
constexpr uint8_t kDacNop = 0x00, kDacDeviceId = 0x01, kDacStatus = 0x02, kDacSpiConfig = 0x03, kDacGenConfig = 0x04,
                  kDacSyncConfig = 0x06, kDacPowerDown = 0x09, kDacRange0 = 0x0B, kDacRange1 = 0x0C,
                  kDacTrigger = 0x0E, kDacData0 = 0x14;
uint32_t dac81408Write(uint8_t reg, uint16_t data);
uint32_t dac81408Read(uint8_t reg);
// The register's value from the frame that follows a read command; false when the echo is not that read.
bool dac81408Readback(uint32_t sdoFrame, uint8_t reg, uint16_t& data);
// The engine's 12-bit offset code (0x800 = 0 mA) as the DAC's 16-bit straight binary word (8000h = 0 V on ±2.5 V).
uint16_t dac81408Data(uint16_t code12);
constexpr uint16_t kDacMidscale = 0x8000;
// The configuration, frame by frame, in this order: device on (SPICONFIG), internal reference on (GENCONFIG), all
// eight outputs on ±2.5 V (DACRANGE0/1), every data register at mid-scale while the outputs are still powered down
// and update at once (asynchronous, the default), then all eight on LDAC (SYNCCONFIG), then the outputs on
// (DACPWDWN). The data registers reset to 0000h, which on ±2.5 V is -2.5 V: full negative current, so the outputs
// come on only after mid-scale is in. Between two frames that update outputs the DAC needs 2.4 µs (tDACWAIT).
constexpr int kDacConfigFrames = 14;
void dac81408Config(uint32_t frames[kDacConfigFrames]);
// What a configured DAC reads back: register, bits compared, their value. DACRANGE is write-only.
struct DacExpect {
  uint8_t reg;
  uint16_t mask, value;
};
constexpr int kDacExpects = 14;
extern const DacExpect kDacExpect[kDacExpects];
// The LDAC bit of TRIGGER: loads every synchronous output, as the LDAC pin does.
constexpr uint16_t kDacTriggerLdac = 0x0010;

// ---- ADS8688 (TI SBAS582C, 8.4 and 8.5) -------------------------------------------------------------------------
// A frame begins when CS falls (the input is sampled then). The first 16 clocks take a 16-bit command on SDI (falling
// edges, SPI mode 1); from the 16th falling edge SDO gives the result, MSB first: straight binary, 8000h = 0 V,
// FSR / 65536 per count (Figure 69, Table 4). A command takes effect at the next frame: MAN_Ch_n in frame k makes
// frame k+1 convert channel n. In a daisy chain (one CS and SDI, each SDO into the next DAISY) the frame is 16 + 16·N
// clocks and the device on the host's MISO comes first (8.4.1.3.1).
// Program registers (8.5.2.1): a 24-clock frame, address in bits 15-9, bit 8 write, the value in bits 7-0; the
// device echoes the value on SDO over the next 8 clocks.
enum class AdsRange : uint8_t { V10_24 = 0x0, V5_12 = 0x1, V2_56 = 0x2 };  // ±2.5, ±1.25, ±0.625 x 4.096 V
constexpr uint16_t kAdsNoOp = 0x0000;
constexpr uint8_t kAdsRangeReg0 = 0x05;  // channel n's range at 05h + n; reset: ±10.24 V (Table 9)
uint16_t ads8688Manual(uint8_t channel);
uint16_t ads8688WriteReg(uint8_t reg, uint8_t value);
float ads8688FullScaleV(AdsRange r);
float ads8688Volts(uint16_t code, AdsRange r);
// A daisy-chain frame of two devices (48 clocks, 6 bytes on MISO): the result of the device on MISO, then the
// other one's. Bytes 0-1 come while the command goes out (SDO low).
void ads8688Chain2(const uint8_t rx[6], uint16_t& onMiso, uint16_t& second);

// ---- Coil monitor (schematic page "converters") -----------------------------------------------------------------
// ADS8688 #1, on MISO: the sense nodes X1-X8 (= I · Rs); #2 behind it in the chain: the driver outputs OUT1-OUT8.
// They share SDI, so they share their range settings: all sixteen inputs on ±10.24 V, the reset value. An output
// beyond ±10.24 V reads full scale.
constexpr float kRsOhm = 124.0f;  // sense resistor, 0.1 %
constexpr AdsRange kCoilRange = AdsRange::V10_24;
// Coil current in mA from the sense node X in volts.
float coilMA(float xVolts);

// ---- The ESP32's own ADC pins -----------------------------------------------------------------------------------
// The threshold the ceiling switch sets (VTH_P, through 10 kΩ to GPIO1): 0.684 V for 5 mA, 2.72 V for 20 mA.
enum class Ceiling : uint8_t { Unknown, MA5, MA20 };
Ceiling ceilingFromVolts(float vthVolts);
// The ceiling's current in mA (0 for Unknown: nothing may run).
float ceilingMA(Ceiling c);
// The current at which the comparators trip: the ceiling + 10 %.
float tripMA(Ceiling c);
// +15 V rail through 100 kΩ / 10 kΩ (GPIO2).
float p15FromVolts(float adcVolts);
// -15 V rail through 150 kΩ to the ADC pin, 22 kΩ from there to +3.3 V (GPIO6).
float n15FromVolts(float adcVolts, float v3v3 = 3.3f);
// The current a USB-C source offers, from the voltage on CC (5.1 kΩ to GND on the board; the Type-C sink ranges
// vRd-USB 0.25-0.61 V, vRd-1.5 0.70-1.16 V, vRd-3.0 1.31-2.04 V; to be checked against the specification before
// the firmware relies on it). 0 = no source seen. The connected CC is the higher of the two.
float ccOfferedMA(float ccVolts);

// ---- Coil check -------------------------------------------------------------------------------------------------
// One coil driven with a small DC test current: what the monitor saw.
struct CoilReading {
  float setMA = 0;     // commanded
  float senseMA = 0;   // measured (X / Rs)
  float outV = 0;      // driver output (OUT)
  float xV = 0;        // sense node (= senseMA · Rs)
};
struct CoilVerdict {
  bool open = false;   // the driver is at its rail and the current did not follow: no coil, a broken lead
  bool ok = false;     // the current followed within 10 % (and 0.05 mA)
  float ohms = 0;      // (OUT - X) / I: coil and cable; 0 when not measurable (no current, OUT beyond ±10.14 V)
};
// The rails the driver swings between (TPS65131 ±14.56 V, less the OPA2197's output headroom). The monitor reads OUT
// only to ±10.24 V, so a driver at its rail reads full scale.
constexpr float kRailHeadroomV = 1.0f;
CoilVerdict judgeCoil(const CoilReading& r, float railV = 14.56f);

}  // namespace pcb
