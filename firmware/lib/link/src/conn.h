// The state of one Bluetooth connection, packed into one 32-bit word.
//
// The Bluetooth task writes these words (connect, disconnect, MTU exchange,
// subscribing to notifications); the loop task only reads them. One atomic
// word per connection id means every read is a consistent snapshot without a
// lock, and the Bluetooth task can never be held up by the loop task.
//
// The generation counts connections on the same id: a reply addressed to
// (id, generation) is dropped when another app has taken that id meanwhile.
#pragma once
#include <cstddef>
#include <cstdint>

namespace hlink {

constexpr int kSlots = 4;          // the stack's connection ids are 0..3
constexpr uint16_t kMinMtu = 23;   // before the MTU exchange
constexpr uint16_t kMaxMtu = 517;
// The longest value one notification may carry: 512 bytes, the limit of the
// Bluetooth specification and the size of the stack's own buffer. A link with
// the largest MTU (517) would have room for 514; sending that many overruns
// the stack's buffer and restarts the board.
constexpr size_t kMaxPayload = 512;

enum class Channel : uint8_t { Response, Status };

struct Conn {
  bool connected = false;
  bool subResponse = false;  // subscribed to the response characteristic
  bool subStatus = false;    // subscribed to the status characteristic
  bool congested = false;    // the stack asked us to hold off
  uint8_t generation = 0;
  uint16_t mtu = kMinMtu;
};

uint32_t pack(const Conn& c);
Conn unpack(uint32_t word);

uint32_t onConnect(uint32_t prev);
// A disconnect for a slot that is not connected changes nothing.
uint32_t onDisconnect(uint32_t prev);
uint32_t onMtu(uint32_t prev, uint16_t mtu);
// A write to a client configuration descriptor: bit 0 = notifications.
uint32_t onSubscribe(uint32_t prev, Channel channel, uint16_t cccd);
uint32_t onCongest(uint32_t prev, bool congested);
// A request arrived from a slot we believed gone (a missed connect event).
uint32_t onTraffic(uint32_t prev);

// Bytes of one notification's payload for this connection: MTU - 3, at most kMaxPayload.
size_t payloadSize(uint32_t word);
// A reply for (generation) may be sent on this connection.
bool canReply(uint32_t word, uint8_t generation);
bool wantsStatus(uint32_t word);
int connectedCount(const uint32_t* words, int n = kSlots);
int statusSubscribers(const uint32_t* words, int n = kSlots);

}  // namespace hlink
