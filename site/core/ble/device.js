// Shared connection state for all views, and the link to the helmet: connecting,
// noticing that the link is gone, reconnecting by itself, and saying what
// happened on the helmet meanwhile. The helmet runs a session by itself; when
// the link drops, the app keeps what it knew and goes on showing it.
import { reactive } from 'vue'
import { openBluetooth, bluetoothAvailable } from './bluetooth.js'
import { openSerial, serialAvailable, onSerialPlugged } from './serial.js'
import { openDemo } from './demo.js'
import { linkError, noReply, droppedByHelmet } from './link.js'
import { fetchKp } from '../lib/noaa.js'
import { compactProgram } from '../engine/compact.js'

export const device = reactive({
  kind: null,          // 'ble' | 'usb' | 'demo' | null: the helmet in use, also while its link is down
  name: '',
  connecting: false,   // a connect the user asked for is under way
  info: null,          // "hello" data
  settings: null,
  status: null,        // live status (2 Hz while running); while the link is down, the last one known
  error: '',
  bluetooth: bluetoothAvailable(),
  serial: serialAvailable(),  // Web Serial: USB
  kp: null,            // { kp, ap, time } from NOAA
  kpAt: 0,             // when it was fetched (ms); older than three hours, it is fetched again
  testLayout: 'temporal', // layout to draw while a rotation test runs
  // 'none' | 'connecting' | 'connected' | 'lost' | 'reconnecting'. A lost link
  // keeps kind, name, info, settings and the last status; only Disconnect clears them.
  link: 'none',
  statusAt: 0,         // when `status` arrived (ms)
  stale: false,        // `status` is not live: the link is down, or the helmet has gone quiet
  ready: false,        // the first status after connecting is in: only now is it known whether a session runs
  lostAt: 0,           // when the link dropped (ms)
  lostWhy: '',         // 'drop' | 'silent' (the helmet stopped answering) | 'reload'
  gaveUp: false,       // the app stopped trying by itself; Reconnect still works
  needsChooser: false, // only the browser's chooser brings the helmet back: Reconnect opens it
  event: null,         // what the last reconnect found: { type: 'back' | 'running' | 'ended' | 'restarted' | 'other', ... }
  notice: null,        // the same in words: { tone: 'success' | 'warning' | 'info', text, at }
})

// ---------------------------------------------------------------- seams for the tests
/** How each kind of helmet is opened. */
export const transports = { ble: openBluetooth, usb: openSerial, demo: openDemo }
export const timing = {
  retryMs: [1000, 2000, 4000, 8000, 15000], // pauses before each attempt to reconnect; the last one repeats
  giveUpMs: 5 * 60000,      // then the app stops trying by itself
  openMs: 45000,            // an attempt to reconnect that has not come to an end by then is given up
  quietTries: 3,            // after a reload with no session to pick up: this many attempts, then quietly "not connected"
  watchMs: 1000,            // how often the app checks that status still arrives
  staleRunningMs: 4000,     // no status for this long (the helmet sends one every 0.5 s while running): ask
  staleIdleMs: 8000,        // (every 2 s while idle)
  probeMs: 5000,            // no answer to that either: the link is dead
  statusMs: 10000,
  noticeMs: 8000,           // "Reconnected…" stays this long
  kpMaxAgeMs: 3 * 3600000,  // NOAA's Kp is a three-hour value
  startRepeatMs: 2 * 60000, // a start whose reply got lost is sent again only this soon after it was pressed
  startWaitMs: 5 * 60000,
  restoreMaxAgeMs: 12 * 3600000,
  bootHelloMs: 1500,        // after the start-up line over USB: ask until the helmet answers,
  bootWaitMs: 20000,        // for this long
}
export const deps = { fetchKp }

// ---------------------------------------------------------------- what survives a reload
const MEMORY = 'godhelmet-link'

function readMemory() {
  try {
    return JSON.parse(localStorage.getItem(MEMORY)) ?? null
  } catch {
    return null
  }
}
function writeMemory(value) {
  try {
    if (value) localStorage.setItem(MEMORY, JSON.stringify(value))
    else localStorage.removeItem(MEMORY)
  } catch {
    /* private mode: a reload starts unconnected */
  }
}

let transport = null   // the open link; null while there is none
let conn = 0           // counts links: events of an older one are ignored
let linkId = ''        // how the browser knows the helmet (to reopen it without the chooser)
let prior = null       // what was known when the link dropped
let quiet = false      // reconnecting after a reload, with no session to pick up
let tries = 0
let triesSince = 0     // when the app began to try (ms): after timing.giveUpMs it stops by itself
let retryTimer = null
let unreported = null  // a reconnect whose report waits for the first status (firmware too old to be asked for it)
let noDevice = false   // the last attempt found no helmet to reopen without the chooser
let watchdog = null
let probing = false
let rebooting = false
let lastRemember = 0
let waiters = []       // starts that wait for the link to come back
let reported = null    // the event of the last reconnect (device.event is a reactive copy of it)

const isRunning = (s) => !!s && s.state !== 'idle'

/** Which helmet this is: its fixed id, or for firmware without one how it is reached and its name. */
export const helmetKey = (info = device.info, kind = device.kind, name = device.name) => (info?.helmetId ? `id:${info.helmetId}` : kind ? `${kind}:${name}` : '')

// The last connected helmet, and its session if one runs: after a reload the
// app shows it again and reconnects.
function remember() {
  lastRemember = Date.now()
  if (!device.kind) return
  writeMemory({
    at: lastRemember, kind: device.kind, name: device.name, id: linkId, key: helmetKey(),
    helmetId: device.info?.helmetId ?? '', bootId: device.info?.bootId ?? 0, info: device.info, settings: device.settings,
    status: isRunning(device.status) ? device.status : null, statusAt: device.statusAt,
  })
}

// ---------------------------------------------------------------- status
function gotStatus(s) {
  if (!s || typeof s !== 'object') return
  const was = isRunning(device.status)
  device.status = s
  device.statusAt = Date.now()
  device.stale = false
  device.ready = true
  if (was !== isRunning(s) || Date.now() - lastRemember > (isRunning(s) ? 5000 : 60000)) remember()
  if (unreported) {
    const { before, t } = unreported
    unreported = null
    if (transport === t) report(before, t)
  }
}

/**
 * The status as it probably is `ageMs` after it arrived: while the link is
 * down a session moves on by the clock. `estimated` marks it; `over` says its
 * planned end has passed. Only the session clock is certain: the status does
 * not say how long later phases are.
 */
export function estimateStatus(status, ageMs) {
  if (!isRunning(status) || !(ageMs > 0)) return status
  const programMs = Math.min(status.totalMs, status.programMs + ageMs)
  return {
    ...status,
    programMs,
    elapsedMs: status.elapsedMs + ageMs,
    phaseMs: Math.min(status.phaseDurationMs, status.phaseMs + ageMs),
    estimated: true,
    over: programMs >= status.totalMs || status.state === 'stopping',
  }
}

// No status for too long while the link looks fine: ask. No answer either, and
// the link is dead (a Bluetooth link the browser has not noticed yet, a board
// that hangs): treat it as lost.
function startWatchdog() {
  stopWatchdog()
  watchdog = setInterval(() => {
    const t = transport
    if (!t || device.link !== 'connected' || rebooting) return
    const age = Date.now() - device.statusAt
    if (age <= (isRunning(device.status) ? timing.staleRunningMs : timing.staleIdleMs)) return
    device.stale = true
    if (probing) return
    probing = true
    t.call('status', {}, timing.probeMs)
      .then((s) => transport === t && gotStatus(s), (e) => transport === t && noReply(e) && silent(t))
      .finally(() => (probing = false))
  }, timing.watchMs)
  watchdog.unref?.()
}
function stopWatchdog() {
  clearInterval(watchdog)
  watchdog = null
}
function silent(t) {
  dropped('silent')
  Promise.resolve().then(() => t.close()).catch(() => {})
}

// ---------------------------------------------------------------- words
const helmetName = (kind = device.kind, name = device.name) => (kind === 'demo' ? 'the demo helmet' : name || 'the helmet')
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const quoted = (s) => (s?.test ? 'The test' : s?.sessionName ? `“${s.sessionName}”` : 'The session')

/** Why a session ended, in words that follow "…ended: ". */
export function stopReasonText(reason, keepaliveS = 0) {
  const r = String(reason ?? '')
  if (!r) return ''
  if (r === 'completed') return 'it ran to its end'
  if (r === 'stopped from app') return 'it was stopped from an app'
  if (r === 'skipped past last phase') return 'its last phase was skipped'
  if (r === 'UI keepalive lost') return keepaliveS > 0 ? `the helmet stopped it after ${keepaliveS} s without the app` : 'the helmet stopped it because no app was connected'
  if (r.startsWith('STOP button')) return 'it was stopped with the helmet’s STOP button'
  if (r === 'STOP on screen') return 'it was stopped on the helmet’s screen'
  if (r === 'power lost') return 'the helmet lost power'
  if (r.startsWith('restart: ')) return `the helmet restarted (${r.slice(9)})`
  return `the helmet says “${r}”`
}

/**
 * One line about the link, or null: while it is down, what is known about the
 * session and what the app is doing; after it came back, what was found.
 */
export function linkNote(now = Date.now()) {
  if (device.link !== 'lost' && device.link !== 'reconnecting') return device.notice
  const name = helmetName()
  const s = device.status
  const Name = `${name[0].toUpperCase()}${name.slice(1)}`
  const reload = device.lostWhy === 'reload' // the page was reloaded: nothing was "lost", the link has to be made again
  const stuck = device.needsChooser || device.gaveUp
  const parts = []
  // What happened.
  if (device.lostWhy === 'silent') parts.push(`${Name} has stopped answering.`)
  else if (reload) parts.push(stuck ? `${Name} was connected before this page was reloaded.` : `Reconnecting to ${name}…`)
  else parts.push(device.kind === 'usb' ? 'USB connection to the helmet lost.' : `Connection to ${name} lost.`)
  // What the app does about it, or what it needs.
  if (device.needsChooser) parts.push('This browser cannot find it again by itself: press Reconnect and choose it.')
  else if (device.gaveUp) parts.push('The app has stopped trying: press Reconnect when the helmet is back in range.')
  // (Over USB the browser forgets some boards when they are unplugged: then only its chooser brings them back.)
  else if (!reload) parts.push(device.kind === 'usb' ? 'Plug the cable in again; if the app does not reconnect by itself, press Reconnect.' : 'Reconnecting…')
  // What the helmet does meanwhile.
  if (isRunning(s)) {
    const keepalive = Number(device.settings?.keepaliveS) || 0
    const awayS = (now - (device.lostAt || now)) / 1000
    if (estimateStatus(s, now - device.statusAt).over) parts.push(`${quoted(s)} should have ended by now.`)
    else if (keepalive > 0 && awayS > keepalive + 2) parts.push(`The helmet has stopped ${quoted(s).replace(/^The /, 'the ')} by now: it does so after ${keepalive} s without the app.`)
    else if (keepalive > 0) parts.push(`The helmet stops ${quoted(s).replace(/^The /, 'the ')} by itself after ${keepalive} s without the app.`)
    else if (device.settings) parts.push(`${quoted(s)} keeps running on the helmet; until the connection is back, only the helmet’s STOP button stops it.`)
    else parts.push(`${quoted(s)} may still be running on the helmet; only its STOP button stops it now.`)
  }
  return { tone: reload && !stuck ? 'info' : 'warning', text: parts.join(' '), lost: true, at: device.lostAt }
}

/** What a reconnect found, in words (`event` as assess() returns it, with the log entry once it is read). */
export function describeEvent(ev) {
  const what = quoted(ev.session)
  const at = ev.endedAt ? ` at ${clock(ev.endedAt)}` : ''
  if (ev.type === 'running') return { tone: 'success', text: `Reconnected. ${what} is still running.` }
  if (ev.type === 'ended') {
    const why = stopReasonText(ev.reason, ev.keepaliveS)
    return { tone: 'warning', text: `Reconnected. ${what} ended${at} while the connection was down${why ? `: ${why}` : ''}.${ev.another ? ' Another session is running now.' : ''}` }
  }
  if (ev.type === 'restarted') {
    const lostPower = ev.reason === 'power lost'
    const head = lostPower ? 'The helmet lost power and started again.' : `The helmet restarted${ev.resetReason ? ` (${ev.resetReason})` : ''}${ev.linkKept ? '' : ' while the connection was down'}.`
    if (!ev.session && !ev.logId) return { tone: 'warning', text: `${head} No session is running.` }
    const ran = !(ev.elapsedMs > 0) ? '' : ev.elapsedMs < 45000 ? ' after less than a minute' : ` after ${Math.round(ev.elapsedMs / 60000)} min`
    return { tone: 'warning', text: `${head} ${ev.session ? what : 'Its session'} ended${at}${ran}; it is in the Log.` }
  }
  if (ev.type === 'other') return { tone: 'warning', text: `This is another helmet (${helmetName(ev.kind, ev.name)}), not ${helmetName(ev.before.kind, ev.before.name)}.${ev.session ? ` ${what} was running on the other one.` : ''}` }
  return { tone: 'success', text: `Reconnected to ${helmetName(ev.kind, ev.name)}.` }
}

let noticeTimer = null
function say(note) {
  clearTimeout(noticeTimer)
  device.notice = note ? { ...note, at: Date.now() } : null
  // Good news goes away by itself; what has to be read stays until it is dismissed.
  if (note?.tone !== 'success') return
  noticeTimer = setTimeout(() => say(null), timing.noticeMs)
  noticeTimer.unref?.()
}
/** Takes the line about the last reconnect away. */
export const dismissNotice = () => say(null)

// ---------------------------------------------------------------- what happened meanwhile
// The same session? By its token where the helmet reports one, else by its log entry (tests have none) and program.
const sameSession = (a, b) => (a.token && b.token ? a.token === b.token : (a.logId ?? 0) === (b.logId ?? 0) && a.sessionId === b.sessionId)

/**
 * Compares what the helmet says about itself now with what was known when the
 * link dropped. `before`: { kind, name, helmetId, bootId, status }; `now`:
 * { kind, name, info, status, sawRestart (its start-up line was seen) }.
 */
export function assess(before, now) {
  const info = now.info ?? {}
  const base = { kind: now.kind, name: now.name, before: { kind: before.kind, name: before.name }, keepaliveS: Number(now.settings?.keepaliveS) || 0 }
  const had = isRunning(before.status) ? before.status : null
  const same = before.helmetId && info.helmetId ? before.helmetId === info.helmetId : before.kind === now.kind && before.name === now.name
  if (!same) return { ...base, type: 'other', session: had }
  const restarted = before.bootId && info.bootId ? before.bootId !== info.bootId : !!now.sawRestart
  if (restarted) return { ...base, type: 'restarted', session: had, resetReason: info.resetReason ?? '', logId: info.recoveredLogId || had?.logId || 0, linkKept: !!now.linkKept }
  if (!had) return { ...base, type: 'back' }
  const st = now.status
  if (isRunning(st) && sameSession(had, st)) return { ...base, type: 'running', session: st }
  // Firmware that names the session in its status says why that one ended; older firmware only why the last one did.
  const known = st && (st.token ? st.token === had.token : !isRunning(st))
  return { ...base, type: 'ended', session: had, logId: had.logId ?? 0, reason: known ? st.lastStopReason ?? '' : '', another: isRunning(st) }
}

// The log entry `id` of the connected helmet (newest first), within the first pages.
async function findLog(t, match, pages = 3) {
  for (let offset = 0; offset < pages * 10; offset += 10) {
    const page = await t.call('log.list', { offset, limit: 10 })
    const hit = page?.items?.find(match)
    if (hit) return hit
    if (!page?.items?.length || offset + page.items.length >= page.total) return null
  }
  return null
}

function report(before, t, extra = {}) {
  if (!before) {
    device.event = reported = null
    return say(null)
  }
  const ev = assess(before, { kind: t.kind, name: t.name, info: device.info, settings: device.settings, status: device.status, sawRestart: !!t.restarted, ...extra })
  device.event = reported = ev
  // Reconnecting after a reload with nothing to tell: no line at all.
  say(ev.type === 'back' && before.quiet ? null : describeEvent(ev))
  if (!['ended', 'restarted'].includes(ev.type) || !ev.logId) return
  // The log entry says when it ended, and why.
  findLog(t, (e) => e.id === ev.logId).then((entry) => {
    if (!entry || reported !== ev || transport !== t) return
    const full = { ...ev, reason: entry.reason || ev.reason || '', elapsedMs: entry.elapsedMs ?? 0, completed: !!entry.completed, endedAt: entry.start > 1e9 && entry.elapsedMs > 0 ? entry.start * 1000 + entry.elapsedMs : 0 }
    if (full.completed && !full.reason) full.reason = 'completed'
    device.event = reported = full
    say(describeEvent(full))
  }, () => {})
}

// ---------------------------------------------------------------- Kp
/**
 * NOAA's Kp, fetched again when the one at hand is older than three hours
 * (`force`: now). Rejects when NOAA cannot be reached: an old value is never
 * handed out as fresh.
 */
export async function freshKp(force = false) {
  if (force || !device.kp || Date.now() - device.kpAt > timing.kpMaxAgeMs) {
    const kp = await deps.fetchKp()
    device.kp = kp
    device.kpAt = Date.now()
  }
  return device.kp
}

async function syncKp(t) {
  try {
    const kp = await freshKp()
    const env = await t.call('env.set', { kp: kp.kp, ap: kp.ap, source: 'noaa' })
    if (transport === t && device.info && env) device.info.env = env
  } catch {
    /* offline: Kp can be entered by hand on the Helmet tab */
  }
}

// ---------------------------------------------------------------- connecting
function reset() {
  conn++
  transport = null
  prior = null
  unreported = null
  quiet = false
  cancelRetry()
  stopWatchdog()
  Object.assign(device, { kind: null, name: '', info: null, settings: null, status: null, statusAt: 0, stale: false, ready: false, link: 'none', lostAt: 0, lostWhy: '', gaveUp: false, needsChooser: false, event: null, notice: null })
  failWaiters(linkError('lost', 'The helmet was disconnected.'))
  writeMemory(null)
}

// After every connect: the clock, who the helmet is, its settings, then its
// status straight away (not with the first push: until it is in, the app does
// not know whether a session runs), then Kp.
async function attach(t, my, box) {
  await t.call('time.set', { epochMs: Date.now() })
  const info = await t.call('hello')
  const settings = await t.call('settings.get')
  let status
  try {
    status = await t.call('status', {}, timing.statusMs)
  } catch (e) {
    // It may have pushed one meanwhile. Firmware too old to be asked sends its first one within 2 s.
    if (e.code === 'lost' || (!box.status && e.code !== 'helmet')) throw e
    status = box.status
  }
  if (my !== conn) throw linkError('lost', 'Another connection took over.')
  if (box.dropped) throw linkError('lost', 'The helmet disconnected while connecting.')
  const before = prior
  prior = null
  quiet = false
  transport = t
  linkId = t.id ?? ''
  box.live = true
  cancelRetry()
  // All at once: the views never see a helmet without its status.
  Object.assign(device, { kind: t.kind, name: t.name, info, settings, link: 'connected', lostAt: 0, lostWhy: '', gaveUp: false, needsChooser: false, error: '', ready: false })
  unreported = null
  if (status) {
    gotStatus(status)
    report(before, t)
  } else {
    // What happened meanwhile can only be said once the helmet's status is in.
    device.stale = true
    unreported = { before, t }
  }
  remember()
  startWatchdog()
  for (const w of waiters.splice(0)) w.resolve()
  // Kp last, and not part of connecting: it needs the network, which may be slow or gone.
  return { kp: syncKp(t) }
}

async function open(kind, options) {
  const my = ++conn
  const box = { live: false, status: null, dropped: false }
  const t = await (transports[kind] ?? transports.ble)({
    onStatus: (s) => {
      if (my !== conn) return
      if (box.live) gotStatus(s)
      else box.status = s
    },
    onDisconnect: (info) => {
      if (my !== conn) return
      if (box.live) dropped(info?.reason)
      else box.dropped = true // while the helmet was still being read: the attempt fails
    },
    // The board printed its start-up line: it restarted, and any session on it has ended.
    onRestart: () => my === conn && box.live && rebooted(t),
  }, options)
  try {
    if (my !== conn) throw linkError('lost', 'Another connection took over.')
    // Connected when this resolves; its `kp` settles when Kp has been sent too.
    return await attach(t, my, box)
  } catch (e) {
    if (!box.live) await Promise.resolve().then(() => t.close()).catch(() => {})
    throw e
  }
}

export async function connect(kind) {
  if (device.connecting || device.link === 'reconnecting') return
  if (device.link === 'connected') disconnect()
  cancelRetry()
  const wasLost = device.link === 'lost'
  device.error = ''
  device.connecting = true
  device.link = wasLost ? 'reconnecting' : 'connecting'
  let opened = null
  try {
    opened = await open(kind, {})
  } catch (e) {
    if (e.name !== 'NotFoundError') device.error = e.message // NotFoundError = chooser cancelled
    if (wasLost && device.kind) {
      device.link = 'lost' // the session stays on screen
      scheduleRetry()
    } else if (device.link !== 'connected') reset()
  } finally {
    device.connecting = false
  }
  await opened?.kp
}

export function disconnect() {
  const t = transport
  reset()
  t?.close()
}

// ---------------------------------------------------------------- losing the link, and getting it back
function dropped(why = 'drop') {
  if (!transport) return
  conn++
  transport = null
  stopWatchdog()
  prior = { kind: device.kind, name: device.name, helmetId: device.info?.helmetId ?? '', bootId: device.info?.bootId ?? 0, status: device.status }
  tries = 0
  triesSince = Date.now()
  Object.assign(device, { link: 'lost', lostAt: Date.now(), lostWhy: why, stale: true, ready: false, gaveUp: false, needsChooser: false, event: null, notice: null })
  remember()
  scheduleRetry()
}

function cancelRetry() {
  clearTimeout(retryTimer)
  retryTimer = null
}
function scheduleRetry() {
  cancelRetry()
  if (device.link !== 'lost' || device.gaveUp || device.needsChooser) return
  retryTimer = setTimeout(tryAgain, timing.retryMs[Math.min(tries, timing.retryMs.length - 1)])
  retryTimer.unref?.()
}

function failWaiters(error) {
  for (const w of waiters.splice(0)) w.reject(error)
}

// One attempt to reopen the same helmet without the browser's chooser.
async function tryAgain() {
  cancelRetry()
  if (device.link !== 'lost' || !device.kind) return
  device.link = 'reconnecting'
  tries++
  noDevice = false
  // How each transport knows its helmet again: Bluetooth by the browser's id for it and its name, USB by the board's USB ids.
  const known = device.kind === 'ble' ? { id: typeof linkId === 'string' ? linkId : '', name: device.name } : linkId || true
  let timer
  try {
    await Promise.race([
      open(device.kind, { known }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          conn++ // whatever that attempt still does is ignored, and its link closed
          reject(linkError('timeout', 'The helmet did not answer.'))
        }, timing.openMs)
        timer.unref?.()
      }),
    ])
  } catch (e) {
    if (device.link !== 'reconnecting') return // disconnected meanwhile
    device.link = 'lost'
    noDevice = e.code === 'no-device'
    // Over USB "no device" means not plugged in: keep looking. Over Bluetooth only the chooser helps.
    if (e.code === 'no-device' && device.kind !== 'usb') device.needsChooser = true
    if (quiet && (device.needsChooser || tries >= timing.quietTries)) return reset()
    if (!device.needsChooser && Date.now() - triesSince > timing.giveUpMs) device.gaveUp = true
    if (device.needsChooser || device.gaveUp) failWaiters(linkError('lost', 'The connection to the helmet did not come back.'))
    scheduleRetry()
  } finally {
    clearTimeout(timer)
  }
}

/** The Reconnect button: tries at once, and opens the browser's chooser where only that helps. */
export async function reconnect() {
  if (!device.kind || device.connecting || device.link === 'connected' || device.link === 'reconnecting') return
  cancelRetry()
  Object.assign(device, { gaveUp: false, error: '' })
  tries = 0
  triesSince = Date.now() // a fresh five minutes
  quiet = false
  if (!device.needsChooser) await tryAgain()
  // Nothing to reopen: the chooser. (Over USB too: the browser forgets a board
  // without a serial number, such as a CH340, when it is unplugged.)
  if (device.link === 'lost' && (device.needsChooser || noDevice)) {
    const needed = device.needsChooser
    device.needsChooser = false
    await connect(device.kind)
    if (device.link === 'lost' && needed) {
      cancelRetry()
      device.needsChooser = true
    }
  }
}

// At once when the page is looked at again, or the browser reports the board.
function wake() {
  if (device.link === 'lost' && device.kind && !device.needsChooser) tryAgain()
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && wake())
onSerialPlugged(() => device.kind === 'usb' && wake())

/**
 * After a page reload: the helmet that was connected, and its session if one
 * was running, are shown again as "connection lost", and the app reconnects
 * (without the chooser where the browser allows it). Returns whether there
 * was one to go back to. Safe to call again: it does nothing while a helmet
 * is in use.
 */
export function restore({ sessionOnly = false } = {}) {
  if (device.link !== 'none' || device.connecting) return false
  const m = readMemory()
  if (!m?.kind || !transports[m.kind] || Date.now() - (m.at ?? 0) > timing.restoreMaxAgeMs) return false
  const status = isRunning(m.status) ? m.status : null
  // A session whose planned end has passed is not shown as running; the reconnect still says how it ended.
  const shown = status && !estimateStatus(status, Date.now() - (m.statusAt ?? 0)).over ? status : null
  // (`sessionOnly`: on pages that are not the app, a helmet is only reached for when a session is on it.)
  if (sessionOnly && !shown) return false
  linkId = m.id ?? ''
  quiet = !shown
  prior = { kind: m.kind, name: m.name, helmetId: m.helmetId ?? '', bootId: m.bootId ?? 0, status, quiet: !status }
  tries = 0
  triesSince = Date.now()
  Object.assign(device, { kind: m.kind, name: m.name ?? '', info: m.info ?? null, settings: m.settings ?? null, status: shown, statusAt: m.statusAt ?? 0, stale: true, ready: false, link: 'lost', lostAt: Date.now(), lostWhy: 'reload', gaveUp: false, needsChooser: false })
  tryAgain()
  return true
}

// The start-up line over USB with the port still open: the helmet restarted.
// Its clock is gone and any session has ended: once it answers again, read it
// anew, send the clock and Kp again, and say what happened.
async function rebooted(t) {
  if (transport !== t || rebooting) return
  rebooting = true
  const before = { kind: device.kind, name: device.name, helmetId: device.info?.helmetId ?? '', bootId: device.info?.bootId ?? 0, status: device.status }
  Object.assign(device, { stale: true, ready: false })
  try {
    const until = Date.now() + timing.bootWaitMs
    for (;;) {
      try {
        await t.call('hello', {}, timing.bootHelloMs)
        break
      } catch (e) {
        if (transport !== t || e.code === 'lost') return // the link went too: its drop is dealt with
        if (Date.now() >= until) return silent(t)
        // (An answer that fails at once must not be asked for again without a pause.)
        if (e.code !== 'timeout') await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
    await t.call('time.set', { epochMs: Date.now() })
    const info = await t.call('hello')
    const settings = await t.call('settings.get')
    const status = await t.call('status', {}, timing.statusMs)
    if (transport !== t) return
    Object.assign(device, { info, settings })
    gotStatus(status)
    report(before, t, { sawRestart: true, linkKept: true })
    remember()
    await syncKp(t)
  } catch {
    if (transport === t) silent(t)
  } finally {
    rebooting = false
  }
}

// ---------------------------------------------------------------- requests
// Programs go to the helmet packed (engine/compact.js): every point table as
// one base64 string. Sent as lists of numbers, 87 of the programs are too
// large for an ESP32 to read. Firmware reads the packed form since 0.3.0 and
// so does the demo; older firmware gets the program as it is.
const atLeast = (version, min) => {
  const a = String(version ?? '').split('.').map(Number)
  const b = min.split('.').map(Number)
  for (let i = 0; i < b.length; i++) if ((a[i] || 0) !== b[i]) return (a[i] || 0) > b[i]
  return true
}
const readsPacked = () => device.kind === 'demo' || atLeast(device.info?.firmware, '0.3.0')
export function packed(op, params) {
  if ((op !== 'session.start' && op !== 'trial.new') || !params?.session || typeof params.session !== 'object' || !readsPacked()) return params
  return { ...params, session: compactProgram(params.session) }
}

export async function call(op, params, timeoutMs) {
  if (!transport) throw device.kind ? linkError('lost', 'The connection to the helmet is lost. This works again once it is back.') : new Error('Connect the helmet first (or use the demo).')
  return transport.call(op, packed(op, params), timeoutMs)
}

export async function refresh() {
  device.info = await call('hello')
  device.settings = await call('settings.get')
}

/** Asks for the status now instead of waiting for the next one (after a start or a stop). */
export async function readStatus() {
  const t = transport
  const s = await call('status', {}, timing.statusMs)
  if (transport === t) gotStatus(s)
  return s
}

// Resolves when the link is back; rejects when it will not be (Disconnect, given up, too late).
function whenBack(ms) {
  if (transport && device.link === 'connected') return Promise.resolve()
  if (!device.kind) return Promise.reject(linkError('lost', 'The helmet was disconnected.'))
  if (device.gaveUp || device.needsChooser) return Promise.reject(linkError('lost', 'The connection to the helmet is lost.'))
  return new Promise((resolve, reject) => {
    const w = {
      resolve: () => (clearTimeout(timer), resolve()),
      reject: (e) => (clearTimeout(timer), reject(e)),
    }
    const timer = setTimeout(() => {
      waiters = waiters.filter((x) => x !== w)
      reject(linkError('lost', 'The connection to the helmet did not come back in time.'))
    }, ms)
    timer.unref?.()
    waiters.push(w)
  })
}

const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
/** A new random token for a start (16 of the 64 characters the helmet accepts). */
export const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => TOKEN_CHARS[b & 63]).join('')

const NOT_STARTED = 'The helmet did not get the start before the connection failed, so nothing was started. Start again when you are ready.'

// A start whose reply did not arrive: find out what the helmet did with it.
async function recoverStart(op, params, token, sent, cause) {
  if (droppedByHelmet(cause)) await new Promise((resolve) => setTimeout(resolve, 500))
  else await whenBack(timing.startWaitMs)
  if (helmetKey() !== sent.key) throw new Error('Another helmet is connected now; nothing was started on it.')
  if (sent.bootId && device.info?.bootId && device.info.bootId !== sent.bootId) {
    throw new Error('The helmet restarted before it answered, and nothing is running on it. Start again when you are ready.')
  }
  const t = transport
  const st = await readStatus()
  const tokens = typeof st?.token === 'string' // the helmet names its session (older firmware does not)
  const found = async ({ logId = 0, trialId = 0, ended = false }) => {
    if (op === 'trial.new') return { ...(await t.call('trial.get', { id: trialId })), already: true }
    return { logId, already: true, ...(ended ? { ended: true } : {}) }
  }
  const again = () => {
    // Only soon after it was pressed: a field must not come on minutes later, unannounced.
    if (Date.now() - sent.at > timing.startRepeatMs) throw new Error(NOT_STARTED)
    // And only if it is still wanted (a guide's step may be over by now).
    if (sent.wanted && !sent.wanted()) throw linkError('unwanted', 'The start did not reach the helmet, and is not wanted any more: nothing was started.')
    return t.call(op, packed(op, { ...params, token }))
  }

  // Ours by the token: running, or ended since.
  if (tokens && st.token === token && (op !== 'trial.new' || st.trialId)) return found({ logId: st.logId, trialId: st.trialId, ended: !isRunning(st) })
  if (tokens && op !== 'test') {
    const entry = await findLog(t, (e) => e.token === token, 1)
    if (entry && (op !== 'trial.new' || entry.trialId)) return found({ logId: entry.id, trialId: entry.trialId, ended: true })
  }
  if (op === 'trial.new') {
    // A trial without a session is in neither: is the newest trial the one we asked for?
    const page = await t.call('trial.list', { offset: 0, limit: 10 })
    const mine = page?.items?.find((x) => x.state === 'open' && x.created >= sent.at / 1000 - 2 && x.manifestHash === String(params.manifestHash ?? '').toLowerCase() && x.mode === (params.mode ?? 'rv'))
    return mine ? { ...mine, already: true } : again()
  }
  // With tokens the same request again starts nothing twice.
  if (tokens) return again()

  // Older firmware: is what runs (or last ran) what we asked for?
  const wanted = params.session?.id ?? 'custom'
  if (isRunning(st)) {
    const fresh = st.elapsedMs <= Date.now() - sent.at + 5000
    if (fresh && (op === 'test' ? st.test : !st.test && st.sessionId === wanted)) return found({ logId: st.logId })
    throw new Error('Another session is running on the helmet.')
  }
  if (op === 'session.start') {
    // (The helmet's clock is the app's: it is set at every connect.)
    const entry = await findLog(t, (e) => e.start >= sent.at / 1000 - 2 && e.presetId === (params.presetId ?? wanted), 1)
    if (entry) return found({ logId: entry.id, ended: true })
  }
  return again()
}

/**
 * Starts something on the helmet: 'session.start', 'test' or 'trial.new'. The
 * request carries a fresh token; when its reply does not arrive (no answer, or
 * the link dropped), the app waits for the link, then asks the helmet whether
 * the session with that token is there, and only otherwise (and only soon
 * after) sends the same request once more. So nothing is started twice, and
 * nothing runs that the app does not know of. Resolves with the helmet's
 * reply, with `already: true` when the session was found rather than started
 * now. `options.token`: the token to use; `options.onWaiting(error)`: the
 * reply did not come and the app is finding out; `options.wanted()`: asked
 * before the request is sent a second time, false calls it off (the error
 * then has the code 'unwanted').
 */
export async function start(op, params = {}, options = {}) {
  const token = options.token ?? newToken()
  const sent = { at: Date.now(), key: helmetKey(), bootId: device.info?.bootId ?? 0, wanted: options.wanted }
  let reply
  try {
    reply = await call(op, { ...params, token })
  } catch (e) {
    if (!noReply(e) && !droppedByHelmet(e)) throw e
    options.onWaiting?.(e)
    reply = await recoverStart(op, params, token, sent, e)
  }
  readStatus().catch(() => {}) // show it at once, not with the next status
  return reply
}

export const connected = () => device.link === 'connected'
/** The link dropped and the helmet is not reachable now (the app may be trying to reconnect). */
export const linkLost = () => device.link === 'lost' || device.link === 'reconnecting'
// The highest intensity (µT at 20 mm) this helmet allows: its setting, and what its coils can reach.
export const maxFieldUT = () => Math.min(device.info?.maxFieldUT ?? 5, device.info?.maxReachableUT ?? 5)
export const running = () => !!device.status && device.status.state !== 'idle'
