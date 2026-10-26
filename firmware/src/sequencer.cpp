#include "sequencer.h"

#include <Arduino.h>
#include <esp_task_wdt.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>
#include <soc/gpio_struct.h>

#include <cmath>
#include <cstring>
#include <cstdio>

#include "config.h"
#include "dac.h"
#include "drive.h"
#include "settings.h"

namespace seq {
namespace {

enum class CommandType : uint8_t { Start, Stop, Skip, SetField, Reconfigure };

struct Command {
  CommandType type;
  StartRequest start;
  float value;
  char reason[40];
};

constexpr double kTickMs = limits::kTickUs / 1000.0;

TaskHandle_t gTask = nullptr;
QueueHandle_t gQueue = nullptr;
hw_timer_t* gTimer = nullptr;
portMUX_TYPE gMux = portMUX_INITIALIZER_UNLOCKED;
volatile bool gEmergency = false;
volatile uint32_t gKeepaliveMs = 0;

// Owned by the sequencer task.
engine::Session* gSession = nullptr;
engine::SessionRunner gRunner;
StartRequest gActive;
float gSwing[8] = {0};
uint16_t gCodes[8];
Status gStatusLocal;

// Shared with other tasks under gMux.
Status gStatusShared;
Finished gFinished;
bool gFinishedPending = false;

void IRAM_ATTR onTimer() {
  BaseType_t woken = pdFALSE;
  vTaskNotifyGiveFromISR(gTask, &woken);
  if (woken) portYIELD_FROM_ISR();
}

inline void arm(bool on) {
  if (on) GPIO.out_w1ts = 1u << pins::kArm;
  else GPIO.out_w1tc = 1u << pins::kArm;
  gStatusLocal.armed = on;
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
  std::snprintf(f.reason, sizeof f.reason, "%s", reason);
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
  gStatusLocal.phaseCount = gSession->phaseCount;
  gStatusLocal.totalMs = gSession->totalMs();
  gStatusLocal.lastStopReason[0] = '\0';
  dac::writeMidscale();
  arm(true);  // identical for sham and active sessions
}

void handleCommand(const Command& c) {
  switch (c.type) {
    case CommandType::Start:
      beginSession(c.start);
      break;
    case CommandType::Stop:
      if (gRunner.running()) {
        gRunner.requestStop();
        gStatusLocal.state = State::Stopping;
        std::snprintf(gStatusLocal.lastStopReason, sizeof gStatusLocal.lastStopReason, "%s", c.reason);
      }
      break;
    case CommandType::Skip:
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
        computeSwing();
      }
      break;
    case CommandType::Reconfigure:
      if (!gRunner.running()) dac::reconfigure(gSettings.dacGain2x, gSettings.dacBufferedRef);
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
  dac::writeAll(gCodes);

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
  for (;;) {
    const uint32_t ticks = ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(100));
    esp_task_wdt_reset();

    bool emergency = false;
    if (gEmergency) {
      gEmergency = false;
      emergency = true;
      if (gRunner.running()) finish(false, "STOP button");
      else arm(false);
    }

    Command c;
    while (xQueueReceive(gQueue, &c, 0) == pdTRUE) handleCommand(c);

    if (gRunner.running()) {
      if (ticks > 1 && !emergency) gStatusLocal.overruns += ticks - 1;
      if (gSettings.keepaliveS > 0 && gStatusLocal.state == State::Running &&
          millis() - gKeepaliveMs > gSettings.keepaliveS * 1000u) {
        gRunner.requestStop();
        gStatusLocal.state = State::Stopping;
        std::snprintf(gStatusLocal.lastStopReason, sizeof gStatusLocal.lastStopReason, "UI keepalive lost");
      }
      if (ticks > 0) renderTick(kTickMs * ticks);
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
  pinMode(pins::kArm, OUTPUT);
  digitalWrite(pins::kArm, LOW);
  for (auto& c : gCodes) c = 0x800;

  gQueue = xQueueCreate(8, sizeof(Command));
  xTaskCreatePinnedToCore(task, "sequencer", 8192, nullptr, configMAX_PRIORITIES - 2, &gTask, 1);

  gTimer = timerBegin(1000000);  // 1 MHz timebase
  timerAttachInterrupt(gTimer, &onTimer);
  timerAlarm(gTimer, limits::kTickUs, true, 0);
}

bool start(const StartRequest& request) {
  Command c{};
  c.type = CommandType::Start;
  c.start = request;
  return send(c);
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

bool busy() { return status().state != State::Idle; }

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
  GPIO.out_w1tc = 1u << pins::kArm;  // open the coil return at once
  gEmergency = true;
  if (gTask != nullptr) {
    BaseType_t woken = pdFALSE;
    vTaskNotifyGiveFromISR(gTask, &woken);
    if (woken) portYIELD_FROM_ISR();
  }
}

}  // namespace seq
