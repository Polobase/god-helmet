#include "storage.h"

#include <Arduino.h>
#include <LittleFS.h>

#include "sequencer.h"

namespace storage {
namespace {

constexpr uint32_t kSettleMs = 2000;  // several writes in a row: measure once

uint32_t gUsed = 0;
uint32_t gTotal = 0;
bool gDirty = false;
uint32_t gChangedMs = 0;

void measure() {
  gTotal = LittleFS.totalBytes();
  gUsed = LittleFS.usedBytes();
  gDirty = false;
}

}  // namespace

void begin() { measure(); }

void changed() {
  gDirty = true;
  gChangedMs = millis();
}

void loop() {
  if (gDirty && !seq::busy() && millis() - gChangedMs >= kSettleMs) measure();
}

uint32_t usedBytes() { return gUsed; }
uint32_t totalBytes() { return gTotal; }

}  // namespace storage
