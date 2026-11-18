#include "sequencer.h"

#include <Arduino.h>
#include <esp_task_wdt.h>
#include <esp_timer.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>

#include <atomic>
#include <cmath>
#include <cstring>
#include <cstdio>

#include "config.h"
#include "dac.h"
#include "drive.h"
#include "fastio.h"
#include "hold.h"
#include "journal.h"
#include "keepalive.h"
#include "settings.h"
#include "ticks.h"
#ifdef HAS_PCB_DRIVER
#include "pcbboard.h"
#endif

namespace seq {
namespace {

enum class CommandType : uint8_t { Start, Stop, Skip, SetField, Reconfigure, TesStart };

struct Command {
  CommandType type;
  StartRequest start;
  float value;
  char reason[40];
#ifdef HAS_PCB_DRIVER
  tes::Plan tesPlan;
  uint32_t tesSeed;
  bool tesBlind, tesCheck;
#endif
};

constexpr double kTickMs = limits::kTickUs / 1000.0;
constexpr uint32_t kProgressTicks = 250000 / limits::kTickUs;  // progress record every 250 ms

TaskHandle_t gTask = nullptr;
QueueHandle_t gQueue = nullptr;
hw_timer_t* gTimer = nullptr;
portMUX_TYPE gMux = portMUX_INITIALIZER_UNLOCKED;
volatile bool gEmergency = false;
const char* volatile gEmergencyReason = "STOP button";
std::atomic<int> gPending{0};  // queued starts not yet running
volatile uint32_t gKeepaliveMs = 0;

// Owned by the sequencer task.
engine::Session* gSession = nullptr;
engine::SessionRunner gRunner;
StartRequest gActive;
float gSwing[8] = {0};
uint16_t gCodes[8];
Status gStatusLocal;
uint16_t gFieldChanges = 0;
uint16_t gSkips = 0;
uint32_t gProgressTicks = 0;
resume::HoldDetector gBootHold;
#ifdef HAS_PCB_DRIVER
tes::Runner gTes;
bool gTesBlind = false;
uint32_t gTesTicks = 0;
#endif

// Shared with other tasks under gMux.
Status gStatusShared;
Finished gFinished;
bool gFinishedPending = false;

void IRAM_ATTR onTimer() {
  BaseType_t woken = pdFALSE;
  vTaskNotifyGiveFromISR(gTask, &woken);
  if (woken) portYIELD_FROM_ISR();
}

#ifdef HAS_PCB_DRIVER
// The helmet-driver board's DAC81408 sits in RESET while not armed. The board releases RESET about 10 ms after ARM
// (an RC delay: hardware/pcb spec.md, "Ceiling and fault chain") and the DAC listens 1 ms later (SLASER3A 9.3.3.1).
// It is configured once that has passed, and tried twice more 15 ms apart; until then its outputs stay tied to
// ground (0 mA) and the session's first milliseconds pass without output.
constexpr uint32_t kDacSettleMs = 25, kDacRetryMs = 15;
constexpr int kDacTries = 3;
uint32_t gArmMs = 0;
int gDacTries = 0;
bool gDacReady = false;
#endif

// Boards without an arming switch (coil returns wired to ground, kArm -1):
// arming is then only a status flag and STOP relies on mid-scale.
inline void arm(bool on) {
  fastWrite<pins::kArm>(on);
  gStatusLocal.armed = on;
#ifdef HAS_PCB_DRIVER
  gArmMs = millis();
  gDacTries = 0;
  gDacReady = false;
#endif
}

void computeSwing() {
  const Settings& s = gSettings;
  for (int ch = 0; ch < 8; ++ch) {
    if (gActive.testMA != 0.0f) {
      const float ma = std::fmin(std::fabs(gActive.testMA), limits::kMaxTestMA);
      const float swing = engine::swingForCurrentMA(s.drive, ma);
      gSwing[ch] = gActive.testMA < 0 ? -swing : swing;
    } else {
      const float uT = std::fmin(gActive.fieldUT, s.maxFieldUT);
      gSwing[ch] = engine::swingForFieldUT(s.drive, uT, s.uTperMA[ch]);
    }
  }
}

void publish() {
  portENTER_CRITICAL(&gMux);
  gStatusShared = gStatusLocal;
  portEXIT_CRITICAL(&gMux);
}

// Where the session stands, into RTC memory: after a crash or a watchdog
// restart the log entry is closed from it (journal.h). No flash access.
// Tests have no log entry and leave no record.
void saveProgress(resume::RunState state, bool completed = false, const char* reason = "") {
  if (gActive.logId == 0) return;
  resume::Progress p;
  p.bootId = journal::bootId();
  p.logId = gActive.logId;
  p.elapsedMs = static_cast<uint32_t>(gRunner.frame().elapsedMs);
  p.startEpoch = gActive.startEpoch;
  p.fieldUT = gActive.fieldUT;
  p.fieldChanges = gFieldChanges;
  p.skips = gSkips;
  p.state = static_cast<uint8_t>(state);
  p.completed = completed ? 1 : 0;
  std::snprintf(p.reason, sizeof p.reason, "%s", reason);
  journal::save(p);
  gProgressTicks = 0;
}

void finish(bool completed, const char* reasonIn) {
  dac::writeMidscale();
  arm(false);
  char reason[40];  // reasonIn may point at gStatusLocal.lastStopReason
  std::snprintf(reason, sizeof reason, "%s", reasonIn);
  Finished f;
  f.logId = gActive.logId;
  f.elapsedMs = static_cast<uint32_t>(gRunner.frame().elapsedMs);
  f.completed = completed;
  f.sham = gActive.sham;
  f.finalFieldUT = gActive.fieldUT;
  f.fieldChanges = gFieldChanges;
  f.skips = gSkips;
  std::snprintf(f.reason, sizeof f.reason, "%s", reason);
  saveProgress(resume::RunState::Ended, completed, reason);  // until the log entry is written
  gRunner.abort();
  delete gSession;
  gSession = nullptr;
  gStatusLocal.state = State::Idle;
  gStatusLocal.test = false;
  gStatusLocal.blind = false;
  gStatusLocal.envelope = 0;
  for (float& l : gStatusLocal.levels) l = 0;
  std::snprintf(gStatusLocal.lastStopReason, sizeof gStatusLocal.lastStopReason, "%s", reason);
  portENTER_CRITICAL(&gMux);
  if (f.logId != 0) {
    gFinished = f;
    gFinishedPending = true;
  }
  portEXIT_CRITICAL(&gMux);
  publish();
}

void beginSession(const StartRequest& req) {
  if (gSession != nullptr) finish(false, "replaced");
  gSession = req.session;
  gActive = req;
  gFieldChanges = 0;
  gSkips = 0;
  gSession->bindTable();
  computeSwing();
  gRunner.start(gSession);
  if (!gRunner.running()) {
    finish(false, "empty session");
    return;
  }
  gKeepaliveMs = millis();
  std::memset(&gStatusLocal.sessionId, 0, sizeof gStatusLocal.sessionId);
  std::snprintf(gStatusLocal.sessionId, sizeof gStatusLocal.sessionId, "%s", gSession->id);
  std::snprintf(gStatusLocal.sessionName, sizeof gStatusLocal.sessionName, "%s", gSession->name);
  gStatusLocal.state = State::Running;
  gStatusLocal.blind = req.blind;
  gStatusLocal.test = req.testMA != 0.0f;
  gStatusLocal.testMA = req.testMA;
  gStatusLocal.fieldUT = req.fieldUT;
  gStatusLocal.logId = req.logId;
  gStatusLocal.trialId = req.trialId;
  gStatusLocal.startEpoch = req.startEpoch;
  std::memset(gStatusLocal.token, 0, sizeof gStatusLocal.token);
  std::snprintf(gStatusLocal.token, sizeof gStatusLocal.token, "%s", req.token);
  std::memset(gStatusLocal.presetId, 0, sizeof gStatusLocal.presetId);
  std::snprintf(gStatusLocal.presetId, sizeof gStatusLocal.presetId, "%s", req.presetId);
  gStatusLocal.phase = 0;
  gStatusLocal.elapsedMs = 0;
  gStatusLocal.programMs = 0;
  gStatusLocal.phaseMs = 0;
  gStatusLocal.phaseCount = gSession->phaseCount;
  gStatusLocal.totalMs = gSession->totalMs();
  gStatusLocal.lastStopReason[0] = '\0';
  saveProgress(resume::RunState::Running);
  dac::writeMidscale();
  arm(true);  // identical for sham and active sessions
}

#ifdef HAS_PCB_DRIVER
// tES on the island: the outputs to 0 mA, the relays open (TES_EN low; the heartbeat stops with the session).
void tesFinish(const char* reasonIn) {
  char reason[40];
  std::snprintf(reason, sizeof reason, "%s", reasonIn);
  const float zero[2] = {0, 0};
  pcbboard::tesWrite(zero);
  pcbboard::tesEnable(false);
  pcbboard::tesWatchReset(false);
  if (gStatusLocal.tesCheck) {
    // The impedance check's readings, before the relays' opening adds zeros to them.
    const pcbboard::Snapshot sn = pcbboard::snapshot();
    for (int k = 0; k < 2; ++k) {
      gStatusLocal.tesCheckV[k] = sn.tesRmsV[k];
      gStatusLocal.tesCheckMA[k] = sn.tesRmsMA[k];
    }
  }
  gStatusLocal.tesCheck = false;
  gStatusLocal.tesChargeC = gTes.chargeC();
  gStatusLocal.tesElapsedS = gTes.elapsedS();
  gTes = tes::Runner{};
  gStatusLocal.state = State::Idle;
  gStatusLocal.tes = false;
  gStatusLocal.tesSetMA[0] = gStatusLocal.tesSetMA[1] = 0;
  std::snprintf(gStatusLocal.tesStopReason, sizeof gStatusLocal.tesStopReason, "%s", reason);
  std::snprintf(gStatusLocal.lastStopReason, sizeof gStatusLocal.lastStopReason, "%s", reason);
  publish();
}

void tesBegin(const Command& c) {
  if (gRunner.running() || gTes.running()) return;  // control checks busy() first; never two at once
  gTes.start(c.tesPlan, c.tesSeed);
  gTesBlind = c.tesBlind;
  gTesTicks = 0;
  gStatusLocal.state = State::Running;
  gStatusLocal.tes = true;
  gStatusLocal.tesCheck = c.tesCheck;
  gStatusLocal.blind = c.tesBlind;
  gStatusLocal.tesElapsedS = 0;
  gStatusLocal.tesTotalS = tes::sessionS(c.tesPlan);
  gStatusLocal.tesChargeC = 0;
  gStatusLocal.tesStopReason[0] = '\0';
  gStatusLocal.lastStopReason[0] = '\0';
  pcbboard::resetTesRms();
  // The impedance check measures whatever the electrodes do, so the watch would only get in its way.
  pcbboard::tesWatchReset(!c.tesCheck);
  pcbboard::tesEnable(true);
  publish();
}

// One output period (or several, after a stall) of a running tES session.
void tesTick(uint32_t ticks) {
  if (pcbboard::tesFaultLatched()) return tesFinish("tES trip (island latch)");
  if (const char* r = pcbboard::tesWatchReason()) return tesFinish(r);
  // A computer on the USB socket: the island's isolation would be all that separates the person from it.
  if (++gTesTicks % 200 == 0 && pcbboard::snapshot().usbHost) return tesFinish("computer on USB");
  float out[2];
  if (!gTes.advance(static_cast<float>(ticks * kTickMs / 1000.0), out)) {
    return tesFinish(gStatusLocal.state == State::Stopping ? gStatusLocal.lastStopReason : "completed");
  }
  pcbboard::tesWrite(out);
  gStatusLocal.tesElapsedS = gTes.elapsedS();
  gStatusLocal.tesChargeC = gTes.chargeC();
  for (int k = 0; k < 2; ++k) gStatusLocal.tesSetMA[k] = gTesBlind ? 0.0f : out[k];
}
#endif

void handleCommand(const Command& c) {
  switch (c.type) {
    case CommandType::Start:
      beginSession(c.start);
      publish();
      gPending--;
      break;
    case CommandType::Stop:
#ifdef HAS_PCB_DRIVER
      if (gTes.running()) {
        gTes.requestStop();
        gStatusLocal.state = State::Stopping;
        std::snprintf(gStatusLocal.lastStopReason, sizeof gStatusLocal.lastStopReason, "%s", c.reason);
      }
#endif
      if (gRunner.running()) {
        gRunner.requestStop();
        gStatusLocal.state = State::Stopping;
        std::snprintf(gStatusLocal.lastStopReason, sizeof gStatusLocal.lastStopReason, "%s", c.reason);
      }
      break;
    case CommandType::Skip:
      if (gRunner.running() && gSkips < 0xFFFF) ++gSkips;
      gRunner.skipPhase();
      if (gRunner.stopping() && gStatusLocal.state != State::Stopping) {
        gStatusLocal.state = State::Stopping;
        std::snprintf(gStatusLocal.lastStopReason, sizeof gStatusLocal.lastStopReason,
                      "skipped past last phase");
      }
      break;
    case CommandType::SetField:
      if (gRunner.running() && gActive.testMA == 0.0f) {
        gActive.fieldUT = c.value;
        gStatusLocal.fieldUT = c.value;
        if (gFieldChanges < 0xFFFF) ++gFieldChanges;
        computeSwing();
      }
      break;
    case CommandType::Reconfigure:
      if (!gRunner.running()) dac::reconfigure(gSettings.dacGain2x, gSettings.dacBufferedRef);
      break;
    case CommandType::TesStart:
#ifdef HAS_PCB_DRIVER
      tesBegin(c);
#endif
      gPending--;
      break;
  }
}

void renderTick(double dtMs) {
  const engine::SessionRunner::Frame f = gRunner.advance(dtMs);
  if (!f.running) {
    finish(gStatusLocal.state != State::Stopping, gStatusLocal.state == State::Stopping
                                                      ? gStatusLocal.lastStopReason
                                                      : "completed");
    return;
  }
  float v[8];
  engine::render(*gSession, f, v);
  for (int ch = 0; ch < 8; ++ch) {
    gCodes[ch] = gActive.sham ? 0x800 : engine::toCode(v[ch], gSwing[ch]);
    gStatusLocal.levels[ch] = gActive.sham ? 0.0f : std::fabs(v[ch]);
  }
#ifdef HAS_PCB_DRIVER
  if (!gDacReady && millis() - gArmMs >= kDacSettleMs + kDacRetryMs * static_cast<uint32_t>(gDacTries)) {
    gDacReady = dac::configure();
    if (!gDacReady && ++gDacTries >= kDacTries) {
      finish(false, "coil DAC does not answer");
      return;
    }
  }
  if (gDacReady) dac::writeAll(gCodes);
#else
  dac::writeAll(gCodes);
#endif

  const engine::Phase& ph = gSession->phases[f.phase];
  gStatusLocal.phase = f.phase;
  gStatusLocal.elapsedMs = static_cast<uint32_t>(f.elapsedMs);
  gStatusLocal.programMs = static_cast<uint32_t>(f.programMs);
  gStatusLocal.phaseMs = static_cast<uint32_t>(f.phaseMs);
  gStatusLocal.phaseDurationMs = ph.durationMs;
  gStatusLocal.envelope = f.envelope;
  std::snprintf(gStatusLocal.phaseName, sizeof gStatusLocal.phaseName, "%s", ph.name);
}

void task(void*) {
  esp_task_wdt_add(nullptr);
  uint32_t publishCounter = 0;
  uint64_t periodUs = static_cast<uint64_t>(esp_timer_get_time());  // start of the current output period
  for (;;) {
    ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(100));
    esp_task_wdt_reset();

    // The periods that have passed come from the clock, not from the number
    // of wake-ups: while the processor is held up (a flash write) wake-ups
    // are lost, and the session would fall behind unseen. While idle the
    // period boundary is kept half a period behind the wake-up, so a
    // session's ticks sit mid-period and ordinary jitter reads as exactly one.
    const uint64_t nowUs = static_cast<uint64_t>(esp_timer_get_time());
    uint32_t ticks = 0;
#ifdef HAS_PCB_DRIVER
    const bool active = gRunner.running() || gTes.running();
    // The island's relays stay closed only while this toggles (about 1 kHz): if this task stops, they open.
    if (gTes.running()) pcbboard::tesBeat();
#else
    const bool active = gRunner.running();
#endif
    if (active) ticks = resume::periodsSince(nowUs, periodUs, limits::kTickUs);
    else periodUs = nowUs - limits::kTickUs / 2;

    // BOOT is a STOP button, but only when held: a USB port being opened
    // pulses the pin for a few milliseconds.
    if constexpr (pins::kBoot >= 0) {
      if (gBootHold.sample(digitalRead(pins::kBoot) == LOW, static_cast<uint32_t>(nowUs / 1000))) {
        gEmergencyReason = "STOP button (BOOT)";
        gEmergency = true;
      }
    }

    bool emergency = false;
    if (gEmergency) {
      gEmergency = false;
      emergency = true;
      if (gRunner.running()) {
        finish(false, gEmergencyReason);
      } else {
        dac::writeMidscale();  // defensive: outputs to 0 V even when idle
        arm(false);
      }
#ifdef HAS_PCB_DRIVER
      if (gTes.running()) tesFinish(gEmergencyReason);
#endif
    }

    Command c;
    while (xQueueReceive(gQueue, &c, 0) == pdTRUE) handleCommand(c);

#ifdef HAS_PCB_DRIVER
    // The coil trip latch has already cut the rails and reset the DACs; the session ends with it.
    if (gRunner.running() && pcbboard::tripLatched()) finish(false, "coil current trip");
    if (gTes.running() && ticks > 0) tesTick(ticks);
#endif
    if (gRunner.running()) {
      if (ticks > 1 && !emergency) gStatusLocal.overruns += ticks - 1;
      if (gStatusLocal.state == State::Running &&
          hlink::keepaliveExpired(millis(), gKeepaliveMs, gSettings.keepaliveS)) {
        gRunner.requestStop();
        gStatusLocal.state = State::Stopping;
        std::snprintf(gStatusLocal.lastStopReason, sizeof gStatusLocal.lastStopReason, "UI keepalive lost");
      }
      if (ticks > 0) renderTick(kTickMs * ticks);
      gProgressTicks += ticks;
      if (gRunner.running() && gProgressTicks >= kProgressTicks) saveProgress(resume::RunState::Running);
    }

    if (++publishCounter >= 20) {  // every ~10 ms
      publishCounter = 0;
      publish();
    }
  }
}

bool send(const Command& c) { return gQueue != nullptr && xQueueSend(gQueue, &c, pdMS_TO_TICKS(50)) == pdTRUE; }

}  // namespace

void begin() {
  if (pins::kArm >= 0) {
    pinMode(pins::kArm, OUTPUT);
    digitalWrite(pins::kArm, LOW);
  }
  for (auto& c : gCodes) c = 0x800;

  gQueue = xQueueCreate(8, sizeof(Command));
  // The last core: core 1 on dual-core chips (away from WiFi/BLE on core 0),
  // core 0 on the single-core C3 and C6, where its priority keeps it ahead of BLE.
  xTaskCreatePinnedToCore(task, "sequencer", 8192, nullptr, configMAX_PRIORITIES - 2, &gTask, portNUM_PROCESSORS - 1);

  gTimer = timerBegin(1000000);  // 1 MHz timebase
  timerAttachInterrupt(gTimer, &onTimer);
  timerAlarm(gTimer, limits::kTickUs, true, 0);
}

bool start(const StartRequest& request) {
  Command c{};
  c.type = CommandType::Start;
  c.start = request;
  gPending++;
  if (send(c)) return true;
  gPending--;
  return false;
}

#ifdef HAS_PCB_DRIVER
bool startTes(const tes::Plan& plan, uint32_t seed, bool blind, bool check) {
  Command c{};
  c.type = CommandType::TesStart;
  c.tesPlan = plan;
  c.tesSeed = seed;
  c.tesBlind = blind;
  c.tesCheck = check;
  gPending++;
  if (send(c)) return true;
  gPending--;
  return false;
}
#endif

void emergencyStop(const char* reason) {
  gEmergencyReason = reason;
  gEmergency = true;
  if (gTask != nullptr) xTaskNotifyGive(gTask);
}

void stop(const char* reason) {
  Command c{};
  c.type = CommandType::Stop;
  std::snprintf(c.reason, sizeof c.reason, "%s", reason ? reason : "stopped");
  send(c);
}

void skipPhase() {
  Command c{};
  c.type = CommandType::Skip;
  send(c);
}

void setField(float uT) {
  Command c{};
  c.type = CommandType::SetField;
  c.value = uT;
  send(c);
}

void keepalive() { gKeepaliveMs = millis(); }

void reconfigureDac() {
  Command c{};
  c.type = CommandType::Reconfigure;
  send(c);
}

Status status() {
  portENTER_CRITICAL(&gMux);
  Status s = gStatusShared;
  portEXIT_CRITICAL(&gMux);
  return s;
}

bool busy() { return gPending.load() > 0 || status().state != State::Idle; }

bool popFinished(Finished& out) {
  bool has = false;
  portENTER_CRITICAL(&gMux);
  if (gFinishedPending) {
    out = gFinished;
    gFinishedPending = false;
    has = true;
  }
  portEXIT_CRITICAL(&gMux);
  return has;
}

void IRAM_ATTR emergencyStopFromIsr() {
  fastWrite<pins::kArm>(false);  // open the coil return at once (the task then writes mid-scale)
  gEmergencyReason = "STOP button";
  gEmergency = true;
  if (gTask != nullptr) {
    BaseType_t woken = pdFALSE;
    vTaskNotifyGiveFromISR(gTask, &woken);
    if (woken) portYIELD_FROM_ISR();
  }
}

}  // namespace seq
