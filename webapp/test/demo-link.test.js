// The demo helmet when the connection fails: who it is, tokens, a page reload
// in mid-session, a dropped link, a restart (mirrors what the firmware does).
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The demo keeps its state in localStorage: a stand-in, so that a "reload" finds it.
const store = new Map()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
})
const { openDemo, unloadDemo, DEMO_HELMET_ID } = await import('../src/ble/demo.js')
const { sha256Hex } = await import('../src/lib/crypto.js')

const presetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'presets')
const preset = (id) => JSON.parse(readFileSync(join(presetsDir, `${id}.json`), 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STORE = 'godhelmet-demo-v1'
const stored = () => JSON.parse(store.get(STORE))
const patch = (fn) => {
  const s = stored()
  fn(s)
  store.set(STORE, JSON.stringify(s))
}

// A new page, a new helmet: nothing stored.
beforeEach(() => {
  unloadDemo()
  store.clear()
})

async function ready(handlers = {}, options = {}) {
  const dev = openDemo(handlers, options)
  await dev.call('settings.set', { safetyAccepted: true })
  return dev
}

test('who the helmet is, and which session it runs', async () => {
  const statuses = []
  const dev = await ready({ onStatus: (s) => statuses.push(s) })
  const hello = await dev.call('hello')
  assert.equal(hello.helmetId, DEMO_HELMET_ID)
  assert.match(hello.helmetId, /^[0-9A-F]{12}$/)
  assert.ok(Number.isInteger(hello.bootId) && hello.bootId > 0)
  assert.ok(hello.uptimeS >= 0)
  assert.equal(hello.resetReason, 'power-on')
  assert.equal(hello.recoveredLogId, 0)
  assert.equal(hello.protocol, 1)

  const idle = await dev.call('status')
  assert.deepEqual([idle.state, idle.bootId, idle.token, idle.presetId, idle.startEpoch, idle.trialId], ['idle', hello.bootId, '', '', 0, 0])

  const { logId } = await dev.call('session.start', { session: preset('god-helmet-classic'), presetId: 'god-helmet-classic', fieldUT: 2, token: 'tok_A-1' })
  await sleep(600)
  const live = statuses.at(-1) // pushed, not asked for
  assert.deepEqual([live.state, live.token, live.presetId, live.logId, live.trialId], ['running', 'tok_A-1', 'god-helmet-classic', logId, 0])
  assert.ok(Math.abs(live.startEpoch - Date.now() / 1000) < 5)
  await dev.call('session.field', { fieldUT: 3 })
  await dev.call('session.field', { fieldUT: 1.5 })
  await dev.call('session.skip')
  await dev.call('session.stop')
  await sleep(2300)
  // Which session it was stays in the status after it ends, until the next start.
  const after = await dev.call('status')
  assert.deepEqual([after.state, after.token, after.logId, after.lastStopReason], ['idle', 'tok_A-1', logId, 'stopped from app'])
  const entry = (await dev.call('log.list', {})).items[0]
  assert.deepEqual([entry.id, entry.token, entry.finalFieldUT, entry.fieldChanges, entry.skips, entry.reason], [logId, 'tok_A-1', 1.5, 2, 1, 'stopped from app'])
  assert.equal(entry.fieldUT, 2)
  dev.close()
})

test('a start sent again with the same token starts nothing twice', async () => {
  const dev = await ready()
  const first = await dev.call('session.start', { session: preset('obe'), token: 'same-token' })
  assert.equal(first.already, undefined)
  assert.deepEqual(await dev.call('session.start', { session: preset('obe'), token: 'same-token' }), { logId: first.logId, already: true })
  await assert.rejects(dev.call('session.start', { session: preset('obe'), token: 'other' }), /already running/)
  await assert.rejects(dev.call('session.start', { session: preset('obe') }), /already running/)
  await assert.rejects(dev.call('session.start', { session: preset('obe'), token: 'no spaces!' }), /token must be/)
  await assert.rejects(dev.call('session.start', { session: preset('obe'), token: 'x'.repeat(25) }), /token must be/)
  dev.hooks.pressStop()
  // The last one started since the helmet booted: still "already", although it has ended.
  assert.deepEqual(await dev.call('session.start', { session: preset('obe'), token: 'same-token' }), { logId: first.logId, already: true })
  assert.equal((await dev.call('status')).state, 'idle')
  assert.equal((await dev.call('log.list', {})).total, 1)

  // Tests carry tokens too (they have no log entry).
  assert.deepEqual(await dev.call('test', { mode: 'dc', channel: 1, mA: 2, seconds: 5, token: 'test-1' }), { logId: 0 })
  assert.deepEqual(await dev.call('test', { mode: 'dc', channel: 1, mA: 2, seconds: 5, token: 'test-1' }), { logId: 0, already: true })
  assert.equal((await dev.call('status')).token, 'test-1')
  dev.hooks.pressStop()

  // And trials, with a session or without.
  const manifestHash = await sha256Hex('pool')
  const sets = [{ id: 'set-a', size: 4 }]
  const t = await dev.call('trial.new', { manifestHash, sets, session: preset('remote-viewing'), token: 'trial-1' })
  const again = await dev.call('trial.new', { manifestHash, sets, session: preset('remote-viewing'), token: 'trial-1' })
  assert.deepEqual([again.id, again.commitment, again.already], [t.id, t.commitment, true])
  const st = await dev.call('status')
  assert.deepEqual([st.token, st.trialId, st.logId], ['trial-1', t.id, t.logId])
  dev.hooks.pressStop()
  const plain = await dev.call('trial.new', { manifestHash, sets, token: 'trial-2' })
  assert.equal((await dev.call('trial.new', { manifestHash, sets, token: 'trial-2' })).id, plain.id)
  assert.equal((await dev.call('trial.list', {})).total, 2)
  dev.close()
})

test('the keepalive setting is 0 (off) or 5 to 3600 s', async () => {
  const dev = await ready()
  const set = async (v) => (await dev.call('settings.set', { keepaliveS: v })).keepaliveS
  assert.equal(await set(3), 5)
  assert.equal(await set(99999), 3600)
  assert.equal(await set(0.5), 0)
  assert.equal(await set(-1), 0)
  assert.equal(await set(30), 30)
  assert.equal(await set(0), 0)
  dev.close()
})

test('older firmware: none of the new fields, and no tokens', async () => {
  const dev = await ready({}, { legacy: true })
  const hello = await dev.call('hello')
  for (const k of ['helmetId', 'bootId', 'uptimeS', 'resetReason', 'recoveredLogId']) assert.equal(hello[k], undefined, k)
  assert.equal((await dev.call('settings.set', { keepaliveS: 3 })).keepaliveS, 3) // not clamped then
  const { logId } = await dev.call('session.start', { session: preset('obe'), token: 'ignored' })
  const st = await dev.call('status')
  for (const k of ['bootId', 'token', 'presetId', 'startEpoch', 'trialId']) assert.equal(st[k], undefined, k)
  assert.equal(st.logId, logId)
  await assert.rejects(dev.call('session.start', { session: preset('obe'), token: 'ignored' }), /already running/)
  // A restart leaves the entry as it was: unfinished, without a reason.
  dev.hooks.restart()
  const again = openDemo({}, { legacy: true })
  const entry = (await again.call('log.list', {})).items[0]
  assert.deepEqual([entry.finished, entry.reason, entry.token], [false, '', undefined])
  again.close()
  openDemo({}, { legacy: false }).close()
})

test('a page reload in mid-session: the helmet goes on from the clock', async () => {
  const dev = await ready()
  const before = await dev.call('hello')
  const { logId } = await dev.call('session.start', { session: preset('god-helmet-classic'), presetId: 'god-helmet-classic', fieldUT: 1, token: 'reload-me' })
  await dev.call('session.field', { fieldUT: 2 })
  await sleep(300)
  const s1 = await dev.call('status')
  unloadDemo() // the page is gone; a real helmet would run on
  await sleep(700)

  const statuses = []
  const back = openDemo({ onStatus: (s) => statuses.push(s) })
  const hello = await back.call('hello')
  assert.equal(hello.bootId, before.bootId, 'the helmet did not restart')
  assert.equal(hello.recoveredLogId, 0)
  const s2 = await back.call('status')
  assert.deepEqual([s2.state, s2.token, s2.logId, s2.fieldUT, s2.sessionName], ['running', 'reload-me', logId, 2, s1.sessionName])
  assert.ok(s2.programMs >= s1.programMs + 600 && s2.programMs < s1.programMs + 3000, `${s1.programMs} -> ${s2.programMs}`)
  // The same token again: still the same session.
  assert.deepEqual(await back.call('session.start', { session: preset('god-helmet-classic'), token: 'reload-me' }), { logId, already: true })
  await sleep(100)
  assert.equal(statuses.at(-1)?.state, 'running') // and the first status comes at once

  // A skip moves the program on; a reload keeps that too.
  const phases = s2.phaseCount
  if (phases > 1) {
    await back.call('session.skip')
    const skipped = await back.call('status')
    unloadDemo()
    const third = openDemo({})
    const s3 = await third.call('status')
    assert.equal(s3.phase, skipped.phase)
    assert.ok(s3.programMs >= skipped.programMs && s3.programMs < skipped.programMs + 2000)
  }

  // Its planned end passed while the page was closed: closed as completed.
  unloadDemo()
  patch((s) => (s.active.startMs -= 3600_000))
  const later = openDemo({})
  const s4 = await later.call('status')
  assert.deepEqual([s4.state, s4.lastStopReason, s4.token, s4.logId], ['idle', 'completed', 'reload-me', logId])
  const entry = (await later.call('log.list', {})).items[0]
  assert.deepEqual([entry.finished, entry.completed, entry.reason], [true, true, 'completed'])
  assert.ok(entry.elapsedMs > 0 && entry.elapsedMs <= entry.plannedMs)
  assert.equal(stored().active, null)
  later.close()
})

test('a reload while the session was being stopped, or with the keepalive on', async () => {
  let dev = await ready()
  await dev.call('session.start', { session: preset('obe'), token: 'stopping' })
  await sleep(100)
  await dev.call('session.stop')
  unloadDemo()
  await sleep(50)
  patch((s) => (s.active.startMs -= 10_000))
  dev = openDemo({})
  let entry = (await dev.call('log.list', {})).items[0]
  assert.deepEqual([entry.finished, entry.completed, entry.reason], [true, false, 'stopped from app'])
  assert.ok(entry.elapsedMs < 3000, 'it ended two seconds after Stop, not when the page came back')

  // Keepalive 30 s, and the page was away for a minute: the helmet stopped by itself after 30 s.
  await dev.call('settings.set', { keepaliveS: 30 })
  await dev.call('session.start', { session: preset('obe'), token: 'kept-alive' })
  await sleep(50)
  unloadDemo()
  patch((s) => {
    s.active.startMs -= 60_000
    s.appSeenMs -= 60_000
  })
  dev = openDemo({})
  entry = (await dev.call('log.list', {})).items[0]
  assert.deepEqual([entry.finished, entry.completed, entry.reason], [true, false, 'UI keepalive lost'])
  assert.ok(entry.elapsedMs > 29_000 && entry.elapsedMs < 34_000, String(entry.elapsedMs))
  dev.close()
})

test('hook: the link drops, the helmet runs on, and a reconnect finds the session', async () => {
  const lost = []
  const dev = await ready({ onDisconnect: (info) => lost.push(info) })
  const { logId } = await dev.call('session.start', { session: preset('obe'), token: 'drop-me' })
  await sleep(200)
  const s1 = await dev.call('status')
  dev.hooks.drop(300)
  assert.deepEqual(lost, [{ reason: 'drop' }])
  await assert.rejects(dev.call('session.stop'), (e) => e.code === 'lost')
  assert.throws(() => openDemo({}), /out of range/)
  await sleep(400)
  const back = openDemo({ onDisconnect: (info) => lost.push(info) })
  const s2 = await back.call('status')
  assert.deepEqual([s2.state, s2.token, s2.logId, s2.bootId], ['running', 'drop-me', logId, s1.bootId])
  assert.ok(s2.programMs > s1.programMs + 300, 'it ran on meanwhile')
  // Stop works again.
  await back.call('session.stop')
  await sleep(2300)
  assert.equal((await back.call('status')).state, 'idle')
  // Until comeBack(): out of range for as long as the test wants.
  back.hooks.drop(Infinity)
  assert.throws(() => openDemo({}), /out of range/)
  back.hooks.comeBack()
  const third = openDemo({})
  third.close() // the user's Disconnect is no drop
  assert.equal(lost.length, 2)
})

test('hook: the reply to a start is lost; the same token finds the session', async () => {
  const dev = await ready()
  dev.hooks.dropAfter('session.start')
  await assert.rejects(dev.call('session.start', { session: preset('obe'), token: 'lost-reply' }), (e) => e.code === 'lost')
  const back = openDemo({})
  const st = await back.call('status')
  assert.deepEqual([st.state, st.token], ['running', 'lost-reply'])
  const again = await back.call('session.start', { session: preset('obe'), token: 'lost-reply' })
  assert.deepEqual(again, { logId: st.logId, already: true })
  assert.equal((await back.call('log.list', {})).total, 1)
  back.hooks.pressStop()
  // The other way round: the request is lost with the link, and the helmet never hears of it.
  back.hooks.dropBefore('session.start')
  await assert.rejects(back.call('session.start', { session: preset('obe'), token: 'never-arrived' }), (e) => e.code === 'lost')
  const third = openDemo({})
  assert.deepEqual([(await third.call('status')).state, (await third.call('log.list', {})).total], ['idle', 1])
  third.close()
})

test('hook: the helmet restarts; the session is over and the log says why', async () => {
  const events = []
  const dev = await ready({ onDisconnect: () => events.push('drop'), onRestart: () => events.push('restart') })
  const before = await dev.call('hello')
  const { logId } = await dev.call('session.start', { session: preset('obe'), token: 'cut-short' })
  await sleep(300)
  dev.hooks.restart()
  assert.deepEqual(events, ['drop']) // as over Bluetooth: the link goes with it
  const back = openDemo({ onDisconnect: () => events.push('drop'), onRestart: () => events.push('restart') })
  const hello = await back.call('hello')
  assert.notEqual(hello.bootId, before.bootId)
  assert.deepEqual([hello.resetReason, hello.recoveredLogId, hello.helmetId], ['software restart', logId, before.helmetId])
  const st = await back.call('status')
  assert.deepEqual([st.state, st.token, st.bootId, st.logId], ['idle', '', hello.bootId, 0])
  const entry = (await back.call('log.list', {})).items[0]
  assert.deepEqual([entry.id, entry.finished, entry.completed, entry.reason, entry.token], [logId, true, false, 'restart: software restart', 'cut-short'])
  assert.ok(entry.elapsedMs >= 250 && entry.elapsedMs < 3000)
  // The token of before the restart is unknown now: the same start would start anew.
  const fresh = await back.call('session.start', { session: preset('obe'), token: 'cut-short' })
  assert.equal(fresh.already, undefined)
  assert.notEqual(fresh.logId, logId)

  // As over a USB bridge: the port stays open and the start-up line arrives.
  back.hooks.restart({ keepLink: true })
  assert.deepEqual(events, ['drop', 'restart'])
  const third = await back.call('hello')
  assert.deepEqual([third.recoveredLogId, third.resetReason], [fresh.logId, 'software restart'])
  // Nothing was running this time: nothing recovered.
  back.hooks.restart({ keepLink: true })
  assert.equal((await back.call('hello')).recoveredLogId, 0)
  back.close()
})

test('hook: a helmet that hangs answers nothing and sends no status', async () => {
  const statuses = []
  const dev = await ready({ onStatus: (s) => statuses.push(s) })
  await sleep(100)
  const seen = statuses.length
  assert.ok(seen >= 1)
  dev.hooks.mute(400)
  await assert.rejects(dev.call('hello', {}, 100), (e) => e.code === 'timeout')
  await sleep(100)
  assert.equal(statuses.length, seen)
  await sleep(2400)
  assert.ok(statuses.length > seen)
  assert.equal((await dev.call('hello')).firmware, 'demo')
  dev.close()
})

test('with the keepalive on, the helmet stops a session when the app stays away', async () => {
  const dev = await ready()
  await dev.call('settings.set', { keepaliveS: 5 })
  const { logId } = await dev.call('session.start', { session: preset('obe'), token: 'alone' })
  dev.hooks.drop()
  await sleep(1500)
  let back = openDemo({})
  assert.equal((await back.call('status')).state, 'running', 'back within 5 s: nothing happened')
  back.hooks.drop()
  await sleep(7400)
  back = openDemo({})
  const st = await back.call('status')
  assert.deepEqual([st.state, st.lastStopReason, st.logId], ['idle', 'UI keepalive lost', logId])
  const entry = (await back.call('log.list', {})).items[0]
  assert.deepEqual([entry.completed, entry.reason], [false, 'UI keepalive lost'])
  back.close()
})
