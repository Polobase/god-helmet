// Demo helmet: implements the firmware's protocol in the browser with the JS
// engine, so the app can be explored without hardware. Mirrors
// firmware/src/{rpc,sequencer,experiment,logbook}.cpp; state persists in
// localStorage.
import { parseSession, SessionRunner, render, maxFieldUT, maxCurrentMA } from '../engine/session.js'
import { patternDefaults } from '../engine/patterns.js'
import { spatialDefaults } from '../engine/spatial.js'
import { randomBelow, randomHex, sha256Hex } from '../lib/crypto.js'

const STORE = 'godhelmet-demo-v1'
const MIN_INTERVAL_S = 72 * 3600

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE)) ?? null
  } catch {
    return null
  }
}

function freshState() {
  return {
    settings: {
      uTperMA: new Array(8).fill(0.73), calibrated: false, seriesOhm: 2200, coilOhm: 4.2, vFullScale: 10,
      dacGain2x: true, dacBufferedRef: false, maxFieldUT: 5, defaultFieldUT: 1, longitudeDeg: 0,
      keepaliveS: 0, bleName: '', lastSessionEpoch: 0, safetyAccepted: false,
    },
    log: [],
    trials: [],
    nextLog: 1,
    nextTrial: 1,
    env: { kpValid: false, kp: 0, ap: -1, kpEpoch: 0, kpSource: '' },
  }
}

const nowS = () => Math.floor(Date.now() / 1000)

function lstHours(unixS, lon) {
  const d = unixS / 86400 + 2440587.5 - 2451545.0
  const h = (18.697374558 + 24.06570982441908 * d + lon / 15) % 24
  return h < 0 ? h + 24 : h
}

export function openDemo({ onStatus }) {
  const state = load() ?? freshState()
  const save = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify(state))
    } catch {
      /* private mode: demo state stays in memory */
    }
  }
  const runner = new SessionRunner()
  let active = null // { session, fieldUT, sham, blind, test, logId, stopReason }
  let lastStopReason = ''
  let levels = new Array(8).fill(0)
  let lastTick = performance.now()
  let lastStatus = 0

  const env = () => ({ timeValid: true, epoch: nowS(), lst: lstHours(nowS(), state.settings.longitudeDeg), longitude: state.settings.longitudeDeg, ...state.env })
  const minUT = () => Math.min(...state.settings.uTperMA)
  const clampField = (uT) => Math.min(uT > 0 ? uT : state.settings.defaultFieldUT, state.settings.maxFieldUT)

  function status() {
    const f = runner.frame ?? { running: false }
    const ph = active && f.running ? active.session.phases[f.phase] : null
    const s = {
      state: active ? (runner.stopping ? 'stopping' : 'running') : 'idle',
      armed: !!active, blind: !!active?.blind, test: !!active?.test, logId: active?.logId ?? 0,
      sessionId: active?.session.id ?? '', sessionName: active?.session.name ?? '', phaseName: ph?.name ?? '',
      phase: f.phase ?? 0, phaseCount: active?.session.phases.length ?? 0,
      elapsedMs: Math.round(f.elapsedMs ?? 0), programMs: Math.round(f.programMs ?? 0), totalMs: active?.session.totalMs ?? 0,
      phaseMs: Math.round(f.phaseMs ?? 0), phaseDurationMs: ph?.durationMs ?? 0, envelope: f.envelope ?? 0,
      fieldUT: active?.fieldUT ?? 0, testMA: active?.testMA ?? 0, overruns: 0, lastStopReason,
    }
    if (!s.blind) s.levels = levels.map((l) => Math.round(l * 100) / 100)
    return s
  }

  function finish(completed, reason) {
    const entry = state.log.find((e) => e.id === active.logId)
    if (entry) Object.assign(entry, { finished: true, completed, elapsedMs: Math.round(runner.frame.elapsedMs), reason })
    lastStopReason = reason
    active = null
    levels = new Array(8).fill(0)
    runner.abort()
    save()
  }

  const timer = setInterval(() => {
    const t = performance.now()
    const dt = t - lastTick
    lastTick = t
    if (active) {
      const f = runner.advance(dt)
      if (!f.running) finish(!runner.stopping, runner.stopping ? lastStopReason || 'stopped' : 'completed')
      else levels = active.sham ? new Array(8).fill(0) : render(active.session, f).map(Math.abs)
    }
    const interval = active ? 500 : 2000
    if (t - lastStatus >= interval) {
      lastStatus = t
      onStatus?.(status())
    }
  }, 40)

  function startAllowed() {
    if (!state.settings.safetyAccepted) throw new Error('accept the safety page in the app first')
    if (active) throw new Error('a session is already running')
  }

  function begin(session, { fieldUT, blind, sham, testMA = 0, presetId }) {
    let logId = 0
    if (!testMA) {
      logId = state.nextLog++
      state.log.unshift({
        id: logId, start: nowS(), presetId, presetName: session.name, blind, sham, test: false, fieldUT,
        plannedMs: session.totalMs, elapsedMs: 0, finished: false, completed: false, reason: '',
        kpValid: state.env.kpValid, kp: state.env.kp, ap: state.env.ap, kpSource: state.env.kpSource,
        lst: lstHours(nowS(), state.settings.longitudeDeg), rating: -1, notes: '', trialId: 0,
      })
      state.settings.lastSessionEpoch = nowS()
    }
    active = { session, fieldUT, blind, sham, test: !!testMA, testMA, logId }
    lastStopReason = ''
    runner.start(session)
    save()
    return logId
  }

  const publicLog = (e) => {
    const { sham, ...rest } = e
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
    }),
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
      save()
      return ops['settings.get']()
    },
    'session.start': ({ session: doc, presetId, fieldUT, blind = false }) => {
      startAllowed()
      const session = parseSession(doc)
      const sham = blind ? randomBelow(2) === 1 : session.id === 'sham'
      return { logId: begin(session, { fieldUT: clampField(fieldUT ?? doc.uT ?? 1), blind, sham, presetId: presetId ?? session.id }) }
    },
    'session.stop': () => {
      if (active && runner.running) {
        runner.requestStop()
        lastStopReason = 'stopped from app'
      }
      return null
    },
    'session.skip': () => {
      runner.skipPhase()
      if (runner.stopping && !lastStopReason) lastStopReason = 'skipped past last phase'
      return null
    },
    'session.field': ({ fieldUT }) => {
      if (active && !active.test) active.fieldUT = clampField(fieldUT)
      return null
    },
    test: ({ mode = 'dc', channel = 0, mA = 1, seconds = 30, layout = 'temporal', dir = 'ccw', dwellMs = 1000 }) => {
      startAllowed()
      if (!mA || Math.abs(mA) > 4.6) throw new Error('mA must be non-zero, |mA| <= 4.6')
      const spatial = { ...spatialDefaults() }
      if (mode === 'dc') Object.assign(spatial, { mode: 'single', channel })
      else Object.assign(spatial, { mode: 'rotate', ccw: dir !== 'cw', dwellStartMs: dwellMs, dwellEndMs: dwellMs })
      const session = { id: `test-${mode}`, name: mode === 'dc' ? `DC test CH${channel + 1} ${mA} mA` : `Slow rotation test ${mA} mA`, layout,
        fadeInMs: 500, fadeOutMs: 500, phases: [{ name: mode === 'dc' ? `DC CH${channel + 1}` : 'Rotate', durationMs: seconds * 1000, level: 1, crossfade: false, pattern: patternDefaults('dc'), spatial }], totalMs: seconds * 1000 }
      begin(session, { fieldUT: 0, blind: false, sham: false, testMA: mA, presetId: session.id })
      return { logId: 0 }
    },
    'log.list': ({ offset = 0, limit = 10 }) => ({ total: state.log.length, items: state.log.slice(offset, offset + Math.min(limit, 10)).map(publicLog) }),
    'log.rate': ({ id, rating, notes = '' }) => {
      const e = state.log.find((x) => x.id === id)
      if (!e) throw new Error('log entry not found')
      if (!(rating >= 0 && rating <= 10)) throw new Error('rating must be 0..10')
      Object.assign(e, { rating, notes: notes.slice(0, 2000) })
      save()
      return { ...publicLog(e), condition: e.sham ? 'sham' : 'active' }
    },
    'trial.new': async ({ mode = 'rv', manifestHash, sets = [], session: doc, presetId, blind = true, fieldUT }) => {
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
      }
      t.commitment = await sha256Hex(preimage(t))
      if (session) {
        t.logId = begin(session, { fieldUT: clampField(fieldUT), blind: t.blind, sham: t.condition === 'sham', presetId: t.presetId })
        const entry = state.log.find((e) => e.id === t.logId)
        if (entry) entry.trialId = t.id
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
    'trial.list': ({ offset = 0, limit = 10 }) => ({ total: state.trials.length, items: state.trials.slice(offset, offset + Math.min(limit, 10)).map(publicTrial) }),
  }

  async function call(op, params = {}) {
    const fn = ops[op]
    if (!fn) throw new Error(`unknown op: ${op}`)
    // Round-trip through JSON so the demo behaves like the real transport.
    const result = await fn(JSON.parse(JSON.stringify(params)))
    return result === undefined ? null : JSON.parse(JSON.stringify(result))
  }

  return {
    kind: 'demo',
    name: 'Demo helmet',
    call,
    close: () => clearInterval(timer),
    reset: () => {
      Object.assign(state, freshState())
      save()
    },
  }
}
