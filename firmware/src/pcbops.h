// The helmet-driver board's operations (HAS_PCB_DRIVER): what rpc.cpp and control.cpp call for that board only.
//
//   coils.check   drives each coil in turn with 1 mA for 1 s and reports current, drive voltage, resistance and
//                 whether the coil is open. Runs as a normal test session; the result appears in "coilsCheck".
//   tes.check     a 10 Hz, 0.1 mA impedance check of the tES channels (3 s); the result appears in "tesCheck".
//   tes.start     a tES session (DC, AC or RNS; lib/pcb/src/tes.h has the limits). Refused while a computer is on
//                 the USB socket: tES runs on a power bank, controlled over Bluetooth.
//   tes.stop      as session.stop.
//   tes.reveal    after a blind session: real or sham.
//   tes.log       every tES session: plan, time, charge, why it ended (/log/tes.jsonl).
#pragma once
#include "config.h"

#ifdef HAS_PCB_DRIVER
#include <Arduino.h>

#include "minijson.h"

namespace pcbops {

void begin();
// Before any coil output: the ceiling switch read (into the drive settings) and the latches cleared.
bool coilStartAllowed(String& error);
bool coilsCheck(String& error);
bool tesCheck(const mj::Value& v, String& error);
bool tesStart(const mj::Value& v, String& error);
bool tesReveal(mj::Writer& w, String& error);
// The tES journal (/log/tes.jsonl), oldest first; blind sessions without their condition until revealed.
bool tesLog(mj::Writer& w, String& error);
// Fields of hello and status.
void writeHello(mj::Writer& w);
void writeStatus(mj::Writer& w, bool blind);
// Called from the Arduino loop: collects the coil check's readings while it runs.
void loop();

}  // namespace pcbops

#endif  // HAS_PCB_DRIVER
