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

std::string handle(const std::string& request);
// Live status: pushed on the BLE status characteristic, asked for over USB ("status").
std::string statusJson();

}  // namespace rpc
