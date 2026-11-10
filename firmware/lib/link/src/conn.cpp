#include "conn.h"

namespace hlink {
namespace {
constexpr uint32_t kConnected = 1u << 0;
constexpr uint32_t kSubResponse = 1u << 1;
constexpr uint32_t kSubStatus = 1u << 2;
constexpr uint32_t kCongested = 1u << 3;
uint16_t clampMtu(uint32_t mtu) { return mtu < kMinMtu ? kMinMtu : mtu > kMaxMtu ? kMaxMtu : static_cast<uint16_t>(mtu); }
}  // namespace

uint32_t pack(const Conn& c) {
  return (c.connected ? kConnected : 0) | (c.subResponse ? kSubResponse : 0) | (c.subStatus ? kSubStatus : 0) |
         (c.congested ? kCongested : 0) | (static_cast<uint32_t>(c.generation) << 8) |
         (static_cast<uint32_t>(clampMtu(c.mtu)) << 16);
}

Conn unpack(uint32_t word) {
  Conn c;
  c.connected = word & kConnected;
  c.subResponse = word & kSubResponse;
  c.subStatus = word & kSubStatus;
  c.congested = word & kCongested;
  c.generation = static_cast<uint8_t>(word >> 8);
  c.mtu = clampMtu(word >> 16);
  return c;
}

uint32_t onConnect(uint32_t prev) {
  Conn c;
  c.connected = true;
  c.generation = static_cast<uint8_t>(unpack(prev).generation + 1);
  return pack(c);
}

uint32_t onDisconnect(uint32_t prev) {
  Conn c = unpack(prev);
  if (!c.connected) return prev;
  Conn gone;
  gone.generation = c.generation;
  return pack(gone);
}

uint32_t onMtu(uint32_t prev, uint16_t mtu) {
  Conn c = unpack(prev);
  if (!c.connected) return prev;
  c.mtu = clampMtu(mtu);
  return pack(c);
}

uint32_t onSubscribe(uint32_t prev, Channel channel, uint16_t cccd) {
  Conn c = unpack(prev);
  if (!c.connected) return prev;
  const bool on = cccd & 0x0001;
  if (channel == Channel::Response) c.subResponse = on;
  else c.subStatus = on;
  return pack(c);
}

uint32_t onCongest(uint32_t prev, bool congested) {
  Conn c = unpack(prev);
  if (!c.connected) return prev;
  c.congested = congested;
  return pack(c);
}

uint32_t onTraffic(uint32_t prev) { return unpack(prev).connected ? prev : onConnect(prev); }

size_t payloadSize(uint32_t word) {
  const size_t room = static_cast<size_t>(unpack(word).mtu) - 3;
  return room > kMaxPayload ? kMaxPayload : room;
}

bool canReply(uint32_t word, uint8_t generation) {
  const Conn c = unpack(word);
  return c.connected && c.generation == generation;
}

bool wantsStatus(uint32_t word) {
  const Conn c = unpack(word);
  return c.connected && c.subStatus;
}

int connectedCount(const uint32_t* words, int n) {
  int count = 0;
  for (int i = 0; i < n; ++i) count += unpack(words[i]).connected ? 1 : 0;
  return count;
}

int statusSubscribers(const uint32_t* words, int n) {
  int count = 0;
  for (int i = 0; i < n; ++i) count += wantsStatus(words[i]) ? 1 : 0;
  return count;
}

}  // namespace hlink
