// USB transport (Web Serial): the Bluetooth protocol as one JSON line per
// message (docs/BLE_PROTOCOL.md, section USB). The board answers with lines
// that start with "@"; every other line it writes is log text. Nothing is
// pushed over USB, so the live status is polled with the "status" op.

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
const encoder = new TextEncoder()

async function quietly(fn) {
  try {
    await fn()
  } catch {
    /* nothing left to clean up */
  }
}

export const serialAvailable = () => typeof navigator !== 'undefined' && !!navigator.serial

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

// Opens a port (the browser shows its chooser) and returns { kind, name, call, close }
// like openBluetooth(). Options are for tests: a fake `serial`, a `port` already
// chosen, shorter handshake and polling times.
export async function openSerial({ onStatus, onDisconnect, onRestart, onLog } = {}, options = {}) {
  const serial = options.serial ?? (serialAvailable() ? navigator.serial : null)
  if (!serial) throw new Error('This browser has no Web Serial (USB). Use Chrome or Edge on a computer.')
  const helloMs = options.helloMs ?? 1500
  const handshakeMs = options.handshakeMs ?? 20000
  const pollIdleMs = options.pollIdleMs ?? 2000
  const pollRunningMs = options.pollRunningMs ?? 500

  const port = options.port ?? (await serial.requestPort({ filters: USB_FILTERS }))
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

  const tag = crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff
  const pending = new Map()
  const lines = new LineSplitter()
  const decoder = new TextDecoder()
  const reader = port.readable.getReader()
  const writer = port.writable.getWriter()
  let nextId = 0
  let chain = Promise.resolve()
  let closed = false
  let pollTimer = null

  function settle(id, fn) {
    const p = pending.get(id)
    if (!p) return
    pending.delete(id)
    clearTimeout(p.timer)
    fn(p)
  }

  function onLine(line) {
    const m = parseLine(line)
    if (m.reply) {
      if (m.reply.c !== tag) return
      settle(m.reply.id, (p) => (m.reply.ok ? p.resolve(m.reply.data) : p.reject(new Error(m.reply.error))))
      return
    }
    onLog?.(m.log)
    if (m.restart) onRestart?.()
  }

  async function shutdown(byUser) {
    if (closed) return
    closed = true
    clearTimeout(pollTimer)
    for (const id of [...pending.keys()]) settle(id, (p) => p.reject(new Error('USB disconnected')))
    // Each step on its own: after an unplug some of them fail.
    await quietly(() => reader.cancel())
    await quietly(() => reader.releaseLock())
    await quietly(() => writer.releaseLock())
    await quietly(() => port.close())
    if (!byUser) onDisconnect?.()
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
    if (closed) return Promise.reject(new Error('USB disconnected'))
    const id = ++nextId
    const body = encoder.encode(JSON.stringify({ c: tag, id, op, ...params }) + '\n')
    const result = new Promise((resolve, reject) => {
      const timer = setTimeout(() => settle(id, (p) => p.reject(new Error(`${op}: no answer from the helmet`))), timeoutMs)
      pending.set(id, { resolve, reject, timer })
    })
    chain = chain.then(() => writer.write(body)).catch((err) => settle(id, (p) => p.reject(err)))
    return result
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
    }
  }

  async function poll() {
    let running = false
    try {
      const s = await call('status', {}, 5000)
      running = s.state !== 'idle'
      onStatus?.(s)
    } catch {
      /* a missed status: the next one follows */
    }
    if (!closed) pollTimer = setTimeout(poll, running ? pollRunningMs : pollIdleMs)
  }
  poll()

  return {
    kind: 'usb',
    name: 'Helmet (USB)',
    call,
    close: async () => {
      await shutdown(true)
      await reading
    },
  }
}
