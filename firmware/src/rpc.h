// JSON-RPC style command handling, transport-independent (BLE: ble.cpp, USB: usblink.cpp).
//
// Request:  {"c": <client tag>, "id": <n>, "op": "session.start", ...params}
// Response: {"c": <tag>, "id": <n>, "ok": true, "data": {...}}
//        or {"c": <tag>, "id": <n>, "ok": false, "error": "..."}
// Operations are listed in docs/BLE_PROTOCOL.md.
#pragma once
#include <cstddef>
#include <string>

namespace rpc {

constexpr size_t kMaxRequestBytes = 96 * 1024;  // sessions with up to 16384 table points

// Never throws: running out of memory is answered with an error reply.
// `valid` (optional): the request was a JSON object with an "op", i.e. an app
// is really there (keepalive, status LED); line noise is not.
// Takes the request text over and frees it as soon as it has been read, so a
// large program does not sit in memory twice while its session is built.
std::string handle(std::string request, bool* valid = nullptr);
// Live status: pushed on the BLE status characteristic, asked for over USB ("status").
std::string statusJson();

}  // namespace rpc
