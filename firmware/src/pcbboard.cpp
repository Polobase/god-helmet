#include "pcbboard.h"

#ifdef HAS_PCB_DRIVER
#include <Arduino.h>
#include <SPI.h>
#include <driver/gpio.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

#include <cmath>

#include "dac.h"
#include "fastio.h"

namespace pcbboard {
namespace {

// The island's SPI: its own bus (SPI3), through the ISO6741F isolators. DAC80504 and ADS8688 both take data on SCLK
// falling edges (SPI mode 1); the ADS8688 up to 17 MHz. 4 MHz leaves the isolators' delay (there and back) far inside
// a clock period.
SPIClass gTesSpi(HSPI);
const SPISettings kDacSpi(4000000, MSBFIRST, SPI_MODE1);
const SPISettings kAdcSpi(4000000, MSBFIRST, SPI_MODE1);
// The two coil ADS8688 share the coil DAC's bus (dac::spi()), one short transaction per frame.
const SPISettings kCoilAdcSpi(8000000, MSBFIRST, SPI_MODE1);

portMUX_TYPE gMux = portMUX_INITIALIZER_UNLOCKED;
Snapshot gSnap;
bool gBeat = false;
// Accumulators of the monitor task.
double gCoilSq[8] = {0};
double gCoilS = 0;
double gTesV[tes::kChannels] = {0}, gTesI[tes::kChannels] = {0};
double gTesS = 0;
volatile bool gResetCoil = false, gResetTes = false;
portMUX_TYPE gWatchMux = portMUX_INITIALIZER_UNLOCKED;
tes::Watch gWatch;
volatile bool gWatchActive = false;
const char* volatile gWatchReason = nullptr;

float adcVolts(int pin) { return static_cast<float>(analogReadMilliVolts(pin)) / 1000.0f; }

// One frame of the coil ADCs' daisy chain (48 clocks): the command, then the result of #1 (X, on MISO) and of #2
// (OUT). True when the ADC drove SDO low during the command, as it does (SBAS582C 8.4.1.1.4); MISO has a pull-up,
// so a chain that does not answer reads ones there.
bool coilFrame(uint16_t cmd, uint16_t& x, uint16_t& out) {
  uint8_t b[6] = {static_cast<uint8_t>(cmd >> 8), static_cast<uint8_t>(cmd), 0, 0, 0, 0};
  SPIClass& spi = dac::spi();
  spi.beginTransaction(kCoilAdcSpi);
  digitalWrite(pins::kCsAdc, LOW);
  spi.transfer(b, sizeof b);
  digitalWrite(pins::kCsAdc, HIGH);
  spi.endTransaction();
  pcb::ads8688Chain2(b, x, out);
  return b[0] == 0 && b[1] == 0;
}

// All eight channels of both coil ADCs: the command of a frame selects the channel the next frame converts, so nine
// frames, the first one's result discarded.
bool coilScan(uint16_t x[8], uint16_t out[8]) {
  uint16_t dx = 0, dout = 0;
  bool ok = coilFrame(pcb::ads8688Manual(0), dx, dout);
  for (uint8_t ch = 0; ch < 8; ++ch) ok = coilFrame(pcb::ads8688Manual(static_cast<uint8_t>((ch + 1) & 7)), x[ch], out[ch]) && ok;
  return ok;
}

// The island's ADS8688: a 32-clock conversion frame, the result in its last 16.
uint16_t tesAdcFrame(uint16_t cmd) {
  uint8_t b[4] = {static_cast<uint8_t>(cmd >> 8), static_cast<uint8_t>(cmd), 0, 0};
  gTesSpi.beginTransaction(kAdcSpi);
  digitalWrite(pins::kTesCsAdc, LOW);
  gTesSpi.transfer(b, sizeof b);
  digitalWrite(pins::kTesCsAdc, HIGH);
  gTesSpi.endTransaction();
  return static_cast<uint16_t>((b[2] << 8) | b[3]);
}

// The ranges of the island's inputs, written at every scan (an island that lost power comes back at ±10.24 V on all
// eight). True when the ADC echoed every value (SBAS582C 8.5.2.1): the island has power and its ADC answers. Its MISO
// comes back through an isolator whose output is low without power on the island, so a dead island echoes zeros and
// fails at the ±2.56 V inputs.
bool tesAdcRanges() {
  bool ok = true;
  gTesSpi.beginTransaction(kAdcSpi);
  for (uint8_t in = 0; in < 8; ++in) {
    const uint8_t range = static_cast<uint8_t>(tes::adcRange(in));
    const uint16_t cmd = pcb::ads8688WriteReg(static_cast<uint8_t>(pcb::kAdsRangeReg0 + in), range);
    uint8_t b[3] = {static_cast<uint8_t>(cmd >> 8), static_cast<uint8_t>(cmd), 0};
    digitalWrite(pins::kTesCsAdc, LOW);
    gTesSpi.transfer(b, sizeof b);
    digitalWrite(pins::kTesCsAdc, HIGH);
    ok = ok && b[2] == range;
  }
  gTesSpi.endTransaction();
  return ok;
}

void dacFrame(uint32_t word) {
  digitalWrite(pins::kTesCsDac, LOW);
  gTesSpi.transfer(static_cast<uint8_t>(word >> 16));
  gTesSpi.transfer16(static_cast<uint16_t>(word));
  digitalWrite(pins::kTesCsDac, HIGH);
}

void monitorTask(void*) {
  uint32_t last = millis();
  uint32_t slow = 0;
  Snapshot s;
  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(10));
    const uint32_t now = millis();
    const float dt = static_cast<float>(now - last) / 1000.0f;
    last = now;
    // Coils: the sense node X (current) and the drive voltage OUT of all eight, both ADCs on ±10.24 V.
    uint16_t x[8] = {0}, out[8] = {0};
    s.valid = coilScan(x, out);
    for (uint8_t ch = 0; ch < 8; ++ch) {
      s.coilMA[ch] = pcb::coilMA(pcb::ads8688Volts(x[ch], pcb::kCoilRange));
      s.coilOutV[ch] = pcb::ads8688Volts(out[ch], pcb::kCoilRange);
    }
    if (gResetCoil) {
      gResetCoil = false;
      for (double& q : gCoilSq) q = 0;
      gCoilS = 0;
    }
    gCoilS += dt;
    for (int ch = 0; ch < 8; ++ch) {
      gCoilSq[ch] += static_cast<double>(s.coilMA[ch]) * s.coilMA[ch] * dt;
      s.coilRmsMA[ch] = gCoilS > 0 ? static_cast<float>(std::sqrt(gCoilSq[ch] / gCoilS)) : 0.0f;
    }
    // The island: current, setpoint and electrode voltages of both channels, the ranges set again first.
    s.tesAdcOk = tesAdcRanges();
    uint16_t c[8];
    tesAdcFrame(pcb::ads8688Manual(0));
    for (uint8_t in = 0; in < 8; ++in) c[in] = tesAdcFrame(pcb::ads8688Manual(static_cast<uint8_t>((in + 1) & 7)));
    const auto volts = [&](uint8_t in) { return pcb::ads8688Volts(c[in], tes::adcRange(in)); };
    for (int k = 0; k < tes::kChannels; ++k) {
      s.tesMA[k] = tes::senseMA(volts(static_cast<uint8_t>(tes::VS1 + k)));
      s.tesSetMA[k] = tes::setpointMA(volts(static_cast<uint8_t>(tes::TSP1 + k)));
      s.tesPairV[k] = volts(static_cast<uint8_t>(tes::EA1 + 2 * k)) - volts(static_cast<uint8_t>(tes::EB1 + 2 * k));
    }
    if (gResetTes) {
      gResetTes = false;
      for (int k = 0; k < tes::kChannels; ++k) gTesV[k] = gTesI[k] = 0;
      gTesS = 0;
    }
    gTesS += dt;
    for (int k = 0; k < tes::kChannels; ++k) {
      gTesV[k] += static_cast<double>(s.tesPairV[k]) * s.tesPairV[k] * dt;
      gTesI[k] += static_cast<double>(s.tesMA[k]) * s.tesMA[k] * dt;
      s.tesRmsV[k] = gTesS > 0 ? static_cast<float>(std::sqrt(gTesV[k] / gTesS)) : 0.0f;
      s.tesRmsMA[k] = gTesS > 0 ? static_cast<float>(std::sqrt(gTesI[k] / gTesS)) : 0.0f;
    }
    portENTER_CRITICAL(&gWatchMux);
    if (gWatchActive && gWatchReason == nullptr) {
      // Without the monitor nothing could tell a current that is not delivered: that ends the session too.
      const char* r = s.tesAdcOk ? tes::watchStep(gWatch, dt, s.tesSetMA, s.tesMA, s.tesPairV) : "tES monitor does not answer";
      if (r) gWatchReason = r;
    }
    portEXIT_CRITICAL(&gWatchMux);
    // The ESP32's own pins, ten times a second.
    if (++slow >= 10) {
      slow = 0;
      s.vth = adcVolts(pins::kCeilAdc);
      s.ceiling = pcb::ceilingFromVolts(s.vth);
      s.p15 = pcb::p15FromVolts(adcVolts(pins::kP15Adc));
      s.n15 = pcb::n15FromVolts(adcVolts(pins::kN15Adc));
      s.usbMA = pcb::ccOfferedMA(std::fmax(adcVolts(pins::kCc1Adc), adcVolts(pins::kCc2Adc)));
#if ARDUINO_USB_MODE
      s.usbHost = Serial.isPlugged();  // start-of-frame packets: a computer, not a power bank
#endif
    }
    s.ms = now;
    portENTER_CRITICAL(&gMux);
    gSnap = s;
    portEXIT_CRITICAL(&gMux);
  }
}

}  // namespace

void begin() {
  pinMode(pins::kClearN, OUTPUT);
  digitalWrite(pins::kClearN, HIGH);
  pinMode(pins::kTripQ, INPUT);
  pinMode(pins::kStopQ, INPUT);
  pinMode(pins::kTesFault, INPUT);
  pinMode(pins::kTesEn, OUTPUT);
  digitalWrite(pins::kTesEn, LOW);
  pinMode(pins::kTesHeartbeat, OUTPUT);
  digitalWrite(pins::kTesHeartbeat, LOW);
  for (int p : {pins::kTesCsDac, pins::kTesCsAdc, pins::kCsAdc}) {
    pinMode(p, OUTPUT);
    digitalWrite(p, HIGH);
  }
  // MISO (GPIO3) is shared by the coil ADCs and the DAC's readback and floats while neither is selected: a weak
  // pull-up, so a part that does not answer reads ones (dac::begin() has routed the pin to the SPI bus already).
  gpio_pullup_en(static_cast<gpio_num_t>(pins::kMiso));
  analogReadResolution(12);
  gTesSpi.begin(pins::kTesSck, pins::kTesMiso, pins::kTesMosi, -1);
  // The island's DAC: every output waits for the LDAC trigger, all at mid-scale (0 mA).
  const float zero[tes::kChannels] = {0, 0};
  gTesSpi.beginTransaction(kDacSpi);
  dacFrame(tes::dacWrite(tes::kRegSync, tes::kSyncAllOnLdac));
  gTesSpi.endTransaction();
  tesWrite(zero);
  xTaskCreatePinnedToCore(monitorTask, "monitor", 4096, nullptr, 2, nullptr, 0);
}

bool tripLatched() { return digitalRead(pins::kTripQ) == HIGH; }
bool stopLatched() { return digitalRead(pins::kStopQ) == HIGH; }
bool tesFaultLatched() { return digitalRead(pins::kTesFault) == HIGH; }

bool clearLatches() {
  digitalWrite(pins::kClearN, LOW);
  delayMicroseconds(20);
  digitalWrite(pins::kClearN, HIGH);
  delayMicroseconds(20);
  return !tripLatched() && !stopLatched();
}

Snapshot snapshot() {
  portENTER_CRITICAL(&gMux);
  Snapshot s = gSnap;
  portEXIT_CRITICAL(&gMux);
  return s;
}

void resetCoilRms() { gResetCoil = true; }
void resetTesRms() { gResetTes = true; }

float ceilingMA() {
  // Three readings, all must agree: a switch caught mid-throw reads as unknown.
  pcb::Ceiling c = pcb::ceilingFromVolts(adcVolts(pins::kCeilAdc));
  for (int i = 0; i < 2; ++i)
    if (pcb::ceilingFromVolts(adcVolts(pins::kCeilAdc)) != c) return 0.0f;
  return pcb::ceilingMA(c);
}

void tesEnable(bool on) { digitalWrite(pins::kTesEn, on ? HIGH : LOW); }

void tesWrite(const float mA[tes::kChannels]) {
  gTesSpi.beginTransaction(kDacSpi);
  for (int k = 0; k < tes::kChannels; ++k) {
    const tes::CodePair c = tes::codesForMA(mA[k]);
    dacFrame(tes::dacWrite(static_cast<uint8_t>(tes::kRegDac0 + 2 * k), c.a));
    dacFrame(tes::dacWrite(static_cast<uint8_t>(tes::kRegDac0 + 2 * k + 1), c.b));
  }
  dacFrame(tes::dacWrite(tes::kRegTrigger, tes::kTriggerLdac));
  gTesSpi.endTransaction();
}

void tesBeat() {
  gBeat = !gBeat;
  fastWrite<pins::kTesHeartbeat>(gBeat);
}

const char* tesWatchReason() { return gWatchReason; }

void tesWatchReset(bool active) {
  portENTER_CRITICAL(&gWatchMux);
  gWatch = tes::Watch{};
  gWatchReason = nullptr;
  gWatchActive = active;
  portEXIT_CRITICAL(&gWatchMux);
}

}  // namespace pcbboard

#endif  // HAS_PCB_DRIVER
