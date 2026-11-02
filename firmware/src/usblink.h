// USB control: the Bluetooth protocol (rpc::handle) as one JSON line per
// message on the board's USB serial port(s), for the web app's "USB" button
// (Web Serial) or any terminal program. docs/BLE_PROTOCOL.md, section USB.
//
//   app -> board:  {"c":<tag>,"id":<n>,"op":"hello",...}\n
//   board -> app:  @{"c":<tag>,"id":<n>,"ok":true,"data":{...}}\n
//
// Every other line the board writes is log text. No status is pushed over USB:
// the app asks with the "status" op.
#pragma once

namespace usblink {

// Opens the port(s) at 115200 baud. Call before any log output.
void begin();
// Reads requests and answers them; runs in the Arduino loop task, like ble::loop().
void loop();
// Ports that sent a request in the last 10 s.
int connections();
// Log text on every port.
void logf(const char* fmt, ...) __attribute__((format(printf, 1, 2)));

}  // namespace usblink
