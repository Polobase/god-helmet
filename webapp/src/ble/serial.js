// USB transport (Web Serial): the Bluetooth protocol as one JSON line per
// message (docs/BLE_PROTOCOL.md, section USB). The board answers with lines
// that start with "@"; every other line it writes is log text. Nothing is
// pushed over USB, so the live status is polled with the "status" op.
import { linkError, Pending } from './link.js'

export const BAUD = 115200
export const BOOT_BANNER = 'God helmet controller'

// USB vendor IDs of the chips on ESP32 boards; the port chooser lists only those.
export const USB_FILTERS = [
  { usbVendorId: 0x303a }, // Espressif: the chip's own USB (S3, C3, C6)
  { usbVendorId: 0x1a86 }, // WCH CH340 / CH343 (e.g. the 2.8" display board)
  { usbVendorId: 0x10c4 }, // Silicon Labs CP210x
  { usbVendorId: 0x0403 }, // FTDI
]

const TIMEOUT_MS = 20000
// This many status polls in a row without an answer: the board has stopped
// answering (it hangs, or the cable carries power only), and counts as lost.
const MISSED_POLLS = 3
const encoder = new TextEncoder()
const LOST = 'USB disconnected'

async function quietly(fn) {
  try {
    await fn()
  } catch {
    /* nothing left to clean up */
  }
}

export const serialAvailable = () => typeof navigator !== 'undefined' && !!navigator.serial

// The port of the last connection: opening it again needs no chooser.
let kept = null
const infoOf = (port) => {
  try {
    return port.getInfo?.() ?? {}
  } catch {
    return {}
  }
}
const isBoard = (port) => {
  const vendor = infoOf(port).usbVendorId
  return vendor === undefined || USB_FILTERS.some((f) => f.usbVendorId === vendor)
}

// A port this browser was allowed to use before: the one of the last
// connection if it is still there, else one with the same USB ids, else any
// ESP32 board's port.
async function permittedPort(serial, known) {
  if (typeof serial.getPorts !== 'function') return null
  const ports = (await serial.getPorts()).filter(isBoard)
  if (kept && ports.includes(kept)) return kept
  const same = (p) => infoOf(p).usbVendorId === known?.usbVendorId && infoOf(p).usbProductId === known?.usbProductId
  return (known?.usbVendorId !== undefined && ports.find(same)) || ports[0] || null
}

// Calls `fn` when a board this browser may use is plugged in. Returns the way to stop listening.
export function onSerialPlugged(fn, serial = serialAvailable() ? navigator.serial : null) {
  if (typeof serial?.addEventListener !== 'function') return () => {}
  const listener = (e) => isBoard(e.target ?? e.port ?? {}) && fn()
  serial.addEventListener('connect', listener)
  return () => serial.removeEventListener('connect', listener)
}

// Splits text arriving in arbitrary chunks into lines.
export class LineSplitter {
  constructor(maxLine = 1024 * 1024) {
    this.buf = ''
    this.max = maxLine
  }
  push(text) {
    this.buf += text
    const lines = this.buf.split('\n')
    this.buf = lines.pop()
    if (this.buf.length > this.max) this.buf = ''  // not a line from the helmet: drop it
    return lines.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l))
  }
}

// One line from the board: { reply } for "@{...}", otherwise { log }, with
// restart: true for the banner the firmware prints when it boots.
export function parseLine(line) {
  if (line.startsWith('@{')) {
    try {
      return { reply: JSON.parse(line.slice(1)) }
    } catch {
      /* damaged: treat as log text */
    }
  }
  return { log: line, restart: line.includes(BOOT_BANNER) }
}

// Opens a port (the browser shows its chooser) and returns { kind, name, id, call, close }
// like openBluetooth(). options.known: no chooser, the port of the last
// connection or one the browser was allowed before ({ usbVendorId, usbProductId }
// as returned in `id`); rejects with code 'no-device' when there is none.
// The other options are for tests: a fake `serial`, a `port` already chosen,
// shorter handshake and polling times.
export async function openSerial({ onStatus, onDisconnect, onRestart, onLog } = {}, options = {}) {
  const serial = options.serial ?? (serialAvailable() ? navigator.serial : null)
  if (!serial) throw new Error('This browser has no Web Serial (USB). Use Chrome or Edge on a computer.')
  const helloMs = options.helloMs ?? 1500
  const handshakeMs = options.handshakeMs ?? 20000
  const pollIdleMs = options.pollIdleMs ?? 2000
  const pollRunningMs = options.pollRunningMs ?? 500
  const pollTimeoutMs = options.pollTimeoutMs ?? 5000
  const missedPolls = options.missedPolls ?? MISSED_POLLS

  let port = options.port
  if (!port && options.known) {
    port = await permittedPort(serial, options.known)
    if (!port) throw linkError('no-device', 'The helmet is not plugged in. Plug the USB cable in again; the app reconnects by itself.')
  }
  port ??= await serial.requestPort({ filters: USB_FILTERS })
  kept = port
  await port.open({ baudRate: BAUD, bufferSize: 64 * 1024 })
  // Boards with an auto-reset circuit (and the chips' own USB) restart while
  // RTS is on and DTR off. Both go off, RTS first, so that never happens; the
  // close later starts from both off and cannot reset the board either.
  try {
    await port.setSignals({ requestToSend: false })
    await port.setSignals({ dataTerminalReady: false })
  } catch {
    /* some ports take no signals */
  }

  const pending = new Pending()
  const lines = new LineSplitter()
  const decoder = new TextDecoder()
  const reader = port.readable.getReader()
  const writer = port.writable.getWriter()
  let chain = Promise.resolve()
  let closed = false
  let pollTimer = null
  let handed = false // the handshake is over: the caller has the transport
  let restarted = false // the start-up line arrived during the handshake
  let missed = 0

  function onLine(line) {
    const m = parseLine(line)
    if (m.reply) {
      if (pending.reply(m.reply)) missed = 0
      return
    }
    onLog?.(m.log)
    if (!m.restart) return
    if (!handed) restarted = true
    onRestart?.()
  }

  async function shutdown(byUser, reason = 'drop') {
    if (closed) return
    closed = true
    clearTimeout(pollTimer)
    pending.failAll(linkError('lost', LOST))
    // Said at once, before the port is tidied up: whoever hears a request fail
    // must find the link reported as gone. (During the handshake the caller
    // hears of it through the rejected open.)
    if (!byUser && handed) onDisconnect?.({ reason })
    // Each step on its own: after an unplug some of them fail.
    await quietly(() => reader.cancel())
    await quietly(() => reader.releaseLock())
    await quietly(() => writer.releaseLock())
    await quietly(() => port.close())
  }

  const reading = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        for (const line of lines.push(decoder.decode(value, { stream: true }))) onLine(line)
      }
    } catch {
      /* unplugged */
    }
    shutdown(false)
  })()

  function call(op, params = {}, timeoutMs = TIMEOUT_MS) {
    if (closed) return Promise.reject(linkError('lost', LOST))
    const { json, entry, promise } = pending.request(op, params, timeoutMs)
    chain = chain
      .then(() => writer.write(encoder.encode(json + '\n')))
      .catch((err) => pending.fail(entry, linkError(closed ? 'lost' : 'send', err.message)))
    return promise
  }

  // The board may still be starting (opening a port can restart some boards,
  // and the display board reads its SD card and WiFi first): ask until it answers.
  const until = Date.now() + handshakeMs
  for (;;) {
    try {
      await call('hello', {}, helloMs)
      break
    } catch (err) {
      const unplugged = closed
      if (unplugged || Date.now() >= until) {
        await shutdown(true)
        throw new Error(unplugged ? err.message : 'No answer over USB. Is this the helmet, with firmware 0.3.0 or newer?')
      }
      // A request that fails at once (the port takes no writes) must not be repeated without a pause.
      if (err.code !== 'timeout') await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  let running = false
  async function poll() {
    try {
      const s = await call('status', {}, pollTimeoutMs)
      running = s.state !== 'idle'
      onStatus?.(s)
    } catch (e) {
      // One missed status is nothing (the next one follows); several in a row,
      // with no other answer in between, and the board has stopped answering.
      if (e.code === 'timeout' && ++missed >= missedPolls) return shutdown(false, 'silent')
    }
    if (!closed) pollTimer = setTimeout(poll, running ? pollRunningMs : pollIdleMs)
  }
  handed = true
  poll()

  const { usbVendorId, usbProductId } = infoOf(port)
  return {
    kind: 'usb',
    name: 'Helmet (USB)',
    id: { usbVendorId, usbProductId },
    /** The board printed its start-up line while the port was being opened: it had restarted. */
    restarted,
    call,
    close: async () => {
      await shutdown(true)
      await reading
    },
  }
}
