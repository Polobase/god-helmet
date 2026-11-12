#include "ble.h"

#include <Arduino.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <esp_gap_ble_api.h>
#include <esp_gatts_api.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

#include <atomic>
#include <cstring>
#include <new>
#include <string>

#include "bleframe.h"
#include "conn.h"
#include "outbox.h"
#include "rpc.h"
#include "sequencer.h"
#include "wire.h"

namespace ble {
namespace {

constexpr const char* kService = "a3c87500-8ed3-4bdf-8a39-a01bebede295";
constexpr const char* kRpcRequest = "a3c87501-8ed3-4bdf-8a39-a01bebede295";
constexpr const char* kRpcResponse = "a3c87502-8ed3-4bdf-8a39-a01bebede295";
constexpr const char* kStatus = "a3c87503-8ed3-4bdf-8a39-a01bebede295";

using hlink::kSlots;
using rpc::kMaxRequestBytes;
constexpr uint32_t kStatusRunningMs = 500;
constexpr uint32_t kStatusIdleMs = 2000;
constexpr int kMaxConnections = 2;        // receiver app + telepathy sender
constexpr size_t kHead = 96;              // start of a request: enough to name it in an error reply
constexpr uint32_t kAdvertiseCheckMs = 2000;

// A notification larger than this overruns a buffer inside the stack.
static_assert(hlink::kMaxPayload <= ESP_GATT_MAX_ATTR_LEN, "notification packets larger than the stack accepts");
// The stack numbers its connections 0..CONFIG_BT_ACL_CONNECTIONS-1.
static_assert(CONFIG_BT_ACL_CONNECTIONS <= kSlots, "more connection ids than lib/link/conn.h has slots");

// ---- Written by the Bluetooth task, read by the loop task -------------------
std::atomic<uint32_t> gConn[kSlots];      // hlink::Conn, packed
std::atomic<bool> gAdvertising{false};
std::atomic<uint16_t> gIf{ESP_GATT_IF_NONE};  // the stack's handle for our GATT server

// ---- Bluetooth task only ----------------------------------------------------
struct Receiver {
  bleframe::Reassembler frames{kMaxRequestBytes};
  char head[kHead];
  uint8_t headLen = 0;
  int headSeq = -1;
};
Receiver gRx[kSlots];
uint16_t gResponseCccd = 0;  // handles of the two "notifications on/off" descriptors
uint16_t gStatusCccd = 0;

// ---- From the Bluetooth task to the loop task --------------------------------
struct Request {
  uint8_t slot;
  uint8_t generation;   // which connection on that slot (hlink::Conn::generation)
  std::string* text;    // the request; owned by whoever holds the item
};
struct Notice {         // a request that had to be dropped: tell its sender
  uint8_t slot;
  uint8_t generation;
  long long c, id;
  const char* error;    // a string literal
};
QueueHandle_t gInbox = nullptr;
QueueHandle_t gNotices = nullptr;

// ---- Loop task only -----------------------------------------------------------
uint16_t gResponseHandle = 0;
uint16_t gStatusHandle = 0;
hlink::Outbox gReplies[kSlots];
hlink::Outbox gStatusOut[kSlots];
uint8_t gSeenGeneration[kSlots] = {0};
bool gSeenStatus[kSlots] = {false};  // this connection has had its first status
uint32_t gLastStatusMs = 0;
uint32_t gAdvertiseCheckMs = 0;

// ------------------------------------------------------------ Bluetooth task

int connected() {
  int n = 0;
  for (auto& w : gConn) n += hlink::unpack(w.load()).connected ? 1 : 0;
  return n;
}

void notice(uint16_t slot, const char* error, long long c, long long id) {
  Notice n{static_cast<uint8_t>(slot), hlink::unpack(gConn[slot].load()).generation, c, id, error};
  xQueueSend(gNotices, &n, 0);  // full: the app runs into its own timeout instead
}

// One packet of a request has arrived on `slot`.
void receive(uint16_t slot, const uint8_t* data, size_t len) {
  if (slot >= kSlots || len < bleframe::kHeader) return;
  gConn[slot].store(hlink::onTraffic(gConn[slot].load()));  // a connect event we did not see
  Receiver& rx = gRx[slot];

  // The start of the message, kept apart: "c" and "id" for an error reply.
  const int seq = data[0];
  if (data[1] & bleframe::kFirst) {
    rx.headSeq = seq;
    rx.headLen = 0;
  }
  if (seq == rx.headSeq && rx.headLen < kHead) {
    const size_t n = std::min(len - bleframe::kHeader, kHead - rx.headLen);
    std::memcpy(rx.head + rx.headLen, data + bleframe::kHeader, n);
    rx.headLen += n;
  }
  long long c = 0, id = 0;

  bool complete = false;
  try {
    complete = rx.frames.push(data, len);
  } catch (const std::bad_alloc&) {
    // No memory for a request this large. An exception must not leave this
    // task: it would restart the board, and a session may be running.
    rx.frames.abandon();
    hlink::peekTag(rx.head, rx.headLen, c, id);
    notice(slot, "out of memory (program too large for this board)", c, id);
    return;
  }
  switch (rx.frames.takeDrop()) {
    case bleframe::Drop::TooLarge:
      hlink::peekTag(rx.head, rx.headLen, c, id);
      notice(slot, "request too large (96 KB at most)", c, id);
      break;
    case bleframe::Drop::NoStart:
      notice(slot, "request damaged: start missing", 0, 0);  // whose it was is not known
      break;
    case bleframe::Drop::None:
      break;
  }
  if (!complete) return;

  auto* text = new (std::nothrow) std::string(rx.frames.take());  // moved, not copied
  Request r{static_cast<uint8_t>(slot), hlink::unpack(gConn[slot].load()).generation, text};
  if (text != nullptr && xQueueSend(gInbox, &r, 0) == pdTRUE) return;
  if (text != nullptr) hlink::peekTag(text->data(), text->size(), c, id);
  delete text;
  notice(slot, "busy: request dropped", c, id);
}

class RequestCallbacks : public BLECharacteristicCallbacks {
  // Called for a plain write and at the end of a long (prepared) write.
  void onWrite(BLECharacteristic* ch, esp_ble_gatts_cb_param_t* param) override {
    receive(param->write.conn_id, ch->getData(), ch->getLength());
  }
};

// Every GATT server event, after the library has handled it.
void onGatts(esp_gatts_cb_event_t event, esp_gatt_if_t gattsIf, esp_ble_gatts_cb_param_t* p) {
  switch (event) {
    case ESP_GATTS_REG_EVT:
      gIf = gattsIf;
      break;
    case ESP_GATTS_CONNECT_EVT: {
      gIf = gattsIf;
      const uint16_t slot = p->connect.conn_id;
      if (slot < kSlots) {
        gConn[slot].store(hlink::onConnect(gConn[slot].load()));
        gRx[slot] = Receiver();
      }
      gAdvertising = false;  // advertising ends when a connection is made
      if (connected() < kMaxConnections) BLEDevice::startAdvertising();
      break;
    }
    case ESP_GATTS_DISCONNECT_EVT: {
      const uint16_t slot = p->disconnect.conn_id;
      if (slot < kSlots) {
        gConn[slot].store(hlink::onDisconnect(gConn[slot].load()));
        gRx[slot] = Receiver();  // also gives a half-received request's memory back
      }
      BLEDevice::startAdvertising();
      break;
    }
    case ESP_GATTS_MTU_EVT:
      if (p->mtu.conn_id < kSlots)
        gConn[p->mtu.conn_id].store(hlink::onMtu(gConn[p->mtu.conn_id].load(), p->mtu.mtu));
      break;
    case ESP_GATTS_CONGEST_EVT:
      if (p->congest.conn_id < kSlots)
        gConn[p->congest.conn_id].store(hlink::onCongest(gConn[p->congest.conn_id].load(), p->congest.congested));
      break;
    case ESP_GATTS_WRITE_EVT: {
      // An app switching notifications on or off for one of the two characteristics.
      const uint16_t slot = p->write.conn_id;
      const bool response = p->write.handle == gResponseCccd, status = p->write.handle == gStatusCccd;
      if (slot >= kSlots || p->write.is_prep || p->write.len < 2 || (!response && !status)) break;
      const uint16_t cccd = static_cast<uint16_t>(p->write.value[0] | (p->write.value[1] << 8));
      const uint32_t before = hlink::onTraffic(gConn[slot].load());
      gConn[slot].store(hlink::onSubscribe(before, response ? hlink::Channel::Response : hlink::Channel::Status, cccd));
      break;
    }
    default:
      break;
  }
}

void onGap(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t* p) {
  if (event == ESP_GAP_BLE_ADV_START_COMPLETE_EVT) gAdvertising = p->adv_start_cmpl.status == ESP_BT_STATUS_SUCCESS;
  else if (event == ESP_GAP_BLE_ADV_STOP_COMPLETE_EVT) gAdvertising = false;
}

// ------------------------------------------------------------------ loop task

void forget(int slot) {
  gReplies[slot].clear();
  gStatusOut[slot].clear();
  gSeenStatus[slot] = false;
}

// Sends at most one packet on this connection.
void pump(int slot, uint32_t word, uint32_t now) {
  const hlink::Conn conn = hlink::unpack(word);
  hlink::Outbox* boxes[] = {&gReplies[slot], &gStatusOut[slot]};
  const uint16_t handles[] = {gResponseHandle, gStatusHandle};
  for (int i = 0; i < 2; ++i) {
    const std::string* packet = boxes[i]->next(now, hlink::payloadSize(word));
    if (packet == nullptr) continue;
    if (conn.congested) {  // the stack asked us to hold off
      boxes[i]->congested(now);
      return;
    }
    const esp_err_t err =
        esp_ble_gatts_send_indicate(static_cast<esp_gatt_if_t>(gIf.load()), static_cast<uint16_t>(slot), handles[i], static_cast<uint16_t>(packet->size()),
                                    reinterpret_cast<uint8_t*>(const_cast<char*>(packet->data())), false);
    if (err == ESP_OK) boxes[i]->sent(now);
    else if (err == ESP_ERR_INVALID_STATE) forget(slot);  // gone; its disconnect event is on the way
    else boxes[i]->congested(now);                         // queue full: the same packet again shortly
    return;
  }
}

// Reads the connection table. What was waiting for a connection that is
// gone, or that has been replaced by another app on the same id, is dropped.
void sync(uint32_t words[kSlots]) {
  for (int i = 0; i < kSlots; ++i) {
    words[i] = gConn[i].load();
    const hlink::Conn c = hlink::unpack(words[i]);
    if (!c.connected || c.generation != gSeenGeneration[i]) forget(i);
    gSeenGeneration[i] = c.generation;
  }
}

void serve() {
  uint32_t now = millis();
  uint32_t words[kSlots];
  sync(words);

  // Requests that had to be dropped: their senders hear it at once.
  Notice n;
  while (xQueueReceive(gNotices, &n, 0) == pdTRUE) {
    if (hlink::canReply(words[n.slot], n.generation)) gReplies[n.slot].push(hlink::errorReply(n.c, n.id, n.error));
  }

  // One request per pass. The reply goes to the app that asked, nobody else.
  Request r;
  if (xQueueReceive(gInbox, &r, 0) == pdTRUE) {
    bool valid = false;
    std::string reply = rpc::handle(std::move(*r.text), &valid);
    delete r.text;
    if (valid) seq::keepalive();
    // Handling can take a second (the log is read from flash). The app may
    // have gone meanwhile and another one taken its place: look again.
    sync(words);
    now = millis();
    if (!reply.empty() && hlink::canReply(words[r.slot], r.generation)) gReplies[r.slot].push(std::move(reply));
  }

  // Status: to the apps that subscribed, at once after subscribing and then at the usual rate.
  if (hlink::statusSubscribers(words) > 0) {
    seq::keepalive();  // an app is present (Settings::keepaliveS)
    const bool due = now - gLastStatusMs >= (seq::busy() ? kStatusRunningMs : kStatusIdleMs);
    bool fresh = false;
    for (int i = 0; i < kSlots; ++i) fresh |= hlink::wantsStatus(words[i]) && !gSeenStatus[i];
    if (due || fresh) {
      const std::string status = rpc::statusJson();
      for (int i = 0; i < kSlots; ++i) {
        if (!hlink::wantsStatus(words[i]) || !(due || !gSeenStatus[i])) continue;
        gStatusOut[i].push(status, true);
        gSeenStatus[i] = true;
      }
      if (due) gLastStatusMs = now;
    }
  }
  for (int i = 0; i < kSlots; ++i)
    if (!hlink::wantsStatus(words[i])) gSeenStatus[i] = false;

  for (int i = 0; i < kSlots; ++i)
    if (hlink::unpack(words[i]).connected) pump(i, words[i], now);

  // The helmet must stay reachable: if advertising did not come back after a
  // disconnect (the start can fail), try again.
  if (now - gAdvertiseCheckMs >= kAdvertiseCheckMs) {
    gAdvertiseCheckMs = now;
    if (!gAdvertising && hlink::connectedCount(words) < kMaxConnections) BLEDevice::startAdvertising();
  }
}

}  // namespace

void begin(const char* name) {
  gInbox = xQueueCreate(6, sizeof(Request));
  gNotices = xQueueCreate(8, sizeof(Notice));
  for (auto& w : gConn) w.store(0);
  BLEDevice::init(name);
  BLEDevice::setMTU(hlink::kMaxMtu);
  BLEDevice::setCustomGattsHandler(onGatts);
  BLEDevice::setCustomGapHandler(onGap);
  BLEServer* server = BLEDevice::createServer();

  BLEService* service = server->createService(kService);
  BLECharacteristic* request = service->createCharacteristic(
      kRpcRequest, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  request->setCallbacks(new RequestCallbacks());
  BLECharacteristic* response = service->createCharacteristic(kRpcResponse, BLECharacteristic::PROPERTY_NOTIFY);
  BLE2902* responseCccd = new BLE2902();
  response->addDescriptor(responseCccd);
  BLECharacteristic* status = service->createCharacteristic(kStatus, BLECharacteristic::PROPERTY_NOTIFY);
  BLE2902* statusCccd = new BLE2902();
  status->addDescriptor(statusCccd);
  service->start();
  // Known once the service has started. No app can connect before advertising begins.
  gResponseHandle = response->getHandle();
  gStatusHandle = status->getHandle();
  gResponseCccd = responseCccd->getHandle();
  gStatusCccd = statusCccd->getHandle();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(kService);
  adv->setScanResponse(true);
  adv->setMinPreferred(0x06);  // helps iOS connect
  BLEDevice::startAdvertising();
}

void loop() {
  if (gInbox == nullptr) return;  // Bluetooth not started
  try {
    serve();
  } catch (const std::bad_alloc&) {
    // No memory to queue a reply or the status: drop what is waiting rather
    // than restart the board. The apps ask again.
    for (int i = 0; i < kSlots; ++i) forget(i);
  }
}

int connections() {
  if (gInbox == nullptr) return 0;
  int n = 0;
  for (auto& w : gConn) n += hlink::unpack(w.load()).connected ? 1 : 0;
  return n;
}

int statusSubscribers() {
  if (gInbox == nullptr) return 0;
  int n = 0;
  for (auto& w : gConn) n += hlink::wantsStatus(w.load()) ? 1 : 0;
  return n;
}

}  // namespace ble
