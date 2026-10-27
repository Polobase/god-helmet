#include "ble.h"

#include <Arduino.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

#include <map>
#include <string>

#include "bleframe.h"
#include "rpc.h"
#include "sequencer.h"

namespace ble {
namespace {

constexpr const char* kService = "a3c87500-8ed3-4bdf-8a39-a01bebede295";
constexpr const char* kRpcRequest = "a3c87501-8ed3-4bdf-8a39-a01bebede295";
constexpr const char* kRpcResponse = "a3c87502-8ed3-4bdf-8a39-a01bebede295";
constexpr const char* kStatus = "a3c87503-8ed3-4bdf-8a39-a01bebede295";

constexpr size_t kMaxRequestBytes = 96 * 1024;  // sessions with up to 16384 table points
constexpr uint32_t kStatusRunningMs = 500;
constexpr uint32_t kStatusIdleMs = 2000;
constexpr int kMaxConnections = 2;  // receiver app + telepathy sender

BLEServer* gServer = nullptr;
BLECharacteristic* gResponse = nullptr;
BLECharacteristic* gStatus = nullptr;
QueueHandle_t gInbox = nullptr;  // std::string* complete requests
volatile int gConnections = 0;
// Per-connection reassembly; only touched from BLE stack callbacks (one task).
std::map<uint16_t, bleframe::Reassembler> gAssemblers;
uint8_t gResponseSeq = 0;
uint8_t gStatusSeq = 0;
uint32_t gLastStatusMs = 0;

// Smallest MTU among connected apps: notifications go to every subscriber.
size_t packetSize() {
  uint16_t mtu = 0;
  for (auto& peer : gServer->getPeerDevices(false)) {
    if (mtu == 0 || peer.second.mtu < mtu) mtu = peer.second.mtu;
  }
  if (mtu < 23) mtu = 23;
  return mtu - 3;
}

void sendFramed(BLECharacteristic* ch, uint8_t& seq, const std::string& message) {
  const auto packets = bleframe::split(message, seq++, packetSize());
  for (size_t i = 0; i < packets.size(); ++i) {
    ch->setValue(reinterpret_cast<uint8_t*>(const_cast<char*>(packets[i].data())), packets[i].size());
    ch->notify();
    if (packets.size() > 1) delay(8);  // give the controller time to drain its queue
  }
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*, esp_ble_gatts_cb_param_t* param) override {
    ++gConnections;
    gAssemblers.erase(param->connect.conn_id);
    gAssemblers.emplace(param->connect.conn_id, bleframe::Reassembler(kMaxRequestBytes));
    if (gConnections < kMaxConnections) BLEDevice::startAdvertising();
  }
  void onDisconnect(BLEServer*, esp_ble_gatts_cb_param_t* param) override {
    if (gConnections > 0) --gConnections;
    gAssemblers.erase(param->disconnect.conn_id);
    BLEDevice::startAdvertising();
  }
};

class RequestCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* ch, esp_ble_gatts_cb_param_t* param) override {
    auto it = gAssemblers.find(param->write.conn_id);
    if (it == gAssemblers.end()) {
      it = gAssemblers.emplace(param->write.conn_id, bleframe::Reassembler(kMaxRequestBytes)).first;
    }
    if (it->second.push(ch->getData(), ch->getLength())) {
      auto* msg = new std::string(it->second.take());
      if (xQueueSend(gInbox, &msg, 0) != pdTRUE) delete msg;  // inbox full: drop
    }
  }
};

}  // namespace

void begin(const char* name) {
  gInbox = xQueueCreate(6, sizeof(std::string*));
  BLEDevice::init(name);
  BLEDevice::setMTU(517);
  gServer = BLEDevice::createServer();
  gServer->setCallbacks(new ServerCallbacks());

  BLEService* service = gServer->createService(kService);
  BLECharacteristic* request = service->createCharacteristic(
      kRpcRequest, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  request->setCallbacks(new RequestCallbacks());
  gResponse = service->createCharacteristic(kRpcResponse, BLECharacteristic::PROPERTY_NOTIFY);
  gResponse->addDescriptor(new BLE2902());
  gStatus = service->createCharacteristic(kStatus, BLECharacteristic::PROPERTY_NOTIFY);
  gStatus->addDescriptor(new BLE2902());
  service->start();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(kService);
  adv->setScanResponse(true);
  adv->setMinPreferred(0x06);  // helps iOS connect
  BLEDevice::startAdvertising();
}

void loop() {
  std::string* msg = nullptr;
  if (xQueueReceive(gInbox, &msg, 0) == pdTRUE && msg != nullptr) {
    const std::string reply = rpc::handle(*msg);
    delete msg;
    if (gConnections > 0) sendFramed(gResponse, gResponseSeq, reply);
  }

  if (gConnections > 0) {
    seq::keepalive();
    const uint32_t interval = seq::busy() ? kStatusRunningMs : kStatusIdleMs;
    if (millis() - gLastStatusMs >= interval) {
      gLastStatusMs = millis();
      sendFramed(gStatus, gStatusSeq, rpc::statusJson());
    }
  }
}

int connections() { return gConnections; }

}  // namespace ble
