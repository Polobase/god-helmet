// Real-time output engine.
//
// A 2 kHz hardware timer wakes a high-priority task pinned to core 1 that
// renders the active session, writes all eight DAC channels and pulses LDAC.
// The task is the only code that touches the DAC and the arming switch; the
// web layer talks to it through a command queue and reads a status snapshot.
#pragma once
#include <cstdint>

#include "session.h"

namespace seq {

enum class State : uint8_t { Idle, Running, Stopping };

struct StartRequest {
  engine::Session* session = nullptr;  // ownership passes to the sequencer
  float fieldUT = 1.0f;     // peak field at the calibration depth
  float testMA = 0.0f;      // != 0: drive this current instead (calibration, polarity)
  bool sham = false;        // zero output, everything else identical
  bool blind = false;       // UI hides what is running
  uint32_t logId = 0;
  uint32_t trialId = 0;     // the trial this session belongs to, 0 = none
  uint32_t startEpoch = 0;  // unix seconds at the start, 0 = clock not set
  char token[25] = {0};     // the app's start token (lib/resume/start.h), "" = none
  char presetId[64] = {0};
};

struct Status {
  State state = State::Idle;
  bool armed = false;
  bool blind = false;
  bool test = false;
  uint32_t logId = 0;
  char sessionId[64] = {0};    // same limits as engine::Session (id, name, phase name)
  char sessionName[96] = {0};
  char phaseName[64] = {0};
  int phase = 0;
  int phaseCount = 0;
  uint32_t elapsedMs = 0;
  uint32_t programMs = 0;
  uint32_t totalMs = 0;
  uint32_t phaseMs = 0;
  uint32_t phaseDurationMs = 0;
  float envelope = 0;
  float fieldUT = 0;
  float testMA = 0;
  float levels[8] = {0};    // |v| per channel, for the live view
  uint32_t overruns = 0;    // output periods that were late or lost (a stall of 5 ms counts 10)
  char lastStopReason[40] = {0};
  // The session that runs, or the last one: kept until the next start, so an
  // app that reconnects can tell whether it is the one it started.
  uint32_t trialId = 0;
  uint32_t startEpoch = 0;
  char token[25] = {0};
  char presetId[64] = {0};
};

struct Finished {
  uint32_t logId = 0;
  uint32_t elapsedMs = 0;
  bool completed = false;   // ran to the planned end
  bool sham = false;
  char reason[40] = {0};
  float finalFieldUT = 0;     // the intensity it ended with
  uint16_t fieldChanges = 0;  // how often the intensity was changed
  uint16_t skips = 0;         // phases skipped
};

void begin();
bool start(const StartRequest& request);  // false if the queue is full
void stop(const char* reason);            // soft stop (2 s fade)
void skipPhase();
void setField(float uT);                  // live intensity change
void keepalive();                         // an app is present (see Settings::keepaliveS)
void reconfigureDac();                    // re-apply DAC gain/reference settings
Status status();
// True from the moment start() queues a session until it has ended, so two
// quick starts cannot both pass a busy() check.
bool busy();
// Immediate stop from task context (on-screen STOP): mid-scale at once, no fade.
void emergencyStop(const char* reason);
// Returns true once per finished session (consumed by the logbook).
bool popFinished(Finished& out);
// Wired to the STOP button: cuts the coil return immediately (ISR-safe).
// The BOOT button is not an interrupt: the sequencer task samples it and
// stops when it has been held for 40 ms (lib/resume/hold.h), because a
// computer opening the USB port pulses that pin for a few milliseconds.
void emergencyStopFromIsr();

}  // namespace seq
