// JSON-RPC style command handling, transport-independent (used over BLE).
//
// Request:  {"c": <client tag>, "id": <n>, "op": "session.start", ...params}
// Response: {"c": <tag>, "id": <n>, "ok": true, "data": {...}}
//        or {"c": <tag>, "id": <n>, "ok": false, "error": "..."}
// Operations are listed in docs/BLE_PROTOCOL.md.
#pragma once
#include <string>

namespace rpc {

std::string handle(const std::string& request);
// Live status pushed on the status characteristic.
std::string statusJson();

}  // namespace rpc
