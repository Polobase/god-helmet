// Web Bluetooth transport (docs/BLE_PROTOCOL.md).
import { split, Reassembler } from './frame.js'

export const UUIDS = {
  service: 'a3c87500-8ed3-4bdf-8a39-a01bebede295',
  request: 'a3c87501-8ed3-4bdf-8a39-a01bebede295',
  response: 'a3c87502-8ed3-4bdf-8a39-a01bebede295',
  status: 'a3c87503-8ed3-4bdf-8a39-a01bebede295',
}

// 180-byte writes fit the 185-byte ATT MTU that iOS and macOS negotiate;
// Android Chrome negotiates more, which only matters for notifications.
const PACKET_SIZE = 180
const TIMEOUT_MS = 20000
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const bluetoothAvailable = () => typeof navigator !== 'undefined' && !!navigator.bluetooth

const bytesOf = (dataView) => new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength)

export async function openBluetooth({ onStatus, onDisconnect }) {
  if (!bluetoothAvailable()) throw new Error('This browser has no Web Bluetooth. Use Chrome or Edge (Android, Mac, Windows), or the Bluefy browser on iPhone.')
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [UUIDS.service] }, { namePrefix: 'GodHelmet' }],
    optionalServices: [UUIDS.service],
  })
  device.addEventListener('gattserverdisconnected', () => onDisconnect?.())
  const server = await device.gatt.connect()
  const service = await server.getPrimaryService(UUIDS.service)
  const [request, response, status] = await Promise.all([
    service.getCharacteristic(UUIDS.request),
    service.getCharacteristic(UUIDS.response),
    service.getCharacteristic(UUIDS.status),
  ])

  // Two apps may share the helmet (receiver + telepathy sender); the tag
  // tells our responses apart from theirs.
  const tag = crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff
  const pending = new Map()
  const responseFrames = new Reassembler()
  const statusFrames = new Reassembler()

  response.addEventListener('characteristicvaluechanged', (e) => {
    const msg = responseFrames.push(bytesOf(e.target.value))
    if (!msg) return
    let json
    try {
      json = JSON.parse(decoder.decode(msg))
    } catch {
      return
    }
    if (json.c !== tag) return
    const p = pending.get(json.id)
    if (!p) return
    pending.delete(json.id)
    clearTimeout(p.timer)
    if (json.ok) p.resolve(json.data)
    else p.reject(new Error(json.error))
  })
  status.addEventListener('characteristicvaluechanged', (e) => {
    const msg = statusFrames.push(bytesOf(e.target.value))
    if (!msg) return
    try {
      onStatus?.(JSON.parse(decoder.decode(msg)))
    } catch {
      /* ignore a damaged frame; the next one comes within 2 s */
    }
  })
  await response.startNotifications()
  await status.startNotifications()

  let nextId = 0
  let seq = 0
  let chain = Promise.resolve()  // GATT allows one operation at a time

  async function write(bytes) {
    for (const packet of split(bytes, seq++ & 0xff, PACKET_SIZE)) {
      if (request.writeValueWithResponse) await request.writeValueWithResponse(packet)
      else await request.writeValue(packet)
    }
  }

  function call(op, params = {}) {
    const id = ++nextId
    const body = encoder.encode(JSON.stringify({ c: tag, id, op, ...params }))
    const result = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`${op}: no answer from the helmet`))
      }, TIMEOUT_MS)
      pending.set(id, { resolve, reject, timer })
    })
    chain = chain
      .then(() => write(body))
      .catch((err) => {
        const p = pending.get(id)
        if (p) {
          pending.delete(id)
          clearTimeout(p.timer)
          p.reject(err)
        }
      })
    return result
  }

  return {
    kind: 'ble',
    name: device.name ?? 'GodHelmet',
    call,
    close: () => device.gatt.connected && device.gatt.disconnect(),
  }
}
