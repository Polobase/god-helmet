// BLE GATT transport for the web app (Web Bluetooth).
//
// Service a3c87500-8ed3-4bdf-8a39-a01bebede295
//   ...7501  rpc request   (write)          app -> device, framed JSON
//   ...7502  rpc response  (notify)         device -> app, framed JSON
//   ...7503  status        (notify)         device -> app, framed JSON, 2 Hz while running
// Framing: lib/bleframe. Up to two apps may be connected at once (receiver +
// telepathy sender). A response goes only to the app that asked (and carries
// its client tag "c"); status goes to every app that subscribed to it, once
// right after subscribing and then every 0.5 s (running) or 2 s (idle).
//
// Connections come and go while the loop task is sending, so this module
// keeps its own table of them (lib/link/conn.h): one atomic word per
// connection, written only by the Bluetooth task. The loop task sends to each
// connection directly and never reads the library's connection list.
#pragma once

namespace ble {

void begin(const char* name);
// Handles queued requests, sends replies and status; call from loop(). Never blocks.
void loop();
int connections();
// Connected apps that listen to the status characteristic (what counts as
// "an app is present" for the keepalive setting).
int statusSubscribers();

}  // namespace ble
