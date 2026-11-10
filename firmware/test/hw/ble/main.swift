// A Bluetooth app stand-in for the helmet's protocol (docs/BLE_PROTOCOL.md):
// connects from a Mac and checks that a session survives dropped connections.
// ONLY with the helmet off your head and no coils on the outputs.
//
//   firmware/test/hw/ble/run.sh [cycles=20] [cleanup logFrom=<n> trialFrom=<n> lastSession=<epoch>]
//
// It starts sessions (one log entry). "cleanup" removes it again and needs the
// test build (see ../checks.py); the three numbers say what the board held before.
import CoreBluetooth
import Foundation

let serviceUUID = CBUUID(string: "a3c87500-8ed3-4bdf-8a39-a01bebede295")
let requestUUID = CBUUID(string: "a3c87501-8ed3-4bdf-8a39-a01bebede295")
let responseUUID = CBUUID(string: "a3c87502-8ed3-4bdf-8a39-a01bebede295")
let statusUUID = CBUUID(string: "a3c87503-8ed3-4bdf-8a39-a01bebede295")
let t0 = Date()
func now() -> Double { Date().timeIntervalSince(t0) }
func say(_ s: String) { print(String(format: "%7.2fs  ", now()) + s); fflush(stdout) }

final class Reassembler {
  var buf = Data(); var seq: Int = -1; var active = false
  func push(_ p: Data) -> Data? {
    guard p.count >= 2 else { return nil }
    let s = Int(p[p.startIndex]), flags = p[p.startIndex + 1]
    if flags & 1 != 0 { buf = Data(); seq = s; active = true } else if !active || s != seq { return nil }
    buf.append(p.subdata(in: (p.startIndex + 2)..<p.endIndex))
    if flags & 2 != 0 { active = false; return buf }
    return nil
  }
}

final class Link: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
  let queue = DispatchQueue(label: "ble")
  let cond = NSCondition()
  var central: CBCentralManager!
  var peripheral: CBPeripheral?
  var req: CBCharacteristic?, resp: CBCharacteristic?, stat: CBCharacteristic?
  var state = "off"          // off, on, unauthorized, unsupported
  var found = false, connected = false, ready = false, subscribed = 0, wrote = 0, writeError: String?
  var wantStatus = true, wantResponse = true
  var replies: [[String: Any]] = []
  var statuses: [(Double, [String: Any])] = []
  var drops = 0
  var name = ""
  let tag = Int.random(in: 1..<0x7fffffff)
  var nextId = 1_000_000_000, seq = 0
  let respFrames = Reassembler(), statFrames = Reassembler()

  override init() { super.init(); central = CBCentralManager(delegate: self, queue: queue) }
  func wait(_ seconds: Double, _ done: () -> Bool) -> Bool {
    let end = Date().addingTimeInterval(seconds)
    cond.lock(); defer { cond.unlock() }
    while !done() { if !cond.wait(until: end) { return done() } }
    return true
  }
  func set(_ f: () -> Void) { cond.lock(); f(); cond.broadcast(); cond.unlock() }

  func centralManagerDidUpdateState(_ c: CBCentralManager) {
    set { switch c.state { case .poweredOn: state = "on"; case .unauthorized: state = "unauthorized"; case .unsupported: state = "unsupported"; default: state = "off" } }
  }
  func centralManager(_ c: CBCentralManager, didDiscover p: CBPeripheral, advertisementData: [String: Any], rssi: NSNumber) {
    guard !found else { return }
    set { found = true; peripheral = p; name = p.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? "?") }
    c.stopScan(); p.delegate = self; c.connect(p)
  }
  func centralManager(_ c: CBCentralManager, didConnect p: CBPeripheral) { set { connected = true }; p.discoverServices([serviceUUID]) }
  func centralManager(_ c: CBCentralManager, didFailToConnect p: CBPeripheral, error: Error?) { set { found = false } }
  func centralManager(_ c: CBCentralManager, didDisconnectPeripheral p: CBPeripheral, error: Error?) {
    set { if connected { drops += 1 }; connected = false; ready = false; subscribed = 0; found = false; req = nil; resp = nil; stat = nil }
  }
  func peripheral(_ p: CBPeripheral, didDiscoverServices error: Error?) {
    for s in p.services ?? [] where s.uuid == serviceUUID { p.discoverCharacteristics([requestUUID, responseUUID, statusUUID], for: s) }
  }
  func peripheral(_ p: CBPeripheral, didDiscoverCharacteristicsFor s: CBService, error: Error?) {
    var need = 0
    for ch in s.characteristics ?? [] {
      if ch.uuid == requestUUID { req = ch }
      if ch.uuid == responseUUID { resp = ch; if wantResponse { need += 1; p.setNotifyValue(true, for: ch) } }
      if ch.uuid == statusUUID { stat = ch; if wantStatus { need += 1; p.setNotifyValue(true, for: ch) } }
    }
    if need == 0 { set { ready = true } }
  }
  func peripheral(_ p: CBPeripheral, didUpdateNotificationStateFor ch: CBCharacteristic, error: Error?) {
    set { subscribed += 1; if subscribed >= (wantStatus ? 1 : 0) + (wantResponse ? 1 : 0) { ready = true } }
  }
  func peripheral(_ p: CBPeripheral, didWriteValueFor ch: CBCharacteristic, error: Error?) {
    set { wrote += 1; if let e = error { writeError = e.localizedDescription } }
  }
  func peripheral(_ p: CBPeripheral, didUpdateValueFor ch: CBCharacteristic, error: Error?) {
    guard let v = ch.value else { return }
    let frames = ch.uuid == responseUUID ? respFrames : statFrames
    guard let msg = frames.push(v), let obj = try? JSONSerialization.jsonObject(with: msg) as? [String: Any] else { return }
    set { if ch.uuid == responseUUID { replies.append(obj) } else { statuses.append((now(), obj)) } }
  }

  // ---- blocking calls for the script
  func connect(status: Bool = true, response: Bool = true, timeout: Double = 15) -> Bool {
    wantStatus = status; wantResponse = response
    respFrames.active = false; statFrames.active = false
    set { statuses = []; replies = [] }   // nothing from the last connection
    queue.async { self.central.scanForPeripherals(withServices: [serviceUUID]) }
    let ok = wait(timeout) { self.ready }
    if !ok { queue.async { self.central.stopScan() } }
    return ok
  }
  func disconnect() {
    guard let p = peripheral else { return }
    queue.async { self.central.cancelPeripheralConnection(p) }
    _ = wait(5) { !self.connected }
  }
  func mtu() -> Int { peripheral?.maximumWriteValueLength(for: .withoutResponse) ?? 0 }
  func call(_ op: String, _ params: [String: Any] = [:], timeout: Double = 8) -> [String: Any]? {
    guard let p = peripheral, let ch = req, connected else { return nil }
    let id = (params["id"] as? Int) ?? nextId   // an operation's own id takes the place of the request id
    nextId += 1
    // "c" and "id" first, as the app writes them.
    var rest = params; rest.removeValue(forKey: "id"); rest["op"] = op
    let restJson = String(data: try! JSONSerialization.data(withJSONObject: rest), encoding: .utf8)!
    let body = "{\"c\":\(tag),\"id\":\(id)," + restJson.dropFirst()
    let bytes = Data(body.utf8)
    let s = UInt8(seq & 0xff); seq += 1
    var pos = 0
    repeat {
      let n = min(178, bytes.count - pos)
      var flags: UInt8 = 0
      if pos == 0 { flags |= 1 }
      if pos + n >= bytes.count { flags |= 2 }
      var packet = Data([s, flags]); packet.append(bytes.subdata(in: pos..<(pos + n)))
      cond.lock(); let before = wrote; cond.unlock()
      queue.async { p.writeValue(packet, for: ch, type: .withResponse) }
      if !wait(5, { self.wrote > before || !self.connected }) { return nil }
      pos += n
    } while pos < bytes.count
    var found: [String: Any]?
    _ = wait(timeout) {
      if let i = self.replies.firstIndex(where: { ($0["c"] as? Int) == self.tag && ($0["id"] as? Int) == id }) { found = self.replies.remove(at: i); return true }
      return !self.connected
    }
    return found
  }
  func data(_ op: String, _ params: [String: Any] = [:], timeout: Double = 8) -> [String: Any] {
    guard let r = call(op, params, timeout: timeout) else { say("  \(op): NO REPLY"); return [:] }
    if (r["ok"] as? Bool) != true { say("  \(op): error \(r["error"] ?? "?")"); return ["_error": r["error"] ?? "?"] }
    return (r["data"] as? [String: Any]) ?? [:]
  }
  func takeStatuses() -> [(Double, [String: Any])] { cond.lock(); defer { cond.unlock() }; let s = statuses; statuses = []; return s }
  func lastStatus(within seconds: Double) -> [String: Any]? {
    _ = wait(seconds) { !self.statuses.isEmpty }
    cond.lock(); defer { cond.unlock() }; return statuses.last?.1
  }
}

func brief(_ s: [String: Any]?) -> String {
  guard let s = s else { return "none" }
  return "state \(s["state"] ?? "?") elapsed \(s["elapsedMs"] ?? "?") token '\(s["token"] ?? "")' bootId \(s["bootId"] ?? "?") reason '\(s["lastStopReason"] ?? "")' overruns \(s["overruns"] ?? "?")"
}

let link = Link()
guard link.wait(10, { link.state != "off" }) else { say("Bluetooth did not switch on"); exit(2) }
guard link.state == "on" else { say("Bluetooth is not available to this program: \(link.state)"); exit(3) }
let args = CommandLine.arguments.dropFirst()
func number(_ key: String, _ fallback: Int) -> Int { Int(args.first(where: { $0.hasPrefix(key + "=") })?.dropFirst(key.count + 1) ?? "") ?? fallback }
let cycles = number("cycles", 20)
var failures = 0
func check(_ ok: Bool, _ what: String) { say((ok ? "  ok    " : "  FAIL  ") + what); if !ok { failures += 1 } }

// 1. Connect, subscribe, hello
check(link.connect(), "found, connected and subscribed (\(link.name))")
say("  packet size the Mac negotiated: \(link.mtu()) bytes")
let first = link.lastStatus(within: 1.5)
check(first != nil, "a status arrives right after subscribing: \(brief(first))")
var hello = link.data("hello")
check(hello["firmware"] != nil, "hello answered: firmware \(hello["firmware"] ?? "?") helmetId \(hello["helmetId"] ?? "?") bootId \(hello["bootId"] ?? "?") links \(hello["links"] ?? "?")")
let bootId = hello["bootId"] as? Int ?? -1
_ = link.data("time.set", ["epochMs": Int(Date().timeIntervalSince1970 * 1000)])
if (link.data("status")["state"] as? String) != "idle" { _ = link.data("session.stop"); Thread.sleep(forTimeInterval: 3) }

// 2. Idle status rate
_ = link.takeStatuses(); Thread.sleep(forTimeInterval: 6.2)
let idleCount = link.takeStatuses().count
check(idleCount >= 2 && idleCount <= 4, "idle: \(idleCount) status messages in 6.2 s (every 2 s)")

// 3. A long reply (several packets) and a long request
let list = link.data("log.list", ["offset": 0, "limit": 10])
check(list["total"] != nil, "log.list answered: \(list["total"] ?? "?") entries")
let presetPath = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../../../presets/guide-gateway-4hz.json").standardized
let preset = try! JSONSerialization.jsonObject(with: Data(contentsOf: presetPath)) as! [String: Any]
let token = "mac" + String(Int.random(in: 100000..<999999))
let started = link.data("session.start", ["session": preset, "presetId": "guide-gateway-4hz", "fieldUT": 1.0, "blind": false, "token": token])
let logId = started["logId"] as? Int ?? 0
check(logId > 0, "session.start (a \(try! JSONSerialization.data(withJSONObject: preset).count) byte program in several packets): logId \(logId)")
_ = link.takeStatuses(); Thread.sleep(forTimeInterval: 3.1)
let run = link.takeStatuses()
check(run.count >= 5 && run.count <= 8, "running: \(run.count) status messages in 3.1 s (every 0.5 s); last: \(brief(run.last?.1))")

// 4. Drop and reconnect, many times, while the session runs
var firstStatusWorst = 0.0
var worst = 0.0, lost = 0, lastElapsed = (run.last?.1["elapsedMs"] as? Int) ?? 0
for i in 1...cycles {
  link.disconnect()
  if i % 5 == 0 { Thread.sleep(forTimeInterval: 2.0) }      // sometimes stay away for a while
  let t = now()
  guard link.connect(timeout: 20) else { say("  cycle \(i): could not reconnect"); lost += 1; continue }
  worst = max(worst, now() - t)
  let tReady = now()
  let s = link.lastStatus(within: 1.5)
  firstStatusWorst = max(firstStatusWorst, now() - tReady)
  let elapsed = (s?["elapsedMs"] as? Int) ?? -1
  let ok = (s?["state"] as? String) == "running" && (s?["token"] as? String) == token && elapsed > lastElapsed && (s?["bootId"] as? Int) == bootId
  if !ok { say("  cycle \(i): \(brief(s))"); lost += 1 }
  lastElapsed = max(lastElapsed, elapsed)
  if i % 4 == 0 { let h = link.data("hello"); if (h["bootId"] as? Int) != bootId { say("  cycle \(i): hello bootId \(h["bootId"] ?? "?")"); lost += 1 } }
}
check(lost == 0, "\(cycles) drops and reconnects in mid-session: the session ran on every time, same start of the helmet (slowest reconnect \(String(format: "%.1f", worst)) s, first status at most \(String(format: "%.2f", firstStatusWorst)) s after subscribing)")
say("  now: \(brief(link.lastStatus(within: 1.5)))")

// 5. The same start again (as after a lost reply) starts nothing
let again = link.data("session.start", ["session": preset, "presetId": "guide-gateway-4hz", "fieldUT": 1.0, "blind": false, "token": token])
check((again["logId"] as? Int) == logId && (again["already"] as? Bool) == true, "same token again: \(again)")

// 6. Stop after a reconnect, read the log entry
_ = link.data("session.stop"); Thread.sleep(forTimeInterval: 3.0)
let after = link.data("status")
check((after["state"] as? String) == "idle" && (after["lastStopReason"] as? String) == "stopped from app", "Stop works after reconnecting: \(brief(after))")
let items = (link.data("log.list", ["offset": 0, "limit": 10])["items"] as? [[String: Any]]) ?? []
let entry = items.first { ($0["id"] as? Int) == logId }
check((entry?["finished"] as? Bool) == true, "log entry \(logId): reason '\(entry?["reason"] ?? "?")' elapsed \(entry?["elapsedMs"] ?? "?") token '\(entry?["token"] ?? "?")'")

// 7. Keepalive: an app that is gone, and a connection that does not listen to status
let ka = link.data("settings.set", ["keepaliveS": 5])
check((ka["keepaliveS"] as? Int) == 5, "keepaliveS set to 5")
_ = link.data("test", ["mode": "dc", "channel": 0, "mA": 1.0, "seconds": 60])
Thread.sleep(forTimeInterval: 8)
let held = link.data("status")
check((held["state"] as? String) == "running", "with the app connected for 8 s the session keeps running (\(held["elapsedMs"] ?? "?") ms)")
link.disconnect(); Thread.sleep(forTimeInterval: 9)
_ = link.connect()
let goneStatus = link.data("status")
check((goneStatus["state"] as? String) == "idle" && (goneStatus["lastStopReason"] as? String) == "UI keepalive lost", "app gone for 9 s with keepalive 5 s: \(brief(goneStatus))")
_ = link.data("test", ["mode": "dc", "channel": 0, "mA": 1.0, "seconds": 60])
link.disconnect()
_ = link.connect(status: false)   // connected, but not subscribed to status, and silent
Thread.sleep(forTimeInterval: 9)
let stray = link.data("status")
check((stray["state"] as? String) == "idle" && (stray["lastStopReason"] as? String) == "UI keepalive lost", "a connection that neither listens nor asks does not count as an app: \(brief(stray))")
let off = link.data("settings.set", ["keepaliveS": 0])
check((off["keepaliveS"] as? Int) == 0, "keepaliveS back to 0")
if (link.data("status")["state"] as? String) != "idle" { _ = link.data("session.stop"); Thread.sleep(forTimeInterval: 3) }

// 8. Leave the helmet as it was (test build only)
if args.contains("cleanup") {
  var what: [String: Any] = ["logFrom": number("logFrom", 0), "trialFrom": number("trialFrom", 0)]
  if number("lastSession", -1) >= 0 { what["lastSessionEpoch"] = number("lastSession", 0) }
  say("  cleanup: \(link.data("debug.cleanup", what))")
}
hello = link.data("hello")
say("  at the end: bootId \(hello["bootId"] ?? "?") (was \(bootId)), uptime \(hello["uptimeS"] ?? "?") s, free heap \(hello["freeHeap"] ?? "?"), links \(hello["links"] ?? "?")")
check((hello["bootId"] as? Int) == bootId, "the helmet never restarted during all of this")
link.disconnect()
say(failures == 0 ? "RESULT: all Bluetooth checks passed" : "RESULT: \(failures) check(s) FAILED")
exit(failures == 0 ? 0 : 1)
