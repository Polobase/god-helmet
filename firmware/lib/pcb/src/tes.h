// tES on the helmet-driver board's isolated island (hardware/pcb/modules/helmet-driver/spec.md, "tES island"):
// what a session may be, how its current runs over time, the words for the island's converters and when the
// firmware stops a session. Portable (no Arduino), unit-tested on the host.
//
// Two channels, each a bridge current source between its two electrodes. The island's DAC80504 sets each
// channel's current as the difference of two outputs (I = (A - B) / 549 Ω): 4.55 mA at the largest difference,
// so no code can ask for more. A comparator trips at 4.64 mA and opens the channel's relays; the relays also open
// when the heartbeat stops, on STOP, and on power loss. The limits below are the firmware's, inside those.
#pragma once
#include <cstdint>

#include "board.h"

namespace tes {

constexpr int kChannels = 2;

enum class Mode : uint8_t { DC, AC, RNS };

struct Plan {
  Mode mode = Mode::DC;
  // Per channel. DC: the current, signed (+: electrode A is the anode). AC and RNS: the peak amplitude (> 0).
  // 0 = channel not used.
  float mA[kChannels] = {0, 0};
  float hz = 10.0f;                         // AC frequency
  float lowHz = 0.1f, highHz = 640.0f;      // RNS band (Terney 2008: 0.1-640 Hz; "hf-tRNS" 100-640 Hz)
  uint32_t holdS = 1200;                    // at full intensity, between the ramps
  float rampUpS = 30.0f, rampDownS = 30.0f;
  bool sham = false;                        // ramp up and straight down again, then nothing (as Flow's sham)
};

struct Limits {
  float maxChannelMA = 4.0f;     // peak per channel
  float maxTotalMA = 4.0f;       // the channels' peaks added (Starstim's 4 mA total), a setting
  uint32_t maxSessionS = 2400;   // 40 min, ramps included
  float maxChargeC = 7.2f;       // ∫|i| dt, both channels
  float minRampS = 2.0f, maxRampS = 60.0f;
  float maxAcHz = 250.0f;
  float minRnsHz = 0.1f, maxRnsHz = 640.0f;
};

// Whether a plan is allowed; `error` (at least 96 bytes) gets the reason when not.
bool validate(const Plan& p, const Limits& lim, char* error, int errorSize);
// The whole session's length in seconds: ramps and hold.
float sessionS(const Plan& p);
// Charge the plan delivers (both channels, coulombs). AC: 2/π of the peak; RNS: counted as half the peak, more
// than the generator's mean |i| (tested), so the limit holds.
float plannedChargeC(const Plan& p);

enum class Phase : uint8_t { Idle, RampUp, Hold, RampDown, Done };

// The current over time. advance() is called at the output rate (the sequencer's 2 kHz).
class Runner {
 public:
  void start(const Plan& p, uint32_t seed);
  // Moves on by dtS seconds; out[ch] = the current to set, mA. Returns false once the session is over (out = 0).
  bool advance(float dtS, float out[kChannels]);
  // Ends early: ramps down from where it is, as fast as the plan's ramp down would from full; a sham in its
  // silence ends at once.
  void requestStop();
  Phase phase() const { return phase_; }
  float envelope() const { return env_; }
  float elapsedS() const { return elapsed_; }
  float chargeC() const { return charge_; }  // delivered so far by the commands, both channels
  bool running() const { return phase_ != Phase::Idle && phase_ != Phase::Done; }
  const Plan& plan() const { return plan_; }

 private:
  float noise(int ch);
  Plan plan_;
  Phase phase_ = Phase::Idle;
  float env_ = 0, elapsed_ = 0, phaseS_ = 0, charge_ = 0, theta_ = 0;
  // RNS: one Gaussian draw per channel every 1/1280 s, a 2nd-order high-pass and low-pass, scaled to the plan.
  uint32_t rng_ = 1;
  float sampleS_ = 0;
  float held_[kChannels] = {0, 0};
  float hp_[kChannels][4] = {}, lp_[kChannels][4] = {};
  float hpB_[3] = {}, hpA_[2] = {}, lpB_[3] = {}, lpA_[2] = {};
  float scale_ = 1.0f;
  bool silent_ = false;   // a sham after its ramps
  bool stopped_ = false;  // requestStop() was called
};

// ---- the island's converters ------------------------------------------------------------------------------------
// DAC80504 (TI SBAS871C, Table 2, Table 8): 24-bit frame, bit 23 R/W (0 = write), 19:16 address, 15:0 data.
constexpr uint8_t kRegSync = 0x2, kRegTrigger = 0x5, kRegDac0 = 0x8;
uint32_t dacWrite(uint8_t reg, uint16_t data);
// SYNC: every output waits for the LDAC trigger (bits 3:0), broadcast bits and reserved bits as at reset.
constexpr uint16_t kSyncAllOnLdac = 0xFF0F;
constexpr uint16_t kTriggerLdac = 0x0010;  // TRIGGER bit 4
// The two codes (outputs A and B of a channel) for a current: symmetric about mid-scale (I = (A - B) / 549 Ω,
// 0 to 2.5 V each). Clamped to the DAC's range: ±4.55 mA.
struct CodePair {
  uint16_t a, b;
};
CodePair codesForMA(float mA, float senseOhm = 549.0f, float vref = 2.5f);
constexpr uint16_t kMidscale = 0x8000;

// The island's ADS8688 (frames in board.h), inputs AIN0-AIN7 in this order (schematic page "island"), read directly:
// VS, the INA821's output (= I · 549 Ω); TSP, the difference stage's output (= b - a, so the setpoint current is
// -TSP / 549 Ω); EA and EB, the electrodes against the island's ground.
enum AdcInput : uint8_t { VS1 = 0, VS2 = 1, EA1 = 2, EB1 = 3, EA2 = 4, EB2 = 5, TSP1 = 6, TSP2 = 7 };
// VS and TSP on ±2.56 V (the 4.64 mA trip is 2.55 V), the electrodes on ±10.24 V.
pcb::AdsRange adcRange(uint8_t input);
float senseMA(float vsVolts, float senseOhm = 549.0f);
float setpointMA(float tspVolts, float senseOhm = 549.0f);

// ---- checks -----------------------------------------------------------------------------------------------------
// Impedance between a channel's electrodes from a test current (both in the same units: V and mA give kΩ).
struct Impedance {
  float kOhm = 0;
  bool ok = false;      // within the range below
  bool short_ = false;  // below kMinKOhm: sponges or saline touching, the current would not cross the head
  bool high = false;    // above kMaxKOhm, or more than the source can drive at the planned current
};
constexpr float kMinKOhm = 0.5f;
constexpr float kMaxKOhm = 20.0f;
// The voltage across a pair that counts as the bridge's limit: each electrode reaches about ±11.6 V, and the monitor
// reads each up to ±10.24 V, so 19 V across a pair (rev A, with dividers: 20 V).
constexpr float kComplianceV = 19.0f;
Impedance judgeImpedance(float volts, float mA, float plannedPeakMA);

// While a session runs: the measured current (VS) against the setpoint the current source receives (TSP). Both
// reach the ADS8688 directly, through its own 15 kHz input filter, so they are filtered alike and compare at any
// frequency. Compared as RMS over half a second; and the electrode voltages against the compliance.
struct Watch {
  float errSq[kChannels] = {0, 0}, setSq[kChannels] = {0, 0};
  float windowS = 0;
  float overS[kChannels] = {0, 0};
};
// Call at every monitor sample. dtS: time since the last sample; setMA: from TSP; measMA: from VS; pairV: electrode
// A minus electrode B. Returns a stop reason, or nullptr.
const char* watchStep(Watch& w, float dtS, const float setMA[kChannels], const float measMA[kChannels],
                      const float pairV[kChannels]);

}  // namespace tes
