// Blinded remote-viewing / telepathy trials.
//
// The target pictures live in the web app. The app sends the pool's set ids,
// their sizes and the SHA-256 of the pool manifest (which lists every
// picture's hash). The device picks the set, the target and active/sham with
// its hardware RNG and publishes a SHA-256 commitment before any response
// exists. Flow: create -> response written in the app -> lock (response hash
// stored) -> judge (device shuffles the display order) -> ranks -> reveal.
#pragma once
#include <Arduino.h>

#include <vector>

#include "minijson.h"
#include "session.h"

namespace experiment {

struct SetRef {
  String id;
  int size = 0;
};

struct CreateRequest {
  String mode = "rv";                 // "rv" or "telepathy"
  String manifestHash;                // 64 hex chars
  std::vector<SetRef> sets;
  engine::Session* session = nullptr; // optional stimulation; ownership passes on success
  String presetId;
  bool blind = true;
  float fieldUT = 1.0f;
};

bool create(CreateRequest& req, String& json, String& error);
bool lock(uint32_t id, const String& responseHash, String& json, String& error);
bool startJudging(uint32_t id, String& json, String& error);
bool submitRanks(uint32_t id, const std::vector<int>& ranks, String& json, String& error);
bool reveal(uint32_t id, String& json, String& error);
bool abort(uint32_t id, String& error);
// For the telepathy sender: which picture to show (open trials only).
bool senderTarget(uint32_t id, String& json, String& error);

String get(uint32_t id);  // public view or empty
String stateOf(uint32_t id);  // "open" ... "aborted", or empty if unknown
void writeList(mj::Writer& w, size_t offset, size_t limit);

bool validSetId(const String& id);

}  // namespace experiment
