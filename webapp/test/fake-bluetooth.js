// Stand-ins for navigator.bluetooth and a BluetoothDevice, with a fake helmet
// behind them that speaks the framed protocol (docs/BLE_PROTOCOL.md).
import { UUIDS } from '../src/ble/bluetooth.js'
import { split, Reassembler } from '../src/ble/frame.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const enc = new TextEncoder()
const dec = new TextDecoder()

// A helmet on a fake BluetoothDevice. `answer(req)` returns the reply's fields
// ({ ok, data } or { ok: false, error }), or null to stay silent.
export function fakeHelmet({ id = 'dev-1', name = 'GodHelmet-B084', answer = (req) => ({ ok: true, data: { op: req.op } }) } = {}) {
  const helmet = { requests: [], connects: 0, dropListeners: 0, answer }
  let seq = 0
  class Characteristic extends EventTarget {
    constructor(uuid) {
      super()
      this.uuid = uuid
    }
    async startNotifications() {
      this.notifying = true
    }
    notify(json) {
      for (const packet of split(enc.encode(JSON.stringify(json)), seq++ & 0xff, 20)) {
        const e = new Event('characteristicvaluechanged')
        Object.defineProperty(e, 'target', { value: { value: new DataView(packet.buffer) } })
        this.dispatchEvent(e)
      }
    }
  }
  const device = new EventTarget()
  const listen = device.addEventListener.bind(device)
  device.addEventListener = (type, ...rest) => {
    if (type === 'gattserverdisconnected') helmet.dropListeners++
    listen(type, ...rest)
  }
  Object.assign(device, { id, name })
  device.gatt = {
    connected: false,
    async connect() {
      if (helmet.outOfRange) throw new Error('Bluetooth Device is no longer in range.')
      helmet.connects++
      this.connected = true
      const frames = new Reassembler()
      const chars = { [UUIDS.request]: new Characteristic(UUIDS.request), [UUIDS.response]: new Characteristic(UUIDS.response), [UUIDS.status]: new Characteristic(UUIDS.status) }
      helmet.chars = chars
      chars[UUIDS.request].writeValueWithResponse = async (packet) => {
        if (!device.gatt.connected) throw new Error('GATT Server is disconnected.')
        const msg = frames.push(new Uint8Array(packet))
        if (!msg) return
        const req = JSON.parse(dec.decode(msg))
        helmet.requests.push(req)
        const reply = helmet.answer(req)
        if (reply) setTimeout(() => chars[UUIDS.response].notify({ c: req.c, id: req.id, ...reply }), 1)
      }
      if (helmet.dropWhileConnecting) setTimeout(() => helmet.drop(), 0)
      return {
        async getPrimaryService() {
          await sleep(5)
          if (!device.gatt.connected) throw new Error('GATT Server is disconnected. Cannot retrieve services.')
          return { getCharacteristic: async (uuid) => chars[uuid] }
        },
      }
    },
    disconnect() {
      if (!this.connected) return
      this.connected = false
      device.dispatchEvent(new Event('gattserverdisconnected'))
    },
  }
  helmet.device = device
  helmet.drop = () => device.gatt.disconnect()
  helmet.pushStatus = (s) => helmet.chars[UUIDS.status].notify(s)
  helmet.reply = (json) => helmet.chars[UUIDS.response].notify(json)
  return helmet
}

export function fakeBluetooth(helmet, { remembers = false } = {}) {
  const bluetooth = { choosers: 0, asked: 0 }
  bluetooth.requestDevice = async () => {
    bluetooth.choosers++
    return helmet.device
  }
  if (remembers) {
    bluetooth.getDevices = async () => {
      bluetooth.asked++
      return [helmet.device]
    }
  }
  return bluetooth
}
