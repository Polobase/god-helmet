// Bluetooth transport against stand-in navigator.bluetooth objects and a fake
// helmet behind them that speaks the framed protocol (docs/BLE_PROTOCOL.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openBluetooth } from '../src/ble/bluetooth.js'
import { fakeHelmet, fakeBluetooth } from './fake-bluetooth.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

test('requests, status pushes, and an op that has an id of its own', async () => {
  const helmet = fakeHelmet()
  const statuses = []
  const dev = await openBluetooth({ onStatus: (s) => statuses.push(s) }, { bluetooth: fakeBluetooth(helmet) })
  try {
    assert.equal(dev.kind, 'ble')
    assert.equal(dev.name, 'GodHelmet-B084')
    assert.deepEqual(await dev.call('hello'), { op: 'hello' })
    // "c" and "id" are the first two members of every request.
    const big = await dev.call('session.start', { session: { name: 'x'.repeat(600) }, fieldUT: 1 })
    assert.deepEqual(big, { op: 'session.start' })
    assert.deepEqual(Object.keys(helmet.requests.at(-1)).slice(0, 3), ['c', 'id', 'op'])
    // The protocol has one "id": for trial.get it is the trial's, and the helmet answers with it.
    assert.deepEqual(await dev.call('trial.get', { id: 3 }), { op: 'trial.get' })
    assert.equal(helmet.requests.at(-1).id, 3)
    // Two of them at once are answered in the order sent.
    helmet.answer = (req) => ({ ok: true, data: { op: req.op } })
    assert.deepEqual(await Promise.all([dev.call('trial.get', { id: 3 }), dev.call('log.rate', { id: 3, rating: 5 })]), [{ op: 'trial.get' }, { op: 'log.rate' }])
    helmet.answer = () => ({ ok: false, error: 'nope' })
    await assert.rejects(dev.call('fail'), (e) => e.code === 'helmet' && /nope/.test(e.message))
    helmet.pushStatus({ state: 'idle' })
    assert.deepEqual(statuses, [{ state: 'idle' }])
  } finally {
    dev.close()
  }
})

test('a dropped link rejects every waiting request at once', async () => {
  const helmet = fakeHelmet({ answer: () => null }) // never answers
  let disconnects = 0
  const dev = await openBluetooth({ onDisconnect: () => disconnects++ }, { bluetooth: fakeBluetooth(helmet), timeoutMs: 20000 })
  const started = Date.now()
  const waiting = [dev.call('session.stop'), dev.call('log.list', { offset: 0 }), dev.call('hello')]
  const results = Promise.allSettled(waiting)
  await sleep(20)
  helmet.drop()
  const settled = await results
  assert.ok(Date.now() - started < 1000, 'not after the 20 s timeout')
  assert.ok(settled.every((r) => r.status === 'rejected' && r.reason.code === 'lost' && /lost/.test(r.reason.message)))
  assert.equal(disconnects, 1)
  await assert.rejects(dev.call('hello'), (e) => e.code === 'lost')
  dev.close()
  assert.equal(disconnects, 1)
  // Their timers are gone too: nothing keeps the process waiting for 20 s (the test would not end).
})

test('reconnecting to the same helmet needs no chooser, and listens for the drop once', async () => {
  const helmet = fakeHelmet({ id: 'dev-2' })
  const bluetooth = fakeBluetooth(helmet)
  let disconnects = 0
  const handlers = { onDisconnect: () => disconnects++ }
  const first = await openBluetooth(handlers, { bluetooth })
  helmet.drop()
  assert.equal(disconnects, 1)
  const again = await openBluetooth(handlers, { bluetooth, known: { id: first.id, name: first.name } })
  assert.equal(bluetooth.choosers, 1)
  assert.equal(helmet.connects, 2)
  assert.deepEqual(await again.call('hello'), { op: 'hello' })
  helmet.drop()
  assert.equal(disconnects, 2)
  const third = await openBluetooth(handlers, { bluetooth, known: true })
  assert.equal(helmet.dropListeners, 1)
  third.close() // the user's own Disconnect is not reported as a drop
  assert.equal(disconnects, 2)
})

test('after a reload the browser hands the helmet back where it has getDevices()', async () => {
  const helmet = fakeHelmet({ id: 'dev-3', name: 'GodHelmet-C0DE' })
  const remembers = fakeBluetooth(helmet, { remembers: true })
  const dev = await openBluetooth({}, { bluetooth: remembers, known: { id: 'dev-3', name: 'GodHelmet-C0DE' } })
  assert.equal(remembers.choosers, 0)
  assert.equal(remembers.asked, 1)
  assert.deepEqual(await dev.call('hello'), { op: 'hello' })
  dev.close()

  // Another helmet than the one remembered, in a browser without getDevices(): only the chooser helps.
  const other = fakeHelmet({ id: 'dev-4' })
  const plain = fakeBluetooth(other)
  await assert.rejects(openBluetooth({}, { bluetooth: plain, known: { id: 'dev-4', name: 'GodHelmet-0004' } }), (e) => e.code === 'no-device')
  assert.equal(plain.choosers, 0)
  // And one the browser does not know (permission gone).
  await assert.rejects(openBluetooth({}, { bluetooth: remembers, known: { id: 'dev-9', name: 'GodHelmet-0009' } }), (e) => e.code === 'no-device')
})

test('a request the helmet dropped without reading whose it was fails the oldest one', async () => {
  const helmet = fakeHelmet({ answer: () => null })
  const dev = await openBluetooth({}, { bluetooth: fakeBluetooth(helmet) })
  try {
    const first = dev.call('session.start', { session: {} })
    const second = dev.call('hello')
    const firstDone = assert.rejects(first, (e) => e.code === 'helmet' && /request damaged/.test(e.message))
    await sleep(20)
    helmet.reply({ c: 0, id: 0, ok: false, error: 'request damaged: start missing' })
    await firstDone
    // A reply for another app (older firmware tells everyone) changes nothing.
    helmet.reply({ c: 1, id: helmet.requests.at(-1).id, ok: true, data: 'other app' })
    helmet.reply({ c: helmet.requests.at(-1).c, id: helmet.requests.at(-1).id, ok: true, data: 'ours' })
    assert.equal(await second, 'ours')
    // With its tag and id, the error goes to the request it names.
    const third = dev.call('log.list')
    const fourth = dev.call('hello')
    await sleep(20)
    const [a, b] = helmet.requests.slice(-2)
    helmet.reply({ c: b.c, id: b.id, ok: false, error: 'busy: request dropped' })
    await assert.rejects(fourth, /busy: request dropped/)
    helmet.reply({ c: a.c, id: a.id, ok: true, data: 'list' })
    assert.equal(await third, 'list')
  } finally {
    dev.close()
  }
})

test('a drop while connecting ends the attempt at once', async () => {
  const helmet = fakeHelmet({ id: 'dev-5' })
  helmet.dropWhileConnecting = true
  let disconnects = 0
  const started = Date.now()
  await assert.rejects(openBluetooth({ onDisconnect: () => disconnects++ }, { bluetooth: fakeBluetooth(helmet) }))
  assert.ok(Date.now() - started < 1000)
  assert.equal(disconnects, 0, 'the failed open says it; no separate "disconnected"')
})

test('a helmet out of range: the attempt is given up, not left hanging', async () => {
  const helmet = fakeHelmet({ id: 'dev-6' })
  helmet.device.gatt.connect = () => new Promise(() => {}) // waits for ever, as on Android
  await assert.rejects(openBluetooth({}, { bluetooth: fakeBluetooth(helmet), connectMs: 40 }), (e) => e.code === 'timeout')
})

test('the browser\'s own errors (a DOMException has a numeric code) count as "no answer", not as the helmet\'s words', async () => {
  const helmet = fakeHelmet({ id: 'dev-7' })
  const dev = await openBluetooth({}, { bluetooth: fakeBluetooth(helmet) })
  try {
    helmet.chars[Object.keys(helmet.chars)[0]].writeValueWithResponse = async () => {
      throw Object.assign(new Error('GATT operation failed for unknown reason.'), { name: 'NetworkError', code: 19 })
    }
    await assert.rejects(dev.call('session.start', {}), (e) => e.code === 'send' && /GATT operation failed/.test(e.message))
    helmet.device.gatt.connected = false // gone, though the browser has not said so yet
    await assert.rejects(dev.call('session.start', {}), (e) => e.code === 'lost')
  } finally {
    dev.close()
  }
})

test('an attempt that was given up does not hang up the one that followed it', async () => {
  const helmet = fakeHelmet({ id: 'dev-8' })
  const bluetooth = fakeBluetooth(helmet)
  const first = await openBluetooth({}, { bluetooth })
  let lost = 0
  const second = await openBluetooth({ onDisconnect: () => lost++ }, { bluetooth, known: true }) // the same device object
  first.close() // the older one is closed late
  assert.equal(helmet.device.gatt.connected, true)
  assert.equal(lost, 0)
  assert.deepEqual(await second.call('hello'), { op: 'hello' })
  second.close()
  assert.equal(helmet.device.gatt.connected, false)
})

test('a helmet that connects but never answers the set-up: given up, and hung up', async () => {
  const helmet = fakeHelmet({ id: 'dev-9' })
  const connect = helmet.device.gatt.connect.bind(helmet.device.gatt)
  helmet.device.gatt.connect = async () => {
    await connect()
    return { getPrimaryService: () => new Promise(() => {}) }
  }
  await assert.rejects(openBluetooth({}, { bluetooth: fakeBluetooth(helmet), setupMs: 40 }), (e) => e.code === 'timeout' && /did not answer/.test(e.message))
  assert.equal(helmet.device.gatt.connected, false)
})
