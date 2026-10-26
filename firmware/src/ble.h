// BLE GATT transport for the web app (Web Bluetooth).
//
// Service a3c87500-8ed3-4bdf-8a39-a01bebede295
//   ...7501  rpc request   (write)          app -> device, framed JSON
//   ...7502  rpc response  (notify)         device -> app, framed JSON
//   ...7503  status        (notify)         device -> app, framed JSON, 2 Hz while running
// Framing: lib/bleframe. Up to two apps may be connected at once (receiver +
// telepathy sender); responses carry the requesting app's client tag "c".
#pragma once

namespace ble {

void begin(const char* name);
// Handles queued requests and pushes status; call from loop().
void loop();
int connections();

}  // namespace ble
