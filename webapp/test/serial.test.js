// USB transport (Web Serial) against a fake board that speaks the firmware's
// line protocol (firmware/src/usblink.cpp).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LineSplitter, parseLine, openSerial, BOOT_BANNER } from '../src/ble/serial.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const enc = new TextEncoder()
const dec = new TextDecoder()

// A board on a fake port. `deaf` requests are lost (the board is still
// starting); answers arrive split into small chunks with CRLF, like a UART.
function fakeBoard({ deaf = 0, banner = false, answer = true } = {}) {
  let toApp
  const board = { requests: [], signals: [], closed: false }
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
  }
  board.port = port
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
  const board = fakeBoard()
  let disconnected = 0
  const dev = await openSerial({ onDisconnect: () => disconnected++ }, fast(board))
  board.unplug()
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
