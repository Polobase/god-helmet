// The connection as the views see it (ble/device.js), against a fake helmet:
// what stays on screen when the link drops, reconnecting, what is said about
// the time in between, starts whose reply got lost, Kp.
import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'

// The app's own timers (reconnect pauses, the status watchdog) are made not
// to keep Node alive. While a test waits for one of them, nothing else may be
// pending, and Node 22 then ends the run in the middle of the test. This keeps it alive.
const awake = setInterval(() => {}, 1000)
after(() => clearInterval(awake))

const store = new Map()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
})
// A page to be looked at: the app reconnects at once when it becomes visible
// again. (Vue is loaded first; it would take a `document` for a real one.)
await import('vue')
globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
const {
  device, connect, disconnect, reconnect, restore, call, start, transports, timing, deps, linkNote, estimateStatus, stopReasonText, assess, describeEvent, helmetKey, freshKp, newToken, connected, linkLost,
} = await import('../src/ble/device.js')
const { linkError } = await import('../src/ble/link.js')
const { openBluetooth } = await import('../src/ble/bluetooth.js')
const { fakeHelmet: bleHelmet, fakeBluetooth } = await import('./fake-bluetooth.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(what, cond, ms = 2000) {
  const end = Date.now() + ms
  while (!cond()) {
    if (Date.now() > end) assert.fail(`timed out waiting for ${what}`)
    await sleep(5)
  }
}
const nowS = () => Math.floor(Date.now() / 1000)
const DEFAULT_TIMING = { ...timing, retryMs: [...timing.retryMs] }

// A helmet behind a fake transport. `old`: firmware without helmetId, bootId and tokens.
function fakeHelmet({ kind = 'ble', name = 'GodHelmet-EEFF', helmetId = 'AABBCCDDEEFF', old = false } = {}) {
  const h = {
    kind, name, old, calls: [], opens: [], started: 0, bootId: 11, resetReason: 'power-on', recoveredLogId: 0, settings: { keepaliveS: 0, longitudeDeg: 8 },
    log: [], session: null, last: null, lastStopReason: '', link: null, handlers: null, env: { timeValid: false, kpValid: false },
    unreachable: '', loseReply: '', swallow: '', mute: false, bannerOnOpen: false, helloFails: 0,
  }
  const status = () => {
    const s = h.session
    const out = {
      state: s ? 'running' : 'idle', test: !!s?.test, blind: false, logId: h.last?.logId ?? 0, sessionId: h.last?.sessionId ?? '', sessionName: h.last?.sessionName ?? '',
      phase: 0, phaseCount: 1, phaseName: 'Main', elapsedMs: s ? Date.now() - s.at : 0, programMs: s ? Date.now() - s.at : 0, totalMs: 1_800_000, phaseMs: s ? Date.now() - s.at : 0, phaseDurationMs: 1_800_000,
      fieldUT: 1, lastStopReason: h.lastStopReason,
    }
    if (!old) Object.assign(out, { bootId: h.bootId, token: h.last?.token ?? '', presetId: h.last?.presetId ?? '', startEpoch: h.last?.startEpoch ?? 0, trialId: 0 })
    return out
  }
  h.status = status
  h.begin = ({ sessionId = 'obe', name: sessionName = 'OBE', token = '', test = false } = {}) => {
    h.started++
    const logId = test ? 0 : h.log.length + 1
    if (!test) h.log.unshift({ id: logId, start: nowS(), presetId: sessionId, presetName: sessionName, elapsedMs: 0, finished: false, completed: false, reason: '', rating: -1, trialId: 0, ...(old ? {} : { token }) })
    h.session = { at: Date.now(), test }
    h.last = { logId, sessionId, sessionName, token: old ? '' : token, presetId: sessionId, startEpoch: nowS() }
    h.lastStopReason = ''
    return logId
  }
  h.end = (reason = 'completed', elapsedMs = 60_000) => {
    const entry = h.log.find((e) => e.id === h.last?.logId)
    if (entry) Object.assign(entry, { finished: true, completed: reason === 'completed', reason, elapsedMs })
    h.session = null
    h.lastStopReason = reason
  }
  h.reboot = (resetReason = 'brownout') => {
    const entry = h.session && h.log.find((e) => e.id === h.last.logId)
    if (entry && !old) Object.assign(entry, { finished: true, completed: false, reason: `restart: ${resetReason}`, elapsedMs: 720_000 })
    h.recoveredLogId = entry && !old ? entry.id : 0
    Object.assign(h, { bootId: h.bootId + 1, resetReason, session: null, last: null, lastStopReason: '', env: { timeValid: false, kpValid: false } })
  }
  const ops = {
    'time.set': () => ((h.env.timeValid = true), h.env),
    hello: () => {
      if (h.helloFails > 0 && h.helloFails--) throw linkError('timeout', 'hello: no answer from the helmet')
      return { firmware: old ? '0.3.0' : '0.4.0', protocol: 1, safetyAccepted: true, env: { ...h.env }, ...(old ? {} : { helmetId, bootId: h.bootId, uptimeS: 5, resetReason: h.resetReason, recoveredLogId: h.recoveredLogId }) }
    },
    'settings.get': () => ({ ...h.settings }),
    status,
    'env.set': ({ kp, ap, source }) => Object.assign(h.env, { kpValid: true, kp, ap, kpSource: source }),
    'log.list': ({ offset = 0, limit = 10 }) => ({ total: h.log.length, items: h.log.slice(offset, offset + limit) }),
    'session.start': ({ session, token }) => {
      if (!old && token && h.last?.token === token) return { logId: h.last.logId, already: true }
      if (h.session) throw new Error('a session is already running')
      return { logId: h.begin({ sessionId: session?.id ?? 'custom', name: session?.name ?? 'Custom', token }) }
    },
    test: ({ token }) => {
      if (!old && token && h.last?.token === token) return { logId: 0, already: true }
      if (h.session) throw new Error('a session is already running')
      h.begin({ sessionId: 'test-dc', name: 'DC test', token, test: true })
      return { logId: 0 }
    },
    'session.stop': () => (h.end('stopped from app', 30_000), null),
  }
  h.opener = async (handlers, options = {}) => {
    h.opens.push(options)
    if (h.unreachable) throw linkError(h.unreachable, 'the helmet is out of range')
    if (options.known && h.needsChooser) throw linkError('no-device', 'choose it again')
    const link = { open: true }
    Object.assign(h, { link, handlers })
    return {
      kind, name, id: 'bt-id-1', restarted: h.bannerOnOpen,
      close: () => (link.open = false),
      async call(op, params = {}, ms = 20000) {
        if (!link.open) throw linkError('lost', 'The connection was lost.')
        if (h.mute) {
          await sleep(Math.min(ms, 200))
          throw linkError(link.open ? 'timeout' : 'lost', `${op}: no answer from the helmet`)
        }
        if (h.swallow === op) { // the request never reaches the helmet
          h.swallow = ''
          h.drop()
          throw linkError('lost', 'The connection was lost.')
        }
        h.calls.push({ op, ...params })
        let out
        try {
          if (!ops[op]) throw new Error(`unknown op: ${op}`)
          out = ops[op](params)
        } catch (e) {
          throw e.code ? e : linkError('helmet', e.message)
        }
        if (h.loseReply === op) { // it reaches the helmet; the reply is lost with the link
          h.loseReply = ''
          if (h.loseHow === 'timeout') throw linkError('timeout', `${op}: no answer from the helmet`)
          h.drop()
          throw linkError('lost', 'The connection was lost.')
        }
        return JSON.parse(JSON.stringify(out ?? null))
      },
    }
  }
  h.drop = (reason = 'drop') => {
    if (!h.link?.open) return
    h.link.open = false
    h.handlers.onDisconnect?.({ reason })
  }
  h.push = () => h.handlers.onStatus?.(status())
  h.ops = (name) => h.calls.filter((c) => c.op === name)
  return h
}

let kpFetches = 0
beforeEach(() => {
  disconnect()
  store.clear()
  Object.assign(timing, DEFAULT_TIMING, { retryMs: [15], watchMs: 20 })
  Object.assign(transports, { ble: null, usb: null, demo: null })
  Object.assign(device, { kp: null, kpAt: 0, error: '' })
  kpFetches = 0
  deps.fetchKp = async () => ({ kp: 2 + kpFetches++, ap: 7, time: '2026-11-10 12:00:00' })
})

async function connected1(h) {
  transports[h.kind] = h.opener
  await connect(h.kind)
  assert.equal(device.link, 'connected', device.error)
  return h
}

test('connecting: clock, hello, settings, the status straight away, then Kp', async () => {
  const h = fakeHelmet()
  h.begin({ token: 'someone-elses' })
  transports.ble = h.opener
  assert.deepEqual([device.link, device.ready, connected()], ['none', false, false])
  const connecting = connect('ble')
  assert.deepEqual([device.link, device.connecting, device.kind], ['connecting', true, null])
  await connecting
  assert.deepEqual(h.calls.map((c) => c.op), ['time.set', 'hello', 'settings.get', 'status', 'env.set'])
  assert.ok(Math.abs(h.calls[0].epochMs - Date.now()) < 2000)
  assert.deepEqual([device.link, device.connecting, device.kind, device.name, device.ready, device.stale, connected()], ['connected', false, 'ble', 'GodHelmet-EEFF', true, false, true])
  // No status was pushed: the one that was asked for says that a session runs.
  assert.equal(device.status.state, 'running')
  assert.ok(Date.now() - device.statusAt < 2000)
  assert.deepEqual([h.ops('env.set')[0].kp, h.ops('env.set')[0].source], [2, 'noaa'])
  assert.equal(device.info.env.kpValid, true, 'the reply to env.set is the helmet\'s environment now')
  assert.equal(helmetKey(), 'id:AABBCCDDEEFF')
  assert.equal(linkNote(), null)
  assert.deepEqual(h.opens, [{}])

  // "Connecting…" does not wait for NOAA: a network that never answers must not hold it.
  disconnect()
  let answer
  deps.fetchKp = () => new Promise((resolve) => (answer = resolve))
  device.kp = null
  const slow = connect('ble')
  await until('connected', () => device.link === 'connected')
  assert.deepEqual([device.connecting, device.ready], [false, true])
  answer({ kp: 4, ap: 27 })
  await slow
  assert.equal(h.ops('env.set').at(-1).kp, 4)
})

test('a drop keeps the helmet and its session; the app reconnects by itself and says what it found', async () => {
  const h = await connected1(fakeHelmet())
  const { logId } = await start('session.start', { session: { id: 'obe', name: 'OBE' }, presetId: 'obe' })
  assert.match(h.ops('session.start')[0].token, /^[A-Za-z0-9_-]{16}$/)
  await until('the running status', () => device.status.state === 'running')
  const info = device.info
  timing.retryMs = [150]
  h.drop()
  assert.deepEqual([device.link, device.kind, device.name, device.stale, device.ready, linkLost(), connected()], ['lost', 'ble', 'GodHelmet-EEFF', true, false, true, false])
  assert.equal(device.info, info)
  assert.equal(device.settings.keepaliveS, 0)
  assert.deepEqual([device.status.state, device.status.logId, device.status.sessionName], ['running', logId, 'OBE'])
  assert.ok(device.lostAt > 0 && device.statusAt > 0)
  // What is true depends on what is known: no keepalive, so it runs on.
  let note = linkNote()
  assert.equal(note.lost, true)
  assert.match(note.text, /^Connection to GodHelmet-EEFF lost\. Reconnecting… “OBE” keeps running on the helmet; .* only the helmet’s STOP button stops it\.$/)
  device.settings.keepaliveS = 30
  assert.match(linkNote().text, /The helmet stops “OBE” by itself after 30 s without the app\.$/)
  assert.match(linkNote(Date.now() + 40_000).text, /The helmet has stopped “OBE” by now: it does so after 30 s without the app\.$/)
  device.settings.keepaliveS = 0
  assert.match(linkNote(Date.now() + 3600_000).text, /“OBE” should have ended by now\.$/)
  // Requests fail at once, with the reason.
  await assert.rejects(call('session.stop'), (e) => e.code === 'lost' && /connection to the helmet is lost/.test(e.message))
  // The time left goes on by the clock.
  const est = estimateStatus(device.status, 10_000)
  assert.deepEqual([est.estimated, est.over, est.programMs - device.status.programMs], [true, false, 10_000])

  await until('the reconnect', () => device.link === 'connected')
  assert.deepEqual(h.opens.at(-1), { known: { id: 'bt-id-1', name: 'GodHelmet-EEFF' } }, 'without the chooser')
  assert.deepEqual(h.calls.slice(-5).map((c) => c.op).slice(0, 4), ['time.set', 'hello', 'settings.get', 'status'])
  assert.deepEqual([device.event.type, device.stale, device.ready], ['running', false, true])
  note = linkNote()
  assert.deepEqual([note.tone, note.text], ['success', 'Reconnected. “OBE” is still running.'])
  await call('session.stop') // works again
  assert.equal(h.session, null)
})

test('the session ended while the link was down: when, and why', async () => {
  const h = await connected1(fakeHelmet())
  h.settings.keepaliveS = 20
  await start('session.start', { session: { id: 'obe', name: 'OBE' } })
  await until('running', () => device.status.state === 'running')
  h.drop()
  h.end('UI keepalive lost', 95_000)
  await until('the reconnect', () => device.link === 'connected')
  assert.equal(device.event.type, 'ended')
  await until('the log entry', () => device.event.endedAt > 0)
  assert.deepEqual([device.event.reason, device.event.elapsedMs], ['UI keepalive lost', 95_000])
  assert.match(linkNote().text, /^Reconnected\. “OBE” ended at \d{1,2}[:.]\d{2}.* while the connection was down: the helmet stopped it after 20 s without the app\.$/)
  assert.equal(linkNote().tone, 'warning')
  assert.equal(device.status.state, 'idle')
})

test('the helmet restarted meanwhile: reset reason, and the log entry it closed', async () => {
  const h = await connected1(fakeHelmet())
  const { logId } = await start('session.start', { session: { id: 'obe', name: 'OBE' } })
  await until('running', () => device.status.state === 'running')
  h.drop()
  h.reboot('brownout')
  await until('the reconnect', () => device.link === 'connected')
  assert.deepEqual([device.event.type, device.event.resetReason, device.event.logId], ['restarted', 'brownout', logId])
  await until('the log entry', () => device.event.elapsedMs > 0)
  assert.equal(device.event.reason, 'restart: brownout')
  assert.match(linkNote().text, /^The helmet restarted \(brownout\) while the connection was down\. “OBE” ended at .* after 12 min; it is in the Log\.$/)
  // The clock and Kp went to the new boot too.
  assert.equal(h.env.timeValid, true)
  assert.equal(h.env.kpValid, true)

  // A restart with nothing running.
  h.drop()
  h.reboot('software restart')
  await until('the reconnect', () => device.link === 'connected')
  assert.equal(linkNote().text, 'The helmet restarted (software restart) while the connection was down. No session is running.')
})

test('another helmet answers: said so, and nothing of the old one is taken for its own', async () => {
  const a = await connected1(fakeHelmet())
  await start('session.start', { session: { id: 'obe', name: 'OBE' } })
  await until('running', () => device.status.state === 'running')
  timing.retryMs = [60_000]
  a.drop()
  const b = fakeHelmet({ name: 'GodHelmet-0002', helmetId: '000000000002' })
  transports.ble = b.opener
  await connect('ble') // the chooser, and the user picks the other one
  assert.deepEqual([device.link, device.name, device.event.type, device.status.state], ['connected', 'GodHelmet-0002', 'other', 'idle'])
  assert.equal(linkNote().text, 'This is another helmet (GodHelmet-0002), not GodHelmet-EEFF. “OBE” was running on the other one.')
  assert.equal(helmetKey(), 'id:000000000002')
})

test('the same helmet over USB instead of Bluetooth is the same helmet', async () => {
  const h = await connected1(fakeHelmet())
  await start('session.start', { session: { id: 'obe', name: 'OBE' } })
  await until('running', () => device.status.state === 'running')
  const key = helmetKey()
  timing.retryMs = [60_000]
  h.drop()
  const usb = fakeHelmet({ kind: 'usb', name: 'Helmet (USB)' })
  Object.assign(usb, { bootId: h.bootId, session: h.session, last: h.last, log: h.log })
  transports.usb = usb.opener
  await connect('usb')
  assert.deepEqual([device.kind, device.event.type, helmetKey()], ['usb', 'running', key])
})

test('firmware without the new fields: the session is found by its log entry; a restart by the start-up line', async () => {
  const h = await connected1(fakeHelmet({ kind: 'usb', name: 'Helmet (USB)', old: true }))
  assert.equal(helmetKey(), 'usb:Helmet (USB)')
  await start('session.start', { session: { id: 'obe', name: 'OBE' } })
  await until('running', () => device.status.state === 'running')
  assert.equal(h.ops('session.start')[0].token.length, 16, 'the token is sent; older firmware ignores it')
  h.drop()
  assert.match(linkNote().text, /^USB connection to the helmet lost\. Plug the cable in again; if the app does not reconnect by itself, press Reconnect\. “OBE” keeps running/)
  assert.deepEqual(h.opens.at(-1), {})
  await until('the reconnect', () => device.link === 'connected')
  assert.equal(device.event.type, 'running')

  h.drop()
  h.end('STOP button', 40_000)
  await until('the reconnect', () => device.link === 'connected')
  await until('the log entry', () => device.event.endedAt > 0)
  assert.match(linkNote().text, /“OBE” ended at .* while the connection was down: it was stopped with the helmet’s STOP button\.$/)

  // Opening the port restarted the board (older boards): its start-up line was seen.
  await start('session.start', { session: { id: 'obe', name: 'OBE' } })
  await until('running', () => device.status.state === 'running')
  h.drop()
  h.reboot()
  h.bannerOnOpen = true
  await until('the reconnect', () => device.link === 'connected')
  assert.equal(device.event.type, 'restarted')
  assert.match(linkNote().text, /^The helmet restarted while the connection was down\. “OBE” ended; it is in the Log\.$/)
})

test('firmware too old to be asked for its status: ready, and the report, come with the first push', async () => {
  const h = fakeHelmet({ old: true })
  const open = h.opener
  transports.ble = async (...args) => {
    const t = await open(...args)
    const real = t.call
    t.call = (op, params, ms) => (op === 'status' ? Promise.reject(linkError('helmet', 'unknown op: status')) : real(op, params, ms))
    return t
  }
  h.begin()
  await connect('ble')
  assert.deepEqual([device.link, device.ready, device.status], ['connected', false, null])
  h.push()
  assert.deepEqual([device.ready, device.status.state], [true, 'running'])
  h.drop()
  h.end('completed', 50_000)
  await until('the reconnect', () => device.link === 'connected')
  assert.deepEqual([device.ready, device.event, device.status.state], [false, null, 'running'], 'the old status stays, marked stale, until the helmet says more')
  assert.equal(device.stale, true)
  h.push()
  assert.deepEqual([device.ready, device.event.type, device.status.state], [true, 'ended', 'idle'])
})

test('the start-up line over USB with the port open: clock and Kp are sent again', async () => {
  const h = await connected1(fakeHelmet({ kind: 'usb', name: 'Helmet (USB)' }))
  const { logId } = await start('session.start', { session: { id: 'obe', name: 'OBE' } })
  await until('running', () => device.status.state === 'running')
  timing.bootHelloMs = 20
  const before = h.calls.length
  h.reboot('task watchdog')
  h.helloFails = 2 // it needs a moment before it answers again
  h.handlers.onRestart()
  await until('the report', () => device.event?.type === 'restarted')
  await until('Kp', () => h.env.kpValid)
  const ops = h.calls.slice(before).map((c) => c.op)
  // (Two hellos went unanswered, the third came through.)
  assert.deepEqual(ops.filter((o) => o !== 'log.list'), ['hello', 'hello', 'hello', 'time.set', 'hello', 'settings.get', 'status', 'env.set'])
  assert.deepEqual([device.link, device.info.bootId, device.status.state, device.ready], ['connected', h.bootId, 'idle', true])
  assert.deepEqual([device.event.resetReason, device.event.logId, device.event.linkKept], ['task watchdog', logId, true])
  await until('the log entry', () => device.event.elapsedMs > 0)
  assert.match(linkNote().text, /^The helmet restarted \(task watchdog\)\. “OBE” ended at .* after 12 min; it is in the Log\.$/)
  assert.equal(h.env.timeValid, true)
})

test('out of reach for long: the app gives up politely, and Reconnect still works', async () => {
  const h = await connected1(fakeHelmet())
  await start('session.start', { session: { id: 'obe', name: 'OBE' } })
  await until('running', () => device.status.state === 'running')
  Object.assign(timing, { retryMs: [5, 10, 20], giveUpMs: 120 })
  h.unreachable = 'timeout'
  h.drop()
  await until('giving up', () => device.gaveUp, 3000)
  const attempts = h.opens.length
  assert.ok(attempts >= 4, `kept trying, with growing pauses (${attempts})`)
  assert.deepEqual([device.link, device.kind, device.status.state, device.error], ['lost', 'ble', 'running', ''])
  assert.match(linkNote().text, /The app has stopped trying: press Reconnect when the helmet is back in range\./)
  await sleep(80)
  assert.equal(h.opens.length, attempts, 'no more attempts by itself')
  // Reconnect while it is still away: back to "lost", and trying again for a while.
  await reconnect()
  assert.equal(device.link, 'lost')
  h.unreachable = ''
  await reconnect()
  assert.deepEqual([device.link, device.gaveUp, device.event.type], ['connected', false, 'running'])
})

test('the page is looked at again (the phone wakes up): the app tries at once, also after it gave up', async () => {
  const h = await connected1(fakeHelmet())
  Object.assign(timing, { retryMs: [60_000], giveUpMs: 60_000 })
  h.unreachable = 'timeout'
  h.drop()
  const opens = h.opens.length
  // Hidden: nothing happens.
  document.visibilityState = 'hidden'
  document.dispatchEvent(new Event('visibilitychange'))
  await sleep(20)
  assert.equal(h.opens.length, opens)
  // Visible, the helmet still away: one attempt, and the long pause goes on.
  document.visibilityState = 'visible'
  document.dispatchEvent(new Event('visibilitychange'))
  await until('an attempt', () => h.opens.length === opens + 1 && device.link === 'lost')
  h.unreachable = ''
  document.dispatchEvent(new Event('visibilitychange'))
  await until('the reconnect', () => device.link === 'connected', 500)
  assert.deepEqual(h.opens.at(-1), { known: { id: 'bt-id-1', name: 'GodHelmet-EEFF' } })

  // After giving up, too.
  Object.assign(timing, { retryMs: [5], giveUpMs: 30 })
  h.unreachable = 'timeout'
  h.drop()
  await until('giving up', () => device.gaveUp)
  h.unreachable = ''
  document.dispatchEvent(new Event('visibilitychange'))
  await until('the reconnect', () => device.link === 'connected', 500)
  assert.equal(device.gaveUp, false)
})

test('Bluetooth where only the chooser brings the helmet back: Reconnect opens it', async () => {
  const h = await connected1(fakeHelmet())
  h.needsChooser = true // e.g. after a reload in a browser without getDevices()
  h.drop()
  await until('the first attempt', () => device.needsChooser)
  assert.match(linkNote().text, /This browser cannot find it again by itself: press Reconnect and choose it\./)
  const attempts = h.opens.length
  await sleep(60)
  assert.equal(h.opens.length, attempts, 'no pointless attempts')
  await reconnect()
  assert.deepEqual(h.opens.at(-1), {}, 'with the chooser this time')
  assert.deepEqual([device.link, device.needsChooser], ['connected', false])
})

test('Disconnect is deliberate: everything is cleared, and nothing reconnects', async () => {
  const h = await connected1(fakeHelmet())
  h.drop()
  assert.equal(device.link, 'lost')
  disconnect()
  assert.deepEqual([device.link, device.kind, device.name, device.info, device.settings, device.status, device.notice], ['none', null, '', null, null, null, null])
  const opens = h.opens.length
  await sleep(60)
  assert.equal(h.opens.length, opens)
  assert.equal(store.get('godhelmet-link'), undefined)
  await assert.rejects(call('hello'), /Connect the helmet first/)
})

test('a drop while connecting ends "Connecting…" at once, with the cause', async () => {
  const h = fakeHelmet()
  h.swallow = 'hello'
  transports.ble = h.opener
  const started = Date.now()
  await connect('ble')
  assert.ok(Date.now() - started < 500)
  assert.deepEqual([device.link, device.connecting, device.kind, device.error], ['none', false, null, 'The connection was lost.'])
  // The chooser cancelled: no error at all.
  transports.ble = async () => {
    throw Object.assign(new Error('User cancelled'), { name: 'NotFoundError' })
  }
  await connect('ble')
  assert.deepEqual([device.link, device.error], ['none', ''])
})

test('no status for too long: the app asks; no answer either, and the link counts as lost', async () => {
  const h = await connected1(fakeHelmet())
  Object.assign(timing, { staleIdleMs: 60, probeMs: 50, retryMs: [60_000] })
  await disconnect()
  await connected1(h)
  const asked = h.ops('status').length
  // Quiet, but it answers when asked: nothing happens.
  await until('a probe', () => h.ops('status').length > asked)
  await sleep(30)
  assert.deepEqual([device.link, device.stale], ['connected', false])
  // It hangs.
  h.mute = true
  await until('lost', () => device.link === 'lost', 3000)
  assert.deepEqual([device.lostWhy, device.kind], ['silent', 'ble'])
  assert.match(linkNote().text, /^GodHelmet-EEFF has stopped answering\. Reconnecting…$/)
  assert.equal(h.link.open, false, 'the dead link was closed')
})

test('a start whose reply was lost: the session is found by its token, never started twice', async () => {
  const h = await connected1(fakeHelmet())
  // 1. The helmet got it; the reply went down with the link.
  h.loseReply = 'session.start'
  let waiting = 0
  const reply = await start('session.start', { session: { id: 'obe', name: 'OBE' }, presetId: 'obe' }, { onWaiting: () => waiting++ })
  assert.deepEqual(reply, { logId: 1, already: true })
  assert.deepEqual([waiting, h.started, h.ops('session.start').length, device.link], [1, 1, 1, 'connected'])
  assert.equal(device.status.token, h.ops('session.start')[0].token)
  h.end()

  // 2. The helmet never got it: sent once more with the same token, once the link is back.
  h.swallow = 'session.start'
  const second = await start('session.start', { session: { id: 'obe', name: 'OBE' } }, { token: 'my-own-token' })
  assert.deepEqual(second, { logId: 2 })
  assert.deepEqual([h.started, h.ops('session.start').at(-1).token], [2, 'my-own-token'])
  h.end()

  // 3. No answer in time, the link still up: the same check.
  Object.assign(h, { loseReply: 'test', loseHow: 'timeout' })
  assert.deepEqual(await start('test', { mode: 'dc', mA: 2 }), { logId: 0, already: true })
  assert.equal(h.started, 3)
  h.end()

  // 4. It ran and ended, and another session followed: found in the log by the token.
  Object.assign(h, { loseReply: 'session.start', loseHow: '' })
  timing.retryMs = [80]
  const fourth = start('session.start', { session: { id: 'obe', name: 'OBE' } }, { token: 'ended-meanwhile' })
  await until('the drop', () => device.link !== 'connected')
  h.end()
  h.begin({ sessionId: 'other', name: 'Other', token: 'someone-else' })
  assert.deepEqual(await fourth, { logId: 3, already: true, ended: true })
  assert.equal(h.started, 5)
  h.end()
  timing.retryMs = [15]

  // 5. Too late: a field must not come on minutes after Start was pressed.
  timing.startRepeatMs = -1
  h.swallow = 'session.start'
  await assert.rejects(start('session.start', { session: { id: 'obe' } }), /nothing was started/)
  assert.equal(h.started, 5)
  timing.startRepeatMs = 120_000

  // 6. The helmet restarted in between: whatever had started is over.
  h.loseReply = 'session.start'
  const sixth = start('session.start', { session: { id: 'obe' } })
  await until('the drop', () => device.link !== 'connected')
  h.reboot()
  await assert.rejects(sixth, /The helmet restarted before it answered/)

  // 7. An answer from the helmet is an answer: no second try.
  h.begin({ token: 'busy' })
  const starts = h.ops('session.start').length
  await assert.rejects(start('session.start', { session: { id: 'obe' } }), /already running/)
  assert.equal(h.ops('session.start').length, starts + 1)

  // 8. Disconnect while it waits: it ends.
  h.end()
  timing.retryMs = [60_000]
  h.swallow = 'session.start'
  const eighth = assert.rejects(start('session.start', { session: { id: 'obe' } }), /disconnected/)
  await until('the drop', () => device.link === 'lost')
  await sleep(10) // it is waiting for the link now
  disconnect()
  await eighth
  // ...and when the helmet was disconnected before it even began to wait.
  await connected1(h)
  h.swallow = 'session.start'
  const ninth = assert.rejects(start('session.start', { session: { id: 'obe' } }), /disconnected/)
  disconnect()
  await ninth
})

test('a lost start reply with firmware that knows no tokens', async () => {
  const h = await connected1(fakeHelmet({ old: true }))
  // It runs what we asked for, since we asked: ours.
  h.loseReply = 'session.start'
  assert.deepEqual(await start('session.start', { session: { id: 'obe', name: 'OBE' }, presetId: 'obe' }), { logId: 1, already: true })
  assert.deepEqual([h.started, h.ops('session.start').length], [1, 1])
  // It ran and has ended: the newest log entry is it.
  h.end()
  h.loseReply = 'session.start'
  timing.retryMs = [60]
  const second = start('session.start', { session: { id: 'obe', name: 'OBE' }, presetId: 'obe' })
  await until('the drop', () => device.link !== 'connected')
  h.end()
  assert.deepEqual(await second, { logId: 2, already: true, ended: true })
  assert.equal(h.started, 2)
  // Never arrived (another program, so the entry of a moment ago cannot be taken for it): sent again.
  h.swallow = 'session.start'
  assert.deepEqual(await start('session.start', { session: { id: 'thomas', name: 'Thomas' }, presetId: 'thomas' }), { logId: 3 })
  // Something else runs: not ours, and nothing is started on top.
  h.end()
  h.swallow = 'session.start'
  const fourth = assert.rejects(start('session.start', { session: { id: 'obe' } }), /Another session is running/)
  await until('the drop', () => device.link !== 'connected')
  h.begin({ sessionId: 'shakti', name: 'Shakti' })
  await fourth
  assert.equal(h.started, 4)
})

test('a request the helmet dropped as busy: the start is repeated with the same token', async () => {
  const h = await connected1(fakeHelmet())
  let busy = 1
  const open = h.opener
  transports.ble = async (...args) => {
    const t = await open(...args)
    const real = t.call
    t.call = (op, params, ms) => (op === 'session.start' && busy-- > 0 ? Promise.reject(linkError('helmet', 'busy: request dropped')) : real(op, params, ms))
    return t
  }
  disconnect()
  await connect('ble')
  assert.deepEqual(await start('session.start', { session: { id: 'obe' } }), { logId: 1 })
  assert.equal(h.started, 1)
})

test('Kp: fetched again when older than three hours, and never sent old as fresh', async () => {
  const h = await connected1(fakeHelmet())
  assert.deepEqual([kpFetches, h.ops('env.set').length, h.ops('env.set')[0].kp], [1, 1, 2])
  // Soon after: the same value, without asking NOAA again.
  h.drop()
  await until('the reconnect', () => device.link === 'connected')
  await until('Kp', () => h.ops('env.set').length === 2)
  assert.deepEqual([kpFetches, h.ops('env.set')[1].kp], [1, 2])
  // Hours later: asked again.
  device.kpAt -= 3 * 3600_000 + 1000
  h.drop()
  await until('the reconnect', () => device.link === 'connected')
  await until('Kp', () => h.ops('env.set').length === 3)
  assert.deepEqual([kpFetches, h.ops('env.set')[2].kp], [2, 3])
  // Hours later and offline: nothing is sent.
  device.kpAt -= 4 * 3600_000
  deps.fetchKp = async () => {
    kpFetches++
    throw new Error('offline')
  }
  h.drop()
  await until('the reconnect', () => device.link === 'connected')
  await sleep(30)
  assert.deepEqual([kpFetches, h.ops('env.set').length], [3, 3])
  await assert.rejects(freshKp(), /offline/)
  // By hand ("Update Kp from NOAA"): always asks.
  deps.fetchKp = async () => ({ kp: 5, ap: 48 })
  device.kpAt = Date.now()
  assert.equal((await freshKp(true)).kp, 5)
})

test('after a reload: the helmet and its session are shown again, and the app reconnects', async () => {
  const h = await connected1(fakeHelmet())
  h.settings.keepaliveS = 0
  await start('session.start', { session: { id: 'obe', name: 'OBE' } })
  await until('running', () => device.status.state === 'running')
  const memory = store.get('godhelmet-link')
  assert.ok(memory, 'the last helmet is remembered')
  assert.deepEqual((({ kind, name, helmetId, bootId }) => [kind, name, helmetId, bootId])(JSON.parse(memory)), ['ble', 'GodHelmet-EEFF', 'AABBCCDDEEFF', 11])

  // The page reloads: nothing in the page's memory, the stored record still there.
  const reload = () => {
    disconnect()
    store.set('godhelmet-link', memory)
    transports.ble = h.opener
  }
  reload()
  timing.retryMs = [80]
  h.unreachable = 'timeout'
  assert.equal(restore(), true)
  assert.deepEqual([device.link === 'none', device.kind, device.name, device.status.state, device.status.sessionName, device.stale, device.lostWhy], [false, 'ble', 'GodHelmet-EEFF', 'running', 'OBE', true, 'reload'])
  assert.match(linkNote().text, /^Reconnecting to GodHelmet-EEFF… “OBE” keeps running on the helmet/)
  h.unreachable = ''
  await until('the reconnect', () => device.link === 'connected')
  assert.deepEqual(h.opens.at(-1), { known: { id: 'bt-id-1', name: 'GodHelmet-EEFF' } })
  assert.deepEqual([device.event.type, linkNote().text], ['running', 'Reconnected. “OBE” is still running.'])

  // Reloaded, and the browser cannot find the helmet by itself: the session stays, with Reconnect.
  reload()
  h.needsChooser = true
  restore()
  await until('the attempt', () => device.needsChooser)
  assert.deepEqual([device.link, device.status.state], ['lost', 'running'])
  assert.match(linkNote().text, /^GodHelmet-EEFF was connected before this page was reloaded\. This browser cannot find it again by itself: press Reconnect and choose it\. “OBE” keeps running/)
  await reconnect()
  assert.equal(device.link, 'connected')
  h.needsChooser = false

  // Nothing was running: a few quiet attempts, then simply "not connected".
  await call('session.stop')
  h.push()
  await until('idle', () => device.status.state === 'idle')
  const idle = store.get('godhelmet-link')
  assert.equal(JSON.parse(idle).status, null)
  disconnect()
  store.set('godhelmet-link', idle)
  Object.assign(timing, { retryMs: [5], quietTries: 3 })
  h.unreachable = 'timeout'
  const opens = h.opens.length
  restore()
  assert.equal(linkNote().text, 'Reconnecting to GodHelmet-EEFF…')
  await until('giving up quietly', () => device.link === 'none')
  assert.deepEqual([h.opens.length - opens, device.kind, device.error, device.notice], [3, null, '', null])
  // ...or, when it is there, connected again without a word.
  store.set('godhelmet-link', idle)
  h.unreachable = ''
  restore()
  await until('the reconnect', () => device.link === 'connected')
  assert.equal(linkNote(), null)

  // A record too old is not used.
  disconnect()
  store.set('godhelmet-link', JSON.stringify({ ...JSON.parse(idle), at: Date.now() - 13 * 3600_000 }))
  assert.equal(restore(), false)
  assert.equal(device.link, 'none')
})

test('after a reload long after the session\'s planned end: not shown as running, but reported', async () => {
  const h = await connected1(fakeHelmet())
  await start('session.start', { session: { id: 'obe', name: 'OBE' } })
  await until('running', () => device.status.state === 'running')
  const m = JSON.parse(store.get('godhelmet-link'))
  disconnect()
  store.set('godhelmet-link', JSON.stringify({ ...m, statusAt: m.statusAt - 3600_000 }))
  h.end('completed', 1_800_000)
  restore()
  assert.equal(device.status, null)
  await until('the reconnect', () => device.link === 'connected')
  await until('the log entry', () => device.event?.endedAt > 0)
  assert.match(linkNote().text, /^Reconnected\. “OBE” ended at .* while the connection was down: it ran to its end\.$/)
})

test('the words: stop reasons, the estimate, and what a reconnect found', () => {
  assert.equal(stopReasonText('completed'), 'it ran to its end')
  assert.equal(stopReasonText('UI keepalive lost', 0), 'the helmet stopped it because no app was connected')
  assert.equal(stopReasonText('restart: panic'), 'the helmet restarted (panic)')
  assert.equal(stopReasonText('power lost'), 'the helmet lost power')
  assert.equal(stopReasonText('something new'), 'the helmet says “something new”')
  assert.equal(stopReasonText(''), '')

  const st = { state: 'running', programMs: 60_000, elapsedMs: 61_000, totalMs: 100_000, phaseMs: 5_000, phaseDurationMs: 20_000 }
  assert.equal(estimateStatus(st, 0), st)
  assert.equal(estimateStatus(null, 500), null)
  assert.deepEqual(estimateStatus({ state: 'idle' }, 500), { state: 'idle' })
  assert.deepEqual(estimateStatus(st, 30_000), { ...st, programMs: 90_000, elapsedMs: 91_000, phaseMs: 20_000, estimated: true, over: false })
  assert.deepEqual([estimateStatus(st, 50_000).programMs, estimateStatus(st, 50_000).over], [100_000, true])
  assert.equal(estimateStatus({ ...st, state: 'stopping' }, 100).over, true)

  const running = { state: 'running', logId: 4, sessionId: 'obe', sessionName: 'OBE', token: 'tok' }
  const before = { kind: 'ble', name: 'GodHelmet-1', helmetId: 'A', bootId: 3, status: running }
  const now = (o) => ({ kind: 'ble', name: 'GodHelmet-1', info: { helmetId: 'A', bootId: 3 }, status: { state: 'idle', token: 'tok', lastStopReason: 'completed' }, ...o })
  assert.equal(assess(before, now({ status: running })).type, 'running')
  assert.deepEqual((({ type, reason, logId }) => [type, reason, logId])(assess(before, now())), ['ended', 'completed', 4])
  // Another session runs now: ours has ended, and its reason is not in this status.
  assert.deepEqual((({ type, reason, another }) => [type, reason, another])(assess(before, now({ status: { ...running, token: 'other', logId: 5, lastStopReason: '' } }))), ['ended', '', true])
  assert.equal(assess(before, now({ info: { helmetId: 'A', bootId: 4, resetReason: 'panic', recoveredLogId: 4 } })).type, 'restarted')
  assert.equal(assess(before, now({ info: { helmetId: 'B', bootId: 3 } })).type, 'other')
  assert.equal(assess({ ...before, status: null }, now()).type, 'back')
  // Without ids: the same name over the same kind of link is taken to be the same helmet.
  const plain = { kind: 'ble', name: 'GodHelmet-1', helmetId: '', bootId: 0, status: { state: 'running', logId: 4, sessionId: 'obe' } }
  assert.equal(assess(plain, { kind: 'ble', name: 'GodHelmet-1', info: {}, status: { state: 'running', logId: 4, sessionId: 'obe' } }).type, 'running')
  assert.equal(assess(plain, { kind: 'ble', name: 'GodHelmet-2', info: {}, status: { state: 'idle' } }).type, 'other')
  assert.equal(assess(plain, { kind: 'ble', name: 'GodHelmet-1', info: {}, status: { state: 'idle' }, sawRestart: true }).type, 'restarted')

  assert.equal(describeEvent({ type: 'restarted', reason: 'power lost', session: running, logId: 4, elapsedMs: 0 }).text, 'The helmet lost power and started again. “OBE” ended; it is in the Log.')
  assert.equal(describeEvent({ type: 'back', kind: 'demo', name: 'Demo helmet' }).text, 'Reconnected to the demo helmet.')
  assert.match(newToken(), /^[A-Za-z0-9_-]{16}$/)
  assert.notEqual(newToken(), newToken())
})

test('Bluetooth after a reload, with the real transport: the remembered helmet comes back through getDevices()', async () => {
  // A helmet that answers what connecting asks, behind stand-in Bluetooth objects.
  const answers = (id) => (req) => ({ ok: true, data: { hello: { helmetId: id, bootId: 3 }, status: { state: 'idle', token: '', bootId: 3 }, 'settings.get': { keepaliveS: 0 } }[req.op] ?? {} })
  const a = bleHelmet({ id: 'browser-id-a', name: 'GodHelmet-000A', answer: answers('00000000000A') })
  const b = bleHelmet({ id: 'browser-id-b', name: 'GodHelmet-000B', answer: answers('00000000000B') })
  // First helmet A, by the chooser: its device object is the one the transport keeps.
  const first = fakeBluetooth(a)
  transports.ble = (handlers, options) => openBluetooth(handlers, { ...options, bluetooth: first })
  await connect('ble')
  assert.deepEqual([device.link, device.info.helmetId, first.choosers], ['connected', '00000000000A', 1])
  const memory = JSON.parse(store.get('godhelmet-link'))
  assert.equal(memory.id, 'browser-id-a')
  disconnect()

  // A reload, and the helmet that was in use then was B: found by the browser's id for it, not the chooser, and not A.
  store.set('godhelmet-link', JSON.stringify({ ...memory, id: 'browser-id-b', name: 'GodHelmet-000B', helmetId: '00000000000B', key: 'id:00000000000B' }))
  const remembers = fakeBluetooth(b, { remembers: true })
  transports.ble = (handlers, options) => openBluetooth(handlers, { ...options, bluetooth: remembers })
  assert.equal(restore(), true)
  await until('the reconnect', () => device.link === 'connected')
  assert.deepEqual([device.info.helmetId, device.name, remembers.choosers, remembers.asked, b.connects, a.connects], ['00000000000B', 'GodHelmet-000B', 0, 1, 1, 1])

  // In a browser without getDevices(): quietly not connected (nothing was running), no chooser out of the blue.
  disconnect()
  store.set('godhelmet-link', JSON.stringify({ ...memory, id: 'browser-id-c', name: 'GodHelmet-000C' }))
  const plain = fakeBluetooth(b)
  transports.ble = (handlers, options) => openBluetooth(handlers, { ...options, bluetooth: plain })
  restore()
  await until('giving up quietly', () => device.link === 'none')
  assert.equal(plain.choosers, 0)
})

test('a drop while the helmet is still being read: not "connected" on a dead link', async () => {
  const h = fakeHelmet()
  const open = h.opener
  transports.ble = async (handlers, options) => {
    const t = await open(handlers, options)
    const real = t.call
    t.call = (op, params, ms) => {
      if (op !== 'status') return real(op, params, ms)
      handlers.onStatus(h.status()) // a status was pushed,
      h.link.open = false
      handlers.onDisconnect({ reason: 'drop' }) // then the link went, while the request for one was waiting
      return Promise.reject(linkError('lost', 'The connection was lost.'))
    }
    return t
  }
  await connect('ble')
  assert.deepEqual([device.link, device.kind, device.error], ['none', null, 'The connection was lost.'])
  // The same between two requests, with nothing waiting.
  transports.ble = async (handlers, options) => {
    const t = await open(handlers, options)
    const real = t.call
    t.call = async (op, params, ms) => {
      const out = await real(op, params, ms)
      if (op === 'settings.get') handlers.onDisconnect({ reason: 'drop' })
      return out
    }
    return t
  }
  await connect('ble')
  assert.deepEqual([device.link, device.kind, device.error], ['none', null, 'The helmet disconnected while connecting.'])
})

test('the start-up line, then the cable is pulled: no busy loop, and the drop takes over', async () => {
  const h = await connected1(fakeHelmet({ kind: 'usb', name: 'Helmet (USB)' }))
  Object.assign(timing, { bootHelloMs: 20, bootWaitMs: 2000, retryMs: [60_000] })
  let asked = 0
  let ticks = 0
  const beat = setInterval(() => ticks++, 5)
  // Every request fails at once, but the transport has not said "disconnected" yet.
  h.link.open = false
  const calls = h.calls.length
  h.handlers.onRestart()
  await sleep(120)
  asked = h.calls.length - calls
  clearInterval(beat)
  assert.ok(ticks > 10, `the page stayed alive (${ticks} ticks)`)
  assert.equal(asked, 0)
  assert.equal(device.link, 'connected', 'the transport reports the drop itself')
  h.link.open = true
  h.drop()
  assert.equal(device.link, 'lost')
})

test('USB, and the browser has forgotten the board (no serial number): Reconnect opens the chooser', async () => {
  const h = await connected1(fakeHelmet({ kind: 'usb', name: 'Helmet (USB)' }))
  timing.retryMs = [20]
  h.needsChooser = true // getPorts() is empty after the replug
  h.drop()
  await until('some attempts', () => h.opens.length >= 4)
  assert.deepEqual([device.link === 'connected', device.needsChooser], [false, false], 'it keeps looking: the board may only be unplugged')
  await reconnect()
  assert.deepEqual(h.opens.at(-1), {}, 'the chooser')
  assert.equal(device.link, 'connected')
})

test('an attempt to reconnect that never comes to an end is given up', async () => {
  const h = await connected1(fakeHelmet())
  Object.assign(timing, { openMs: 40, retryMs: [10] })
  let hung = 0
  const open = h.opener
  transports.ble = (handlers, options) => (hung++ < 2 ? new Promise(() => {}) : open(handlers, options))
  h.drop()
  await until('the reconnect', () => device.link === 'connected', 3000)
  assert.equal(hung, 3)
})

test('a start that is not wanted any more is not sent a second time', async () => {
  const h = await connected1(fakeHelmet())
  let wanted = true
  h.swallow = 'session.start' // it never reaches the helmet
  const waiting = assert.rejects(start('session.start', { session: { id: 'obe' } }, { wanted: () => wanted }), (e) => e.code === 'unwanted')
  wanted = false // e.g. the guide's step is over
  await waiting
  assert.deepEqual([h.started, device.link], [0, 'connected'])
  // Still wanted: sent again.
  h.swallow = 'session.start'
  assert.deepEqual(await start('session.start', { session: { id: 'obe' } }, { wanted: () => true }), { logId: 1 })
})

test('on pages that are not the app, a remembered helmet is only reached for when a session is on it', async () => {
  const h = await connected1(fakeHelmet())
  const idle = store.get('godhelmet-link')
  await start('session.start', { session: { id: 'obe', name: 'OBE' } })
  await until('running', () => device.status.state === 'running')
  const running = store.get('godhelmet-link')
  disconnect()
  transports.ble = h.opener
  store.set('godhelmet-link', idle)
  const opens = h.opens.length
  assert.equal(restore({ sessionOnly: true }), false)
  assert.deepEqual([device.link, h.opens.length], ['none', opens])
  store.set('godhelmet-link', running)
  assert.equal(restore({ sessionOnly: true }), true)
  await until('the reconnect', () => device.link === 'connected')
  assert.equal(device.event.type, 'running')
})
