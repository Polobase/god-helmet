// Demo helmet: implements the firmware's protocol in the browser with the JS
// engine, so the app can be explored without hardware. Mirrors
// firmware/src/{rpc,sequencer,experiment,logbook}.cpp; state persists in
// localStorage.
//
// Like a real helmet it runs by itself. The helmet lives at module level and
// a transport is only a link to it: when the link drops the session runs on,
// and a page reload finds it again (what is needed to continue from the clock
// is in the stored state; a session whose planned end has passed while the
// page was closed is closed as completed).
//
// Test hooks, for the end-to-end tests and for trying by hand in the browser
// console what the app does when the connection fails. `window.__helmetDemo`
// exists from the moment the demo is connected until it is disconnected with
// the app's Disconnect button (so also while its link is down):
//   drop(ms = 0)        the link drops as if the helmet went out of range; the
//                       helmet keeps running and cannot be reached for `ms` ms
//                       (Infinity: until comeBack())
//   comeBack()          the helmet can be reached again
//   dropAfter(op)       the next `op` request reaches the helmet, but the link
//                       drops before its reply arrives
//   dropBefore(op, ms = 0)
//                       the link drops as the next `op` request is sent: it
//                       never reaches the helmet, which cannot be reached for
//                       `ms` ms
//   restart({ keepLink = false })
//                       the helmet restarts: a running session ends, there is
//                       a new bootId, the log entry is closed with the reason
//                       "restart: software restart" and hello.recoveredLogId
//                       names it. The link drops, as over Bluetooth; with
//                       keepLink it stays and the start-up line arrives, as
//                       over a USB bridge.
//   pressStop()         the STOP button on the helmet
//   mute(ms)            the helmet neither answers nor sends status for `ms`
//                       ms, without the link dropping (a board that hangs)
//   legacy(on = true)   behave like firmware without the reconnect fields
//                       (helmetId, bootId, tokens, ...); also switched on by
//                       localStorage 'godhelmet-demo-legacy' = '1'
//   state()             a copy of what the helmet knows
import { parseSession, SessionRunner, render, maxFieldUT, maxCurrentMA, STOP_FADE_MS } from '../engine/session.js'
import { patternDefaults } from '../engine/patterns.js'
import { spatialDefaults } from '../engine/spatial.js'
import { randomBelow, randomHex, sha256Hex } from '../lib/crypto.js'
import { linkError } from './link.js'

const STORE = 'godhelmet-demo-v1'
const LEGACY_FLAG = 'godhelmet-demo-legacy'
const MIN_INTERVAL_S = 72 * 3600
const MAX_REQUEST = 96 * 1024
const TOKEN = /^[A-Za-z0-9_-]{1,24}$/
const LOST = 'The connection to the demo helmet was lost.'
/** The demo's fixed id (a real helmet's is its chip's MAC address). */
export const DEMO_HELMET_ID = 'DE3000000001'

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE)) ?? null
  } catch {
    return null
  }
}

// A start of the helmet: a new boot id, and nothing known about earlier sessions.
const boot = (resetReason, recoveredLogId = 0) => ({ bootId: 1 + randomBelow(2 ** 31 - 1), bootMs: Date.now(), resetReason, recoveredLogId, last: null, active: null, appSeenMs: 0 })

function freshState() {
  return {
    settings: {
      uTperMA: new Array(8).fill(1.8), calibrated: false, seriesOhm: 2200, coilOhm: 4.2, vFullScale: 10,
      dacGain2x: true, dacBufferedRef: false, maxFieldUT: 5, defaultFieldUT: 1, longitudeDeg: 0,
      keepaliveS: 0, bleName: '', lastSessionEpoch: 0, safetyAccepted: false,
    },
    log: [],
    trials: [],
    nextLog: 1,
    nextTrial: 1,
    env: { kpValid: false, kp: 0, ap: -1, kpEpoch: 0, kpSource: '' },
    ...boot('power-on'),
  }
}

const nowS = () => Math.floor(Date.now() / 1000)

function lstHours(unixS, lon) {
  const d = unixS / 86400 + 2440587.5 - 2451545.0
  const h = (18.697374558 + 24.06570982441908 * d + lon / 15) % 24
  return h < 0 ? h + 24 : h
}

// 0 (off) or 5..3600 s, as the firmware clamps it.
function clampKeepalive(seconds) {
  if (!(seconds >= 1)) return 0
  return Math.floor(Math.min(3600, Math.max(5, seconds)))
}

function testSession({ mode = 'dc', channel = 0, mA = 1, seconds = 30, layout = 'temporal', dir = 'ccw', dwellMs = 1000 }) {
  const spatial = { ...spatialDefaults() }
  if (mode === 'dc') Object.assign(spatial, { mode: 'single', channel })
  else if (mode === 'dcall') Object.assign(spatial, { mode: 'bilateral' })
  else Object.assign(spatial, { mode: 'rotate', ccw: dir !== 'cw', dwellStartMs: dwellMs, dwellEndMs: dwellMs })
  const NAME = { dc: [`DC test CH${channel + 1} ${mA} mA`, `DC CH${channel + 1}`], dcall: [`DC test all 8 outputs ${mA} mA`, 'DC all'] }
  const [name, phaseName] = NAME[mode] ?? [`Slow rotation test ${mA} mA`, 'Rotate']
  return { id: mode === 'dcall' ? 'test-dc-all' : `test-${mode}`, name, layout,
    fadeInMs: 500, fadeOutMs: 500, phases: [{ name: phaseName, durationMs: seconds * 1000, level: 1, crossfade: false, pattern: patternDefaults('dc'), spatial }], totalMs: seconds * 1000 }
}

// The session a start request describes (the stored request rebuilds it after a reload).
const buildSession = (op, params) => (op === 'test' ? testSession(params) : parseSession(params.session))

function createHelmet() {
  const state = load() ?? freshState()
  if (!state.bootId) Object.assign(state, boot('power-on')) // stored by an older version of the app
  const save = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify(state))
    } catch {
      /* private mode: demo state stays in memory */
    }
  }
  const runner = new SessionRunner()
  const links = new Set() // the apps connected now
  let active = null // { session, fieldUT, sham, blind, test, testMA, logId, fieldChanges, skips }
  let lastStopReason = state.last?.stopReason ?? ''
  let levels = new Array(8).fill(0)
  let lastTick = performance.now()
  let lastStatus = 0
  let lastSeenSave = 0
  let timer = null
  let legacy = false
  let unreachableUntil = 0
  let mutedUntil = 0
  let loseAfter = ''
  let loseBefore = null // { op, ms }

  const env = () => ({ timeValid: true, epoch: nowS(), lst: lstHours(nowS(), state.settings.longitudeDeg), longitude: state.settings.longitudeDeg, ...state.env })
  const minUT = () => Math.min(...state.settings.uTperMA)
  const clampField = (uT) => Math.min(uT > 0 ? uT : state.settings.defaultFieldUT, state.settings.maxFieldUT)
  const muted = () => Date.now() < mutedUntil

  function status() {
    const f = runner.frame ?? { running: false }
    const ph = active && f.running ? active.session.phases[f.phase] : null
    // Which session it is stays in the status after it ends, until the next start.
    const last = state.last
    const s = {
      state: active ? (runner.stopping ? 'stopping' : 'running') : 'idle',
      armed: !!active, blind: !!active?.blind, test: !!active?.test, logId: last?.logId ?? 0,
      sessionId: last?.sessionId ?? '', sessionName: last?.sessionName ?? '', phaseName: ph?.name ?? '',
      phase: f.phase ?? 0, phaseCount: last?.phaseCount ?? 0,
      elapsedMs: Math.round(f.elapsedMs ?? 0), programMs: Math.round(f.programMs ?? 0), totalMs: last?.totalMs ?? 0,
      phaseMs: Math.round(f.phaseMs ?? 0), phaseDurationMs: ph?.durationMs ?? 0, envelope: active ? f.envelope ?? 0 : 0,
      fieldUT: last?.fieldUT ?? 0, testMA: active?.testMA ?? 0, overruns: 0, lastStopReason,
    }
    if (!legacy) Object.assign(s, { bootId: state.bootId, token: last?.token ?? '', presetId: last?.presetId ?? '', startEpoch: last?.startEpoch ?? 0, trialId: last?.trialId ?? 0 })
    if (!s.blind) s.levels = levels.map((l) => Math.round(l * 100) / 100)
    return s
  }

  function idle() {
    active = null
    state.active = null
    levels = new Array(8).fill(0)
    runner.abort()
  }

  function finish(completed, reason, elapsedMs = Math.round(runner.frame.elapsedMs)) {
    const entry = state.log.find((e) => e.id === active.logId)
    if (entry) Object.assign(entry, { finished: true, completed, elapsedMs, reason, finalFieldUT: active.fieldUT, fieldChanges: active.fieldChanges, skips: active.skips })
    lastStopReason = reason
    if (state.last) state.last.stopReason = reason
    idle()
    lastStatus = 0 // the firmware publishes the end at once
    save()
  }

  function requestStop(reason) {
    if (!active || !runner.running || runner.stopping) return
    runner.requestStop()
    lastStopReason = reason
    if (state.active) state.active.stop = { atMs: Math.round(runner.elapsedMs), reason }
    save()
  }

  function tick() {
    const t = performance.now()
    const dt = t - lastTick
    lastTick = t
    const now = Date.now()
    if (active) {
      // The app is present while a link is up (the firmware: an app subscribed to status, or a request over USB).
      if (links.size && !muted()) {
        state.appSeenMs = now
        if (state.settings.keepaliveS > 0 && now - lastSeenSave > 2000) {
          lastSeenSave = now
          save()
        }
      } else if (state.settings.keepaliveS > 0 && now - state.appSeenMs > state.settings.keepaliveS * 1000) requestStop('UI keepalive lost')
      const f = runner.advance(dt)
      if (!f.running) finish(!runner.stopping, runner.stopping ? lastStopReason || 'stopped' : 'completed')
      else levels = active.sham ? new Array(8).fill(0) : render(active.session, f).map(Math.abs)
    }
    const interval = active ? 500 : 2000
    if (t - lastStatus >= interval && !muted()) {
      lastStatus = t
      const s = status()
      for (const link of [...links]) link.handlers.onStatus?.(s)
    }
    if (!active && !links.size) stopTimer()
  }
  // The helmet's clock runs while a session does or an app is connected.
  function startTimer() {
    if (timer) return
    lastTick = performance.now()
    timer = setInterval(tick, 40)
    timer.unref?.() // Node (the tests): do not keep the process alive
  }
  function stopTimer() {
    clearInterval(timer)
    timer = null
  }

  // After a reload: the session that was running when the page went away.
  function resume() {
    const a = state.active
    if (!a) return
    let session
    try {
      session = buildSession(a.op, a.params)
    } catch {
      state.active = null
      return save()
    }
    const now = Date.now()
    const elapsed = Math.max(0, now - a.startMs)
    active = { session, fieldUT: a.fieldUT, blind: a.blind, sham: a.sham, test: !!a.testMA, testMA: a.testMA, logId: a.logId, fieldChanges: a.fieldChanges ?? 0, skips: a.skips ?? 0 }
    runner.start(session)
    const planned = session.totalMs - a.skipMs // the elapsed time at which the program is over
    const keepalive = state.settings.keepaliveS
    if (a.stop) return finish(false, a.stop.reason, Math.round(Math.min(elapsed, a.stop.atMs + STOP_FADE_MS)))
    // With the keepalive on, the helmet stopped when the app had been gone that long.
    const cut = keepalive > 0 && state.appSeenMs ? state.appSeenMs + keepalive * 1000 - a.startMs : Infinity
    if (cut < planned && cut <= elapsed) return finish(false, 'UI keepalive lost', Math.round(Math.min(elapsed, cut + STOP_FADE_MS)))
    if (elapsed >= planned) return finish(true, 'completed', Math.round(planned))
    runner.programMs = elapsed + a.skipMs
    runner.elapsedMs = elapsed
    runner.update()
    state.appSeenMs = now
    lastStopReason = ''
    startTimer()
  }

  function startAllowed() {
    if (!state.settings.safetyAccepted) throw new Error('accept the safety page in the app first')
    if (active) throw new Error('a session is already running')
  }

  // A start carries a token of the app's choosing; the same token again means
  // the reply to the first one got lost, and nothing is started twice.
  function checkToken(token) {
    if (legacy || token === undefined) return ''
    if (typeof token !== 'string' || !TOKEN.test(token)) throw new Error('token must be 1-24 characters from A-Z a-z 0-9 _ -')
    return token
  }
  const repeated = (token) => (token && state.last?.token === token ? state.last : null)

  function begin(session, { fieldUT, blind, sham, testMA = 0, presetId, token = '', trialId = 0 }, origin) {
    let logId = 0
    const startEpoch = nowS()
    if (!testMA) {
      logId = state.nextLog++
      state.log.unshift({
        id: logId, start: startEpoch, presetId, presetName: session.name, blind, sham, test: false, fieldUT,
        plannedMs: session.totalMs, elapsedMs: 0, finished: false, completed: false, reason: '',
        kpValid: state.env.kpValid, kp: state.env.kp, ap: state.env.ap, kpSource: state.env.kpSource,
        lst: lstHours(startEpoch, state.settings.longitudeDeg), rating: -1, notes: '', trialId,
        token, finalFieldUT: fieldUT, fieldChanges: 0, skips: 0,
      })
      state.settings.lastSessionEpoch = startEpoch
    }
    active = { session, fieldUT, blind, sham, test: !!testMA, testMA, logId, fieldChanges: 0, skips: 0 }
    state.last = { token, logId, trialId, presetId, startEpoch, sessionId: session.id, sessionName: session.name, phaseCount: session.phases.length, totalMs: session.totalMs, fieldUT, stopReason: '' }
    state.active = { ...origin, fieldUT, blind, sham, testMA, logId, startMs: Date.now(), skipMs: 0, stop: null, fieldChanges: 0, skips: 0 }
    state.appSeenMs = Date.now()
    lastStopReason = ''
    runner.start(session)
    startTimer()
    save()
    return logId
  }

  const NEW_LOG_FIELDS = ['token', 'finalFieldUT', 'fieldChanges', 'skips']
  const publicLog = (e) => {
    const { sham, ...rest } = e
    if (legacy) for (const k of NEW_LOG_FIELDS) delete rest[k]
    return { ...rest, condition: e.blind && e.rating < 0 ? 'hidden' : sham ? 'sham' : 'active' }
  }

  function preimage(t) {
    return `godhelmet-trial|id=${t.id}|manifest=${t.manifestHash}|set=${t.set}|target=${t.target}|condition=${t.condition}|nonce=${t.nonce}`
  }

  function publicTrial(t) {
    const show = t.state === 'revealed'
    const out = {
      id: t.id, mode: t.mode, state: t.state, created: t.created, presetId: t.presetId, presetName: t.presetName,
      blind: t.blind, manifestHash: t.manifestHash, setCount: t.setCount, commitment: t.commitment,
      responseHash: t.responseHash, lockedAt: t.lockedAt, kpValid: t.kpValid, kp: t.kp, ap: t.ap, lst: t.lst,
      logId: t.logId, ranked: t.ranked,
    }
    if (show || t.state === 'judging') Object.assign(out, { set: t.set, setSize: t.setSize, order: t.order })
    if (t.ranked) out.ranks = t.ranks
    if (show) Object.assign(out, { condition: t.condition, target: t.target, nonce: t.nonce, preimage: preimage(t), targetRank: t.targetRank, revealedAt: t.revealedAt })
    else out.condition = t.blind ? 'hidden' : t.condition
    return out
  }

  const trial = (id) => {
    const t = state.trials.find((x) => x.id === id)
    if (!t) throw new Error('trial not found')
    return t
  }

  const ops = {
    hello: () => ({
      firmware: 'demo', protocol: 1, board: 'Demo (browser)', calibrated: state.settings.calibrated,
      safetyAccepted: state.settings.safetyAccepted, maxReachableUT: maxFieldUT(minUT(), state.settings),
      maxFieldUT: state.settings.maxFieldUT, defaultFieldUT: state.settings.defaultFieldUT,
      lastSessionEpoch: state.settings.lastSessionEpoch, minIntervalS: MIN_INTERVAL_S, freeHeap: 0, fsUsed: 0, fsTotal: 0, env: env(),
      ...(legacy ? {} : {
        helmetId: DEMO_HELMET_ID, bootId: state.bootId, uptimeS: Math.max(0, Math.round((Date.now() - state.bootMs) / 1000)),
        resetReason: state.resetReason, recoveredLogId: state.recoveredLogId,
      }),
    }),
    status: () => status(),
    'time.set': () => env(),
    'env.set': ({ kp, ap = -1, source = 'manual' }) => {
      if (!(kp >= 0 && kp <= 9)) throw new Error('Kp must be 0..9')
      state.env = { kpValid: true, kp, ap, kpEpoch: nowS(), kpSource: source }
      save()
      return env()
    },
    'settings.get': () => ({ ...state.settings, maxCurrentMA: maxCurrentMA(state.settings) }),
    'settings.set': (p) => {
      if (active) throw new Error('stop the session before changing settings')
      if (p.seriesOhm !== undefined && (p.seriesOhm < 470 || p.seriesOhm > 100000)) throw new Error('seriesOhm must be 470..100000 (never drive coils without a series resistor)')
      if (p.maxFieldUT !== undefined && !(p.maxFieldUT > 0 && p.maxFieldUT <= 10)) throw new Error('maxFieldUT must be 0..10')
      for (const k of Object.keys(state.settings)) if (p[k] !== undefined) state.settings[k] = p[k]
      if (!legacy) state.settings.keepaliveS = clampKeepalive(Number(state.settings.keepaliveS))
      save()
      return ops['settings.get']()
    },
    'session.start': ({ session: doc, presetId, fieldUT, blind = false, token: sent }) => {
      const token = checkToken(sent)
      if (repeated(token)) return { logId: state.last.logId, already: true }
      startAllowed()
      const session = parseSession(doc)
      const sham = blind ? randomBelow(2) === 1 : session.id === 'sham'
      const params = { session: doc, presetId, fieldUT, blind }
      return { logId: begin(session, { fieldUT: clampField(fieldUT ?? doc.uT ?? 1), blind, sham, presetId: presetId ?? session.id, token }, { op: 'session.start', params }) }
    },
    'session.stop': () => {
      requestStop('stopped from app')
      return null
    },
    'session.skip': () => {
      const was = runner.frame?.phase
      const live = active && runner.running && !runner.stopping
      runner.skipPhase()
      if (live && runner.stopping) {
        if (!lastStopReason) lastStopReason = 'skipped past last phase'
        if (state.active) state.active.stop = { atMs: Math.round(runner.elapsedMs), reason: lastStopReason }
      } else if (live && runner.frame.phase !== was) {
        active.skips++
        Object.assign(state.active, { skipMs: runner.programMs - runner.elapsedMs, skips: active.skips })
      }
      if (live) save()
      return null
    },
    'session.field': ({ fieldUT }) => {
      if (active && !active.test) {
        active.fieldUT = clampField(fieldUT)
        active.fieldChanges++
        Object.assign(state.active, { fieldUT: active.fieldUT, fieldChanges: active.fieldChanges })
        if (state.last) state.last.fieldUT = active.fieldUT
        save()
      }
      return null
    },
    test: (params) => {
      const token = checkToken(params.token)
      if (repeated(token)) return { logId: 0, already: true }
      startAllowed()
      const { mA = 1 } = params
      if (!mA || Math.abs(mA) > 4.6) throw new Error('mA must be non-zero, |mA| <= 4.6')
      const session = testSession(params)
      begin(session, { fieldUT: 0, blind: false, sham: false, testMA: mA, presetId: session.id, token }, { op: 'test', params })
      return { logId: 0 }
    },
    'log.list': ({ offset = 0, limit = 10 }) => ({ total: state.log.length, items: state.log.slice(offset, offset + Math.min(limit, 10)).map(publicLog) }),
    'log.rate': ({ id, rating, notes = '' }) => {
      const e = state.log.find((x) => x.id === id)
      if (!e) throw new Error('log entry not found')
      if (active && active.logId === id) throw new Error('rate after the session ends')
      const trial = e.trialId ? state.trials.find((t) => t.id === e.trialId) : null
      if (trial && !['revealed', 'aborted'].includes(trial.state)) throw new Error('rate after the trial is revealed')
      if (!(rating >= 0 && rating <= 10)) throw new Error('rating must be 0..10')
      Object.assign(e, { rating, notes: notes.slice(0, 2000) })
      save()
      return { ...publicLog(e), condition: e.sham ? 'sham' : 'active' }
    },
    'trial.new': async ({ mode = 'rv', manifestHash, sets = [], session: doc, presetId, blind = true, fieldUT, token: sent }) => {
      const token = checkToken(sent)
      // (A trial without a session has no session to compare the token with: the trial keeps it.)
      const again = token ? state.trials.find((x) => x.token === token && x.bootId === state.bootId) : null
      if (again) return { ...publicTrial(again), already: true }
      if (!['rv', 'telepathy'].includes(mode)) throw new Error('mode must be rv or telepathy')
      if (!/^[0-9a-f]{64}$/i.test(manifestHash ?? '')) throw new Error('manifestHash must be 64 hex characters')
      if (!sets.length || sets.some((s) => !/^[a-z0-9_-]{1,38}$/.test(s.id) || s.size < 2 || s.size > 8)) throw new Error('every set needs an id and 2-8 pictures')
      let session = null
      if (doc) {
        startAllowed()
        session = parseSession(doc)
      }
      const chosen = sets[randomBelow(sets.length)]
      const t = {
        id: state.nextTrial++, mode, state: 'open', created: nowS(), presetId: session ? presetId ?? session.id : '', presetName: session?.name ?? '',
        blind: session ? blind : false, condition: session ? (blind ? (randomBelow(2) ? 'active' : 'sham') : 'active') : 'none',
        manifestHash: manifestHash.toLowerCase(), setCount: sets.length, set: chosen.id, setSize: chosen.size, target: randomBelow(chosen.size),
        nonce: randomHex(16), responseHash: '', lockedAt: 0, kpValid: false, kp: 0, ap: -1, lst: -1,
        order: [...Array(chosen.size).keys()], ranks: [], ranked: false, targetRank: 0, revealedAt: 0, logId: 0,
        token, bootId: state.bootId,
      }
      t.commitment = await sha256Hex(preimage(t))
      if (session) {
        const params = { session: doc, presetId, fieldUT, blind }
        t.logId = begin(session, { fieldUT: clampField(fieldUT), blind: t.blind, sham: t.condition === 'sham', presetId: t.presetId, token, trialId: t.id }, { op: 'trial.new', params })
      }
      state.trials.unshift(t)
      save()
      return publicTrial(t)
    },
    'trial.lock': ({ id, responseHash }) => {
      const t = trial(id)
      if (t.state !== 'open') throw new Error('trial already locked')
      if (!/^[0-9a-f]{64}$/i.test(responseHash ?? '')) throw new Error('responseHash must be 64 hex characters')
      Object.assign(t, { state: 'locked', responseHash, lockedAt: nowS(), kpValid: state.env.kpValid, kp: state.env.kp, ap: state.env.ap, lst: lstHours(nowS(), state.settings.longitudeDeg) })
      save()
      return publicTrial(t)
    },
    'trial.judge': ({ id }) => {
      const t = trial(id)
      if (t.state === 'judging') return publicTrial(t)
      if (t.state !== 'locked') throw new Error('lock the response first')
      for (let i = t.setSize - 1; i > 0; i--) {
        const j = randomBelow(i + 1)
        ;[t.order[i], t.order[j]] = [t.order[j], t.order[i]]
      }
      t.state = 'judging'
      save()
      return publicTrial(t)
    },
    'trial.ranks': ({ id, ranks = [] }) => {
      const t = trial(id)
      if (t.state !== 'judging') throw new Error('trial is not in judging')
      if (ranks.length !== t.setSize || new Set(ranks).size !== t.setSize || ranks.some((r) => r < 1 || r > t.setSize)) throw new Error('ranks must be a permutation of 1..N')
      Object.assign(t, { ranks, ranked: true })
      save()
      return publicTrial(t)
    },
    'trial.reveal': ({ id }) => {
      const t = trial(id)
      if (t.state !== 'judging' || !t.ranked) throw new Error('rank all pictures before the reveal')
      t.targetRank = t.ranks[t.order.indexOf(t.target)]
      Object.assign(t, { state: 'revealed', revealedAt: nowS() })
      save()
      return publicTrial(t)
    },
    'trial.abort': ({ id }) => {
      const t = trial(id)
      if (t.state === 'revealed') throw new Error('trial already revealed')
      t.state = 'aborted'
      save()
      return null
    },
    'trial.sender': ({ id }) => {
      const t = trial(id)
      if (t.mode !== 'telepathy' || t.state !== 'open') throw new Error('sender view is only available while a telepathy trial is open')
      return { id: t.id, manifestHash: t.manifestHash, set: t.set, target: t.target }
    },
    'trial.get': ({ id }) => publicTrial(trial(id)),
    'rng.bytes': ({ n = 32 }) => {
      if (!(n >= 1 && n <= 256)) throw new Error('n must be 1..256')
      const bytes = crypto.getRandomValues(new Uint8Array(n))
      return { hex: [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''), source: 'webcrypto (demo)' }
    },
    'trial.list': ({ offset = 0, limit = 10 }) => ({ total: state.trials.length, items: state.trials.slice(offset, offset + Math.min(limit, 10)).map(publicTrial) }),
  }

  // ---------------------------------------------------------------- what can go wrong (the hooks)
  function dropLinks() {
    for (const link of [...links]) link.end(false)
  }

  // The helmet starts again: what was running is over, and it says so in its log.
  function restart(resetReason = 'software restart') {
    let recovered = 0
    if (active) {
      // Older firmware left the entry unfinished.
      const entry = legacy ? null : state.log.find((e) => e.id === active.logId)
      if (entry) {
        Object.assign(entry, { finished: true, completed: false, elapsedMs: Math.round(runner.frame.elapsedMs), reason: `restart: ${resetReason}`, finalFieldUT: active.fieldUT, fieldChanges: active.fieldChanges, skips: active.skips })
        recovered = entry.id
      }
      idle()
    }
    Object.assign(state, boot(resetReason, recovered))
    lastStopReason = ''
    save()
  }

  const hooks = {
    drop(ms = 0) {
      unreachableUntil = Date.now() + ms
      dropLinks()
    },
    comeBack() {
      unreachableUntil = 0
    },
    dropAfter(op) {
      loseAfter = op
    },
    dropBefore(op, ms = 0) {
      loseBefore = { op, ms }
    },
    restart({ keepLink = false } = {}) {
      restart()
      if (!keepLink) return dropLinks()
      for (const link of [...links]) link.handlers.onRestart?.()
    },
    pressStop() {
      if (active) finish(false, 'STOP button')
    },
    mute(ms) {
      mutedUntil = Date.now() + ms
    },
    legacy(on = true) {
      legacy = !!on
    },
    state: () => JSON.parse(JSON.stringify({ ...state, running: !!active, legacy })),
  }
  const showHooks = (on) => {
    if (typeof window === 'undefined') return
    if (on) window.__helmetDemo = hooks
    else if (window.__helmetDemo === hooks) delete window.__helmetDemo
  }

  // ---------------------------------------------------------------- a link to the helmet
  function attach(handlers, options) {
    if (Date.now() < unreachableUntil) throw linkError('timeout', 'The demo helmet is out of range.')
    if (options.legacy !== undefined) legacy = !!options.legacy
    else {
      try {
        if (localStorage.getItem(LEGACY_FLAG) === '1') legacy = true
      } catch {
        /* no storage: the option or the hook decides */
      }
    }
    const link = { handlers, open: true }
    link.end = (byUser) => {
      if (!link.open) return
      link.open = false
      links.delete(link)
      if (byUser) showHooks(links.size > 0)
      else handlers.onDisconnect?.({ reason: 'drop' })
    }
    links.add(link)
    showHooks(true)
    lastStatus = 0 // the first status follows at once
    startTimer()

    async function call(op, params = {}, timeoutMs = 20000) {
      if (!link.open) throw linkError('lost', LOST)
      if (loseBefore?.op === op) {
        unreachableUntil = Date.now() + loseBefore.ms
        loseBefore = null
        dropLinks()
        throw linkError('lost', LOST)
      }
      if (muted()) {
        await new Promise((resolve) => setTimeout(resolve, timeoutMs))
        throw linkError(link.open ? 'timeout' : 'lost', link.open ? `${op}: no answer from the helmet` : LOST)
      }
      const fn = ops[op]
      let result
      try {
        if (!fn) throw new Error(`unknown op: ${op}`)
        // Round-trip through JSON so the demo behaves like the real transport.
        const text = JSON.stringify(params)
        if (text.length > MAX_REQUEST) throw new Error('request too large (96 KB at most)')
        result = await fn(JSON.parse(text))
      } catch (e) {
        throw linkError('helmet', e.message)
      }
      if (loseAfter === op) {
        loseAfter = ''
        dropLinks()
      }
      if (!link.open) throw linkError('lost', LOST)
      return result === undefined ? null : JSON.parse(JSON.stringify(result))
    }

    return {
      kind: 'demo',
      name: 'Demo helmet',
      id: '',
      call,
      close: () => link.end(true),
      reset: () => {
        if (active) idle()
        lastStopReason = ''
        for (const k of Object.keys(state)) delete state[k]
        Object.assign(state, freshState())
        save()
      },
      hooks,
    }
  }

  resume()
  return { attach, stop: stopTimer }
}

// The demo helmet of this page.
let helmet = null

// Connects to the demo helmet and returns { kind, name, id, call, close, reset, hooks }.
// options.legacy: true = behave like firmware without the reconnect fields.
export function openDemo(handlers = {}, options = {}) {
  helmet ??= createHelmet()
  return helmet.attach(handlers, options)
}

// What a page reload does to the demo: the page's helmet object is gone, its
// stored state stays, and the next openDemo() continues from it. For tests.
export function unloadDemo() {
  helmet?.stop()
  helmet = null
}
