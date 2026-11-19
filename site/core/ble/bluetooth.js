// Web Bluetooth transport (docs/BLE_PROTOCOL.md).
import { split, Reassembler } from './frame.js'
import { linkError, Pending } from './link.js'

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
// connect() can wait a long time for a helmet that is out of range.
const CONNECT_MS = 15000
// Finding the service and subscribing takes a second or two; a call that never returns must not hold the attempt for ever.
const SETUP_MS = 15000
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const LOST = 'The Bluetooth connection to the helmet was lost.'

export const bluetoothAvailable = () => typeof navigator !== 'undefined' && !!navigator.bluetooth
// After a page reload the browser can hand back the helmet without its chooser
// only where it has getDevices() (not everywhere, and not in Bluefy).
export const bluetoothRemembers = (bluetooth = bluetoothAvailable() ? navigator.bluetooth : null) => typeof bluetooth?.getDevices === 'function'

const bytesOf = (dataView) => new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength)

// The helmet of the last connection: reconnecting to it needs no chooser.
let kept = null
// One 'gattserverdisconnected' listener per device, however often it reconnects.
const listeners = new WeakMap()

function onDrop(device, fn) {
  let slot = listeners.get(device)
  if (!slot) {
    slot = { fn: null }
    listeners.set(device, slot)
    // (A late event of an attempt that was given up must not end the next one.)
    device.addEventListener('gattserverdisconnected', () => !device.gatt?.connected && slot.fn?.())
  }
  slot.fn = fn
}

// A helmet this browser was allowed to use before (after a reload), by the
// browser's id for it, else by name.
async function permitted(bluetooth, known) {
  if (!bluetoothRemembers(bluetooth)) return null
  const devices = await bluetooth.getDevices()
  return devices.find((d) => known?.id && d.id === known.id) ?? devices.find((d) => known?.name && d.name === known.name) ?? null
}

// gatt.connect(), given up (and cancelled) after `ms`. A device that came from
// getDevices() may first have to be seen advertising.
async function gattConnect(device, ms) {
  let timer
  const watching = new AbortController()
  const late = new Promise((_, reject) => {
    timer = setTimeout(() => reject(linkError('timeout', 'The helmet did not answer over Bluetooth. Is it switched on and in range?')), ms)
  })
  const direct = async () => {
    try {
      return await device.gatt.connect()
    } catch (e) {
      if (typeof device.watchAdvertisements !== 'function') throw e
      await new Promise((resolve, reject) => {
        device.addEventListener('advertisementreceived', resolve, { once: true })
        device.watchAdvertisements({ signal: watching.signal }).catch(reject)
      })
      return await device.gatt.connect()
    }
  }
  try {
    return await Promise.race([direct(), late])
  } catch (e) {
    try {
      device.gatt.disconnect() // also cancels a connect() that is still waiting
    } catch {
      /* was not connected */
    }
    throw e
  } finally {
    clearTimeout(timer)
    watching.abort()
  }
}

// `promise`, given up after `ms`.
function within(promise, ms, message) {
  let timer
  const late = new Promise((_, reject) => {
    timer = setTimeout(() => reject(linkError('timeout', message)), ms)
  })
  return Promise.race([promise, late]).finally(() => clearTimeout(timer))
}

// Connects and returns { kind, name, id, call, close }.
// options.known: reconnect without the browser's chooser, to the helmet of
//   the last connection, or after a reload to the one the browser remembers
//   ({ id, name } as returned here). Rejects with code 'no-device' when only
//   the chooser can bring it back.
// For tests: options.bluetooth (a stand-in for navigator.bluetooth),
//   options.timeoutMs, options.connectMs, options.setupMs.
export async function openBluetooth({ onStatus, onDisconnect } = {}, options = {}) {
  const bluetooth = options.bluetooth ?? (bluetoothAvailable() ? navigator.bluetooth : null)
  if (!bluetooth) throw new Error('This browser has no Web Bluetooth. Use Chrome or Edge (Android, Mac, Windows), or the Bluefy browser on iPhone.')
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS

  let device
  if (options.known) {
    const same = kept && (!options.known.id || !kept.id || kept.id === options.known.id)
    device = same ? kept : await permitted(bluetooth, options.known)
    if (!device) throw linkError('no-device', 'This browser cannot find the helmet again by itself. Press Reconnect and choose it.')
  } else {
    device = await bluetooth.requestDevice({
      filters: [{ services: [UUIDS.service] }, { namePrefix: 'GodHelmet' }],
      optionalServices: [UUIDS.service],
    })
  }
  kept = device

  // Two apps may share the helmet (receiver + telepathy sender); the tag
  // tells our responses apart from theirs.
  const pending = new Pending()
  const link = { closed: false, byUser: false, handed: false }
  function drop() {
    if (link.closed) return
    link.closed = true
    // Nothing more will come: every waiting request fails now, not after its timeout.
    pending.failAll(linkError('lost', LOST))
    if (link.handed && !link.byUser) onDisconnect?.({ reason: 'drop' })
  }
  onDrop(device, drop)
  // An attempt that was given up may end after a newer one has begun on the
  // same device object: only the newest may disconnect it.
  const hangUp = () => {
    try {
      if (listeners.get(device)?.fn === drop && device.gatt.connected) device.gatt.disconnect()
    } catch {
      /* already gone */
    }
  }
  // A drop while connecting ends the attempt at once, with its real cause.
  const alive = () => {
    if (link.closed) throw linkError('lost', 'The helmet disconnected while connecting. Is it in range?')
  }

  let request
  const setUp = async (server) => {
    const service = await server.getPrimaryService(UUIDS.service)
    const chars = await Promise.all([
      service.getCharacteristic(UUIDS.request),
      service.getCharacteristic(UUIDS.response),
      service.getCharacteristic(UUIDS.status),
    ])
    alive()
    request = chars[0]
    const [, response, status] = chars
    const responseFrames = new Reassembler()
    const statusFrames = new Reassembler()
    response.addEventListener('characteristicvaluechanged', (e) => {
      if (link.closed) return
      const msg = responseFrames.push(bytesOf(e.target.value))
      if (!msg) return
      try {
        pending.reply(JSON.parse(decoder.decode(msg)))
      } catch {
        /* a damaged frame: the request runs into its timeout */
      }
    })
    status.addEventListener('characteristicvaluechanged', (e) => {
      if (link.closed) return
      const msg = statusFrames.push(bytesOf(e.target.value))
      if (!msg) return
      try {
        onStatus?.(JSON.parse(decoder.decode(msg)))
      } catch {
        /* ignore a damaged frame; the next one comes within 2 s */
      }
    })
    await response.startNotifications()
    await status.startNotifications() // the helmet sends status only to apps that subscribed
    alive()
  }
  try {
    const server = await gattConnect(device, options.connectMs ?? CONNECT_MS)
    alive()
    await within(setUp(server), options.setupMs ?? SETUP_MS, 'The helmet connected over Bluetooth but did not answer. Is it in range?')
  } catch (e) {
    link.byUser = true
    drop()
    hangUp()
    throw e
  }

  let seq = 0
  let chain = Promise.resolve() // GATT allows one operation at a time

  async function write(bytes) {
    for (const packet of split(bytes, seq++ & 0xff, PACKET_SIZE)) {
      if (link.closed) throw linkError('lost', LOST)
      if (request.writeValueWithResponse) await request.writeValueWithResponse(packet)
      else await request.writeValue(packet)
    }
  }

  function call(op, params = {}, ms = timeoutMs) {
    if (link.closed) return Promise.reject(linkError('lost', LOST))
    const { json, entry, promise } = pending.request(op, params, ms)
    chain = chain
      .then(() => write(encoder.encode(json)))
      // (The browser's own errors carry a numeric `code`: only ours, with a word, pass as they are.)
      .catch((err) => pending.fail(entry, typeof err.code === 'string' ? err : linkError(link.closed || !device.gatt.connected ? 'lost' : 'send', err.message)))
    return promise
  }

  link.handed = true
  return {
    kind: 'ble',
    name: device.name ?? 'GodHelmet',
    id: device.id ?? '',
    call,
    close: () => {
      link.byUser = true
      drop()
      hangUp()
    },
  }
}
