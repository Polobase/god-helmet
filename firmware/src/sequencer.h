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
  uint32_t overruns = 0;    // ticks that ran late
  char lastStopReason[40] = {0};
};

struct Finished {
  uint32_t logId = 0;
  uint32_t elapsedMs = 0;
  bool completed = false;   // ran to the planned end
  bool sham = false;
  char reason[40] = {0};
};

void begin();
bool start(const StartRequest& request);  // false if the queue is full
void stop(const char* reason);            // soft stop (2 s fade)
void skipPhase();
void setField(float uT);                  // live intensity change
void keepalive();                         // UI heartbeat (see Settings::keepaliveS)
void reconfigureDac();                    // re-apply DAC gain/reference settings
Status status();
bool busy();
// Returns true once per finished session (consumed by the logbook).
bool popFinished(Finished& out);
// Wired to the STOP button: cuts the coil return immediately (ISR-safe).
void emergencyStopFromIsr();

}  // namespace seq
