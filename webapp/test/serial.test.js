// USB transport (Web Serial) against a fake board that speaks the firmware's
// line protocol (firmware/src/usblink.cpp).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LineSplitter, parseLine, openSerial, onSerialPlugged, BOOT_BANNER, USB_FILTERS } from '../src/ble/serial.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const enc = new TextEncoder()
const dec = new TextDecoder()

// A board on a fake port. `deaf` requests are lost (the board is still
// starting); answers arrive split into small chunks with CRLF, like a UART.
function fakeBoard({ deaf = 0, banner = false, answer = true, usb = { usbVendorId: 0x303a, usbProductId: 0x1001 } } = {}) {
  let toApp
  const board = { requests: [], signals: [], closed: false, hung: false }
  const send = (text) => {
    for (let i = 0; i < text.length; i += 7) toApp.enqueue(enc.encode(text.slice(i, i + 7)))
  }
  let partial = ''
  const port = {
    readable: new ReadableStream({ start: (c) => (toApp = c) }),
    writable: new WritableStream({
      write(chunk) {
        partial += dec.decode(chunk)
        const lines = partial.split('\n')
        partial = lines.pop()
        for (const line of lines) {
          const req = JSON.parse(line)
          board.requests.push(req)
          if (board.hung) continue
          if (board.requests.length <= deaf || !answer) {
            if (banner && board.requests.length === 1) send(`\r\n${BOOT_BANNER} 0.3.0 (ESP32-C3, ESP32-C3)\r\nFree heap 1 bytes\r\n`)
            continue
          }
          const data = req.op === 'status' ? { state: 'idle' } : { op: req.op, board: 'ESP32-C3' }
          send(`@${JSON.stringify({ c: req.c + 1, id: req.id, ok: true, data: 'other app' })}\r\n`) // not ours
          send(req.op === 'fail' ? `@${JSON.stringify({ c: req.c, id: req.id, ok: false, error: 'nope' })}\r\n`
            : `@${JSON.stringify({ c: req.c, id: req.id, ok: true, data })}\r\n`)
        }
      },
    }),
    async open(o) {
      board.opened = o
    },
    async setSignals(s) {
      board.signals.push(s)
    },
    async close() {
      board.closed = true
    },
    getInfo: () => usb,
  }
  board.port = port
  board.send = (text) => send(text)
  board.unplug = () => toApp.error(new Error('The device has been lost.'))
  return board
}

const fast = (board) => ({ port: board.port, serial: {}, helloMs: 50, handshakeMs: 1000, pollIdleMs: 30, pollRunningMs: 30 })

test('lines: split across chunks, CRLF, replies vs log text', () => {
  const s = new LineSplitter()
  assert.deepEqual(s.push('@{"c":1,'), [])
  assert.deepEqual(s.push('"id":2}\r\nlog li'), ['@{"c":1,"id":2}'])
  assert.deepEqual(s.push('ne\n\n'), ['log line', ''])
  assert.deepEqual(parseLine('@{"c":1,"id":2}'), { reply: { c: 1, id: 2 } })
  assert.equal(parseLine('@{broken').log, '@{broken')
  assert.equal(parseLine('[E][vfs_api.cpp:99] open(): no file').restart, false)
  assert.equal(parseLine(`${BOOT_BANNER} 0.3.0 (ESP32)`).restart, true)
})

test('connect: waits for a board that is still starting, then calls and polls', async () => {
  const board = fakeBoard({ deaf: 2, banner: true })
  let restarts = 0
  const logs = []
  const statuses = []
  const dev = await openSerial(
    { onStatus: (s) => statuses.push(s), onRestart: () => restarts++, onLog: (l) => logs.push(l) },
    fast(board),
  )
  try {
    assert.equal(dev.kind, 'usb')
    assert.equal(board.opened.baudRate, 115200)
    // RTS off before DTR: never the reset combination (RTS on, DTR off).
    assert.deepEqual(board.signals, [{ requestToSend: false }, { dataTerminalReady: false }])
    assert.equal(restarts, 1)
    assert.ok(logs.some((l) => l.startsWith('Free heap')))
    assert.deepEqual(await dev.call('session.start', { fieldUT: 1 }), { op: 'session.start', board: 'ESP32-C3' })
    await assert.rejects(dev.call('fail'), /nope/)
    await sleep(120)
    assert.ok(statuses.length >= 2 && statuses.every((s) => s.state === 'idle'))
    const start = board.requests.find((r) => r.op === 'session.start')
    assert.equal(start.fieldUT, 1)
  } finally {
    await dev.close()
  }
  assert.equal(board.closed, true)
})

test('unplugged: the app hears about it, open calls fail', async () => {
  const board = fakeBoard({ answer: false })
  board.requests.length = 0
  let disconnected = 0
  const opening = openSerial({ onDisconnect: () => disconnected++ }, { ...fast(board), pollIdleMs: 60000 })
  await sleep(20)
  board.send(`@${JSON.stringify({ c: board.requests[0].c, id: board.requests[0].id, ok: true, data: {} })}\r\n`)
  const dev = await opening
  // A request that is waiting fails, and by then the link is already reported as gone.
  let heardFirst = null
  const waiting = dev.call('session.start', {}).catch((e) => {
    heardFirst = disconnected === 1
    return e
  })
  board.unplug()
  assert.equal((await waiting).code, 'lost')
  assert.equal(heardFirst, true)
  await sleep(20)
  assert.equal(disconnected, 1)
  await assert.rejects(dev.call('hello'), /disconnected/)
  await dev.close()
  assert.equal(disconnected, 1)
})

test('a port that never answers: clear error, port closed again', async () => {
  const board = fakeBoard({ answer: false })
  await assert.rejects(openSerial({}, { ...fast(board), handshakeMs: 200 }), /No answer over USB/)
  assert.equal(board.closed, true)
})

test('an op with an id of its own (a log entry, a trial) still gets its answer', async () => {
  const board = fakeBoard()
  const dev = await openSerial({}, fast(board))
  try {
    // The protocol has one "id" member: here it is the trial's, and the board answers with it.
    assert.deepEqual(await dev.call('trial.get', { id: 3 }), { op: 'trial.get', board: 'ESP32-C3' })
    const sent = board.requests.find((r) => r.op === 'trial.get')
    assert.equal(sent.id, 3)
    assert.deepEqual(Object.keys(sent).slice(0, 3), ['c', 'id', 'op'])
    assert.deepEqual(await Promise.all([dev.call('log.rate', { id: 3, rating: 4 }), dev.call('trial.lock', { id: 3 })]), [{ op: 'log.rate', board: 'ESP32-C3' }, { op: 'trial.lock', board: 'ESP32-C3' }])
  } finally {
    await dev.close()
  }
})

test('a board that stops answering counts as lost after three missed polls', async () => {
  const board = fakeBoard()
  const lost = []
  const statuses = []
  const dev = await openSerial({ onDisconnect: (info) => lost.push(info), onStatus: (s) => statuses.push(s) }, { ...fast(board), pollTimeoutMs: 40, missedPolls: 3 })
  await sleep(100)
  assert.ok(statuses.length >= 1)
  // One missed poll is nothing.
  board.hung = true
  await sleep(60)
  board.hung = false
  await sleep(150)
  assert.deepEqual(lost, [])
  board.hung = true
  const seen = board.requests.length
  await sleep(400)
  assert.deepEqual(lost, [{ reason: 'silent' }])
  assert.equal(board.closed, true)
  await assert.rejects(dev.call('hello'), (e) => e.code === 'lost')
  const polls = board.requests.length - seen
  assert.ok(polls >= 3 && polls <= 4, `stopped asking after the third poll (${polls})`)
})

test('a request the board could not read is told at once: the oldest waiting one fails', async () => {
  const board = fakeBoard()
  const dev = await openSerial({}, { ...fast(board), pollIdleMs: 60000 })
  try {
    await sleep(30) // the first status poll is answered; the next is a minute away
    board.hung = true
    const started = Date.now()
    const waiting = assert.rejects(dev.call('session.start', { session: {} }), (e) => e.code === 'helmet' && /request damaged/.test(e.message))
    await sleep(20)
    board.send('@{"c":0,"id":0,"ok":false,"error":"request damaged: start missing"}\r\n')
    await waiting
    assert.ok(Date.now() - started < 1000)
  } finally {
    await dev.close()
  }
})

test('reopening without the chooser: the remembered port, and the plug-in event', async () => {
  const board = fakeBoard()
  const other = fakeBoard({ usb: { usbVendorId: 0x1234, usbProductId: 1 } }) // not an ESP32 board
  const serial = new EventTarget()
  Object.assign(serial, { choosers: 0, ports: [other.port, board.port] })
  serial.requestPort = async ({ filters }) => {
    serial.choosers++
    assert.deepEqual(filters, USB_FILTERS)
    return board.port
  }
  serial.getPorts = async () => serial.ports
  const options = { serial, helloMs: 50, handshakeMs: 1000, pollIdleMs: 30, pollRunningMs: 30 }

  let lost = 0
  const first = await openSerial({ onDisconnect: () => lost++ }, options)
  assert.equal(serial.choosers, 1)
  assert.deepEqual(first.id, { usbVendorId: 0x303a, usbProductId: 0x1001 })
  board.unplug()
  await sleep(20)
  assert.equal(lost, 1)

  // Plugged in again: the same USB ids, a new port object, no chooser.
  const back = fakeBoard()
  serial.ports = [other.port, back.port]
  const again = await openSerial({}, { ...options, known: first.id })
  assert.equal(serial.choosers, 1)
  assert.deepEqual(await again.call('hello'), { op: 'hello', board: 'ESP32-C3' })
  assert.ok(back.requests.length > 0 && other.requests.length === 0)
  await again.close()

  // Not plugged in: nothing to open, and no chooser either.
  serial.ports = [other.port]
  await assert.rejects(openSerial({}, { ...options, known: first.id }), (e) => e.code === 'no-device')
  assert.equal(serial.choosers, 1)

  // The browser says when a board is plugged in (only boards, with the same vendor filters).
  let plugged = 0
  const stop = onSerialPlugged(() => plugged++, serial)
  const event = (port) => {
    const e = new Event('connect')
    Object.defineProperty(e, 'target', { value: port })
    serial.dispatchEvent(e)
  }
  event(other.port)
  assert.equal(plugged, 0)
  event(back.port)
  assert.equal(plugged, 1)
  stop()
  event(back.port)
  assert.equal(plugged, 1)
})

test('the start-up line while the port is being opened is reported with the transport', async () => {
  const board = fakeBoard({ deaf: 2, banner: true })
  const dev = await openSerial({}, fast(board))
  assert.equal(dev.restarted, true)
  await dev.close()
  const calm = fakeBoard()
  const dev2 = await openSerial({}, fast(calm))
  assert.equal(dev2.restarted, false)
  await dev2.close()
})

test('a port that takes no writes: the handshake asks again with a pause, not in a tight loop', async () => {
  const board = fakeBoard()
  let writes = 0
  const port = {
    ...board.port,
    writable: new WritableStream({
      write() {
        writes++
        throw new Error('write failed')
      },
    }),
  }
  // (A writer whose stream has failed rejects every write at once.)
  let ticks = 0
  const beat = setInterval(() => ticks++, 10)
  await assert.rejects(openSerial({}, { port, serial: {}, helloMs: 50, handshakeMs: 600 }), /No answer over USB/)
  clearInterval(beat)
  assert.ok(ticks > 20, `the page stayed alive meanwhile (${ticks})`)
  assert.ok(writes <= 1)
})
