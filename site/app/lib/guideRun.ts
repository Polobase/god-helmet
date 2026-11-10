// The run of a guide: its state, audio, timers, screen wake lock and helmet arm.
// All of it lives at module level, so a running guide carries on while another
// page or tab of the app is open; the runner component only shows it.
// Taken over from the old GuideRunner.vue with its logic unchanged.
import { reactive, watch, type InjectionKey } from 'vue'
import { AudioEngine as CoreAudioEngine } from '#core/audio/engine.js'
import { guideState } from '#core/lib/guideState.js'
import { randomBelow } from '#core/lib/crypto.js'
import { device, call, start, readStatus, newToken, freshKp, stopReasonText, errorMessage, STOP_ANSWER_MS, type DeviceStatus } from './device'
import { presetById } from './programs'
import { ratingElsewhere } from './rating'
import {
  MODES, guideHash, runId, saveRun, plain, stepDurationMs, armRange, hasAudio, stepHasAudio, sealInput, inputPending, lstHours,
  type AudioChoice, type AudioMode, type GuideDoc, type GuideStep, type InputValue, type RunEnv, type RunHelmet, type RunRecord, type RunStepRecord, type StepAudio, type Trial,
} from './guides'

/** What the run uses of the core's audio engine (webapp/src/audio/engine.js). */
interface Engine {
  /** 'suspended' while a step should be playing means the sound was cut off. */
  readonly state: 'idle' | 'running' | 'suspended'
  start(): Promise<unknown>
  setMode(mode: AudioMode): void
  setLevelDb(db: number): number
  planHeadroom(audios: (StepAudio | null | undefined)[]): void
  play(audio: StepAudio | null, options?: { durationS?: number, sham?: boolean, offsetS?: number }): void
  pause(): Promise<void>
  resume(): Promise<void>
  stop(fadeS?: number): void
  testTone(seconds?: number): Promise<void>
}
const AudioEngine = CoreAudioEngine as unknown as new (options: {
  levelDb: number
  mode: AudioMode
  maxLevelDb: number
  onStateChange: (state: string, info: { ctxState: string, interrupted: boolean }) => void
}) => Engine

export const MAX_LEVEL_DB = -6
export const MIN_LEVEL_DB = -50
const PREFS_KEY = 'guide-audio'
const LON_KEY = 'guide-longitude'
const NEXT_GUARD_MS = 700 // a double tap on Next must not skip a step
const SUSPEND_GRACE_MS = 1500

const clampLevel = (db: unknown) => Math.min(MAX_LEVEL_DB, Math.max(MIN_LEVEL_DB, Number.isFinite(Number(db)) ? Number(db) : -20))
const prefs: { mode?: AudioMode, levelDb?: number } = (() => {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') ?? {}
  } catch {
    return {}
  }
})()

/** What the trial steps of one run share. */
export interface RunContext { trial: Trial | null, arv: boolean, arvPass?: boolean | null }
export interface LiveRun {
  phase: 'idle' | 'starting' | 'running' | 'summary'
  guide: GuideDoc | null
  record: RunRecord | null
  index: number
  paused: boolean
  /** Active time of the current step before the last resume. */
  accumMs: number
  /** performance.now() of the last (re)start. */
  resumedAt: number
  now: number
  stepStartedAt: string
  timeUp: boolean
  /** Step id -> input value. */
  inputs: Record<string, InputValue | null | undefined>
  ctx: RunContext
  audio: AudioChoice
  audioInterrupted: boolean
  testing: boolean
  confirmStop: boolean
  /** Why the current input is unfinished, while asking to leave it. */
  confirmNext: string
  announce: string
  error: string
  saveError: string
}

export const live: LiveRun = reactive<LiveRun>({
  phase: 'idle',
  guide: null,
  record: null,
  index: 0,
  paused: false,
  accumMs: 0,
  resumedAt: 0,
  now: 0,
  stepStartedAt: '',
  timeUp: false,
  inputs: {},
  ctx: { trial: null, arv: false },
  audio: { mode: prefs.mode && MODES.includes(prefs.mode) ? prefs.mode : 'binaural', levelDb: clampLevel(prefs.levelDb ?? -20), blind: false },
  audioInterrupted: false,
  testing: false,
  confirmStop: false,
  confirmNext: '',
  announce: '',
  error: '',
  saveError: '',
})

/** The run, for the step inputs: injected, so they also work outside a run. */
export const GUIDE_RUN: InjectionKey<LiveRun> = Symbol('guideRun')

// Mirrored for the tab bar's running dot; module level, so it follows a run off-screen.
watch(() => [live.phase, live.paused || live.audioInterrupted] as const, ([phase, paused]) => Object.assign(guideState, { phase, paused }), { immediate: true })

let preferredMode = live.audio.mode // last mode the user picked
let engine: Engine | null = null
let ticker: ReturnType<typeof setInterval> | 0 = 0
let wakeLock: WakeLockSentinel | null = null
let wakeLocking = false
let helmetStarting: Promise<unknown> | null = null
let enteredAt = 0
let confirmAt = 0
let suspendedSince = 0

const iso = () => new Date().toISOString()
export const advanceOf = (step: GuideStep) => step.advance ?? (stepDurationMs(step) ? 'timer' : 'manual')
const elapsedMs = () => live.accumMs + (live.paused ? 0 : performance.now() - live.resumedAt)

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ mode: preferredMode, levelDb: live.audio.levelDb }))
  } catch {
    /* private mode */
  }
}

// Remember the helmet's longitude, for sidereal time in runs without the helmet.
watch(() => device.settings?.longitudeDeg, (lon) => {
  try {
    if (Number.isFinite(lon)) localStorage.setItem(LON_KEY, String(lon))
  } catch {
    /* private mode */
  }
}, { immediate: true })
const knownLongitude = () => {
  try {
    const v = localStorage.getItem(LON_KEY)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}

// Must first be called inside a click: the AudioContext needs a user gesture.
function ensureEngine() {
  if (!engine) engine = new AudioEngine({ levelDb: live.audio.levelDb, mode: live.audio.mode, maxLevelDb: MAX_LEVEL_DB, onStateChange: onAudioState })
  return engine.start()
}

// The sound stopped without Pause (a call, the lock screen, another app took the
// audio): hold the timer, so the record never claims audio that did not play.
function onAudioState(state: string, { interrupted }: { interrupted: boolean }) {
  if (interrupted && live.phase === 'running' && !live.paused && performance.now() - live.resumedAt > 1000) audioInterrupted()
}
function audioInterrupted() {
  if (live.phase !== 'running' || live.paused) return
  pause()
  live.audioInterrupted = true
  live.record!.audio.interruptions.push({ at: iso(), step: live.index })
  live.announce = 'The sound was interrupted. The session is paused until you resume the audio.'
}

export function setAudio(patch: Partial<AudioChoice>, { remember = true } = {}) {
  if (patch.mode !== undefined && MODES.includes(patch.mode)) {
    live.audio.mode = patch.mode
    if (remember) preferredMode = patch.mode
    if (live.phase === 'idle') engine?.setMode(patch.mode)
  }
  if (patch.levelDb !== undefined) {
    live.audio.levelDb = clampLevel(patch.levelDb) // the record keeps the starting T0; changes go to levelChanges
    engine?.setLevelDb(live.audio.levelDb)
  }
  if (patch.blind !== undefined) live.audio.blind = !!patch.blind
  if (remember) savePrefs()
}

export function commitLevel() {
  if (live.phase === 'running') live.record!.audio.levelChanges.push({ at: iso(), step: live.index, levelDb: live.audio.levelDb })
}

export async function testTone() {
  if (live.testing) return
  live.testing = true
  live.error = ''
  try {
    await ensureEngine()
    engine!.setMode(live.audio.mode)
    engine!.setLevelDb(live.audio.levelDb)
    await engine!.testTone(3)
  } catch (e) {
    live.error = `Audio: ${errorMessage(e)}`
  } finally {
    live.testing = false
  }
}

const within = <T>(ms: number, p: Promise<T>) => Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))])

// Kp and sidereal time: from the helmet when connected, else Kp from NOAA and
// LST from the last known helmet longitude.
async function readEnv(): Promise<RunEnv> {
  const helmetEnv = () => device.info?.env as Omit<RunEnv, 'from'> | undefined
  if (device.kind && device.link === 'connected') {
    try {
      const hello = await within(3000, call<{ env?: Omit<RunEnv, 'from'> }>('hello'))
      const env = hello?.env ?? helmetEnv()
      if (env) return { ...env, from: device.kind }
    } catch {
      const env = helmetEnv()
      if (env) return { ...env, from: device.kind }
    }
  }
  const env: RunEnv = { from: 'app', kpValid: false, timeValid: true, lst: -1 }
  try {
    const kp = await within(4000, freshKp()) // never a value older than three hours
    if (kp && Number.isFinite(kp.kp)) Object.assign(env, { kpValid: true, kp: kp.kp, ap: kp.ap, kpSource: 'noaa', kpTime: kp.time })
    else env.kpNote = '(NOAA did not answer)'
  } catch (e) {
    env.kpNote = `(not available: ${errorMessage(e)})`
  }
  const lon = knownLongitude()
  if (lon !== null && Number.isFinite(lon)) Object.assign(env, { lst: lstHours(new Date(), lon), longitude: lon })
  else env.lstNote = '(no longitude known: connect the helmet once, or set it on the Helmet tab)'
  return env
}

// The screen stays on while a timed step or the audio runs; an open-ended step
// without audio (e.g. "come back when the outcome is known") lets the phone sleep.
function wantsScreen() {
  if (live.phase !== 'running') return false
  const step = live.guide!.steps[live.index]
  return stepDurationMs(step) !== null || (live.record!.audio.enabled && stepHasAudio(step))
}
async function holdScreen() {
  if (!wantsScreen()) return dropScreen()
  if ((wakeLock && !wakeLock.released) || wakeLocking) return
  wakeLocking = true
  try {
    const lock = (await navigator.wakeLock?.request('screen')) ?? null
    if (wantsScreen()) wakeLock = lock
    else lock?.release().catch(() => {})
  } catch {
    wakeLock = null // not supported, or denied (e.g. battery saver)
  } finally {
    wakeLocking = false
  }
}
function dropScreen() {
  wakeLock?.release().catch(() => {})
  wakeLock = null
}
function onVisibility() {
  if (document.visibilityState !== 'visible' || live.phase !== 'running') return
  holdScreen()
  // Back from the lock screen or a call: wake the audio unless the run is paused.
  if (!live.paused) engine?.resume().catch(() => {})
}
function releaseWakeLock() {
  document.removeEventListener('visibilitychange', onVisibility)
  dropScreen()
}

async function persist() {
  if (!live.record) return
  try {
    await saveRun(live.record)
    live.saveError = ''
  } catch (e) {
    live.saveError = `Could not save the run on this phone: ${errorMessage(e)}`
  }
}

// ---------------------------------------------------------------- helmet arm
// The helmet runs the arm's program by itself; the run only starts it, watches
// it and stops it at the end of the arm. When the connection drops in between,
// the program runs on, and the run finds it again by the token its start carried.
const STOP_LATER = 'The helmet could not be reached when the program was to be stopped. The app stops it as soon as the connection is back; until then only the STOP button on the helmet does.'
let startWaiting = false // the start's answer did not come; the app is finding out what the helmet did
// Settles when that begins: whoever waits for the start to be over must not wait through it.
let startPaused: Promise<void> = Promise.resolve()
let startPausedNow: () => void = () => {}
// A finished run that was closed while its program still had to be stopped.
let orphan: RunRecord | null = null

const helmetNow = () => ({ kind: device.kind, name: device.name, firmware: (device.info?.firmware as string | undefined) ?? '', helmetId: device.info?.helmetId ?? '' })
/** The connected helmet is the one that runs (or ran) this arm. */
export function sameHelmet(d: RunHelmet['device']) {
  if (!d) return true
  if (d.helmetId && device.info?.helmetId) return d.helmetId === device.info.helmetId
  return d.kind === device.kind && (!d.name || d.name === device.name)
}
// The status describes this arm's session: by its token where the helmet
// reports one (and the same start of the helmet), else by its log entry.
function armSession(h: RunHelmet, s: DeviceStatus | null) {
  if (!s || !sameHelmet(h.device)) return false
  if (h.bootId && s.bootId && h.bootId !== s.bootId) return false
  if (s.token) return s.token === h.token
  return !!h.logId && s.logId === h.logId
}
/** The arm's session is running on the connected helmet now. */
export const armRunning = (h: RunHelmet | null | undefined) => !!h?.enabled && device.link === 'connected' && !device.stale && armSession(h, device.status) && device.status!.state !== 'idle'

function helmetStart() {
  const record = live.record!
  const h = record.helmet
  if (!h.enabled || h.logId || h.token || helmetStarting) return
  startPaused = new Promise((resolve) => (startPausedNow = resolve))
  helmetStarting = (async () => {
    const p = presetById(h.presetId)
    if (!p?.doc) return (h.error = `Preset "${h.presetId}" not found; helmet arm skipped.`)
    if (device.link !== 'connected') return (h.error = device.kind ? 'The connection to the helmet was lost when the program was to start; arm skipped.' : 'Helmet not connected; arm skipped.')
    // Which helmet ran it: the later reveal (log.rate) must talk to the same one.
    h.device = helmetNow()
    // The token is in the record before the start is sent: whatever happens to
    // the answer, or to this page, the session can be found again by it.
    const sentAt = iso()
    Object.assign(h, { token: newToken(), bootId: device.info?.bootId ?? 0 })
    await persist()
    try {
      const r = await start('session.start', { session: p.doc, presetId: p.doc.id, blind: h.blind, ...(h.fieldUT ? { fieldUT: h.fieldUT } : {}) }, {
        token: h.token,
        onWaiting: () => {
          startWaiting = true
          startPausedNow()
          h.error = 'No answer to the start yet. The app is finding out whether the program runs; it is not started twice.'
        },
        // Sent a second time only while the arm still wants it: not when its step, or the run, is over.
        wanted: () => !h.stopPending && live.record?.id === record.id,
      })
      Object.assign(h, { logId: r?.logId ?? 0, startedAt: sentAt, running: !r?.ended, error: '' })
      if (startWaiting) Object.assign(h, { adopted: !!r?.already, linkNote: r?.already ? 'the answer to its start was lost, and it was found again on the helmet' : 'started late: the first start did not reach the helmet' })
      if (r?.ended) Object.assign(h, { stoppedAt: iso(), stopNote: 'had already ended when the connection was back' })
      // Its rating belongs to this run's summary, not to the prompt on the Programs tab.
      if (h.logId) ratingElsewhere(h.logId)
    } catch (e) {
      if ((e as { code?: string }).code === 'unwanted') Object.assign(h, { stopPending: false, error: 'The helmet could not be reached while this part ran, so its program was not started.' })
      else h.error = errorMessage(e)
    } finally {
      startWaiting = false
    }
    // The arm is over already (the answer took that long): stop it now.
    if (h.running && h.stopPending) await stopArm(h)
  })().finally(() => {
    helmetStarting = null
    persist()
  })
}

// One stop at a time: the last step of the arm and the end of the run both ask for it.
let stopping: Promise<void> | null = null
function helmetStop() {
  stopping ??= (async () => {
    // (A start that waits for the connection is not waited for: it stops the program itself when it finds it.)
    if (helmetStarting) await Promise.race([helmetStarting, startPaused])
    const h = live.record?.helmet
    if (!h?.enabled || !h.token || h.stoppedAt) return
    if (!h.running && !startWaiting) return
    await stopArm(h)
  })().finally(() => (stopping = null))
  return stopping
}

// Stops the arm's program, or notes that it must be stopped once the helmet can be reached.
async function stopArm(h: RunHelmet) {
  // (Disconnected on purpose: nothing reconnects by itself, but if the helmet is connected again in time, the stop still goes out.)
  const later = () => void Object.assign(h, {
    stopPending: true, stopFailedAt: h.stopFailedAt ?? iso(), running: !!device.kind,
    error: device.kind ? STOP_LATER : 'The helmet was not connected at the end, so the app could not stop the program; it runs on to its own end. Reconnect and check the Programs tab.',
  })
  if (device.link !== 'connected' || startWaiting) return later()
  if (!sameHelmet(h.device)) {
    Object.assign(h, { running: false, stopPending: false, stopFailedAt: h.stopFailedAt ?? iso(), error: 'Another helmet is connected now, so the app could not stop the program; it runs on to its own end.' })
    return
  }
  let failure: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    // Ask now: the status at hand may be older than the start (or than the stop that got no answer).
    let s = device.status
    try {
      s = await readStatus()
    } catch {
      if (device.link !== 'connected') return later()
    }
    // Nothing to stop if it already ended or another session runs now.
    if (!s || s.state === 'idle' || !armSession(h, s)) {
      const late = !!h.stopPending
      Object.assign(h, { running: false, stopPending: false, stoppedAt: iso(), stopNote: !s || s.state === 'idle' ? 'had already ended' : 'another session was running' })
      if (late || attempt) h.error = ''
      return
    }
    try {
      await call('session.stop', {}, STOP_ANSWER_MS)
      const late = !!h.stopPending
      Object.assign(h, { running: false, stopPending: false, stoppedAt: iso() })
      if (late) Object.assign(h, { stopRetriedAt: h.stoppedAt, error: '', linkNote: 'stopped late, when the connection was back' })
      return
    } catch (e) {
      failure = e
      const code = (e as { code?: string }).code ?? ''
      // The link went with it: the stop goes out again when the helmet is back and the program still runs.
      if (code === 'lost' || device.link !== 'connected') return later()
      // No answer, the link still up: it may have stopped all the same. Once more, from the status.
      if (code !== 'timeout' && code !== 'send') break
    }
  }
  if (device.link !== 'connected') return later()
  Object.assign(h, { running: false, stopPending: false, error: `Stop failed: ${errorMessage(failure)}. Use Stop in the bar at the top, or the STOP button on the helmet.`, stopFailedAt: iso() })
}

// The connection came back: where is the arm's program?
async function helmetBack(record: RunRecord) {
  const h = record.helmet
  // (While the start is still finding out what the helmet did with it, that decides, and stops the program if the arm is over.)
  if (!h.enabled || !h.token || !sameHelmet(h.device) || (startWaiting && record === live.record)) return
  const s = device.status
  const ev = device.event
  if (armSession(h, s) && s!.state !== 'idle') {
    // Still running. (Found for the first time here when the start gave up waiting.)
    if (!h.logId && s!.logId) {
      Object.assign(h, { logId: s!.logId, startedAt: h.startedAt ?? iso(), adopted: true, error: '', linkNote: 'the answer to its start was lost, and it was found again on the helmet' })
      ratingElsewhere(h.logId)
    }
    h.running = true
    if (h.stopPending) await stopArm(h)
    return
  }
  if (!h.running && !h.stopPending) return
  // It ended while the connection was down, or the helmet restarted.
  const why = ev?.type === 'restarted' ? `the helmet restarted${ev.resetReason ? ` (${ev.resetReason})` : ''}` : stopReasonText(ev?.type === 'ended' ? ev.reason : s?.lastStopReason, Number(device.settings?.keepaliveS) || 0)
  Object.assign(h, { running: false, stopPending: false, stoppedAt: iso(), error: '', stopNote: 'ended while the connection was down', linkNote: `ended while the connection was down${why ? `: ${why}` : ''}` })
}

// Every drop and return of the connection goes into the record of a run that
// uses the helmet: the run that is going, and one that was closed while its
// program still had to be stopped.
let linkDown = false
watch(() => device.link, async (link, was) => {
  const records = [live.record, orphan].filter((r, i, all): r is RunRecord => !!r && all.indexOf(r) === i)
  if (link === 'lost' && was === 'connected' && !linkDown) {
    linkDown = true
    for (const record of records) {
      const going = record === live.record && (live.phase === 'running' || live.phase === 'starting')
      if (!going && !record.helmet.running && !record.helmet.stopPending) continue
      record.links = [...(record.links ?? []), { at: iso(), step: live.index, event: 'lost' }]
      if (going && live.phase === 'running' && record.helmet.running) live.announce = 'The connection to the helmet is lost. Its program keeps running.'
      if (record === live.record) await persist()
    }
    return
  }
  if (link !== 'connected') return
  linkDown = false
  for (const record of records) {
    // What was found: for a run with a helmet program, whether that program still runs.
    const h = record.helmet
    const found = !sameHelmet(h.device) ? 'other' : device.event?.type === 'restarted' ? 'restarted' : armRunning(h) ? 'running' : h.running || h.stopPending ? 'ended' : device.event?.type ?? 'back'
    if (record.links?.at(-1)?.event === 'lost') record.links = [...record.links, { at: iso(), step: live.index, event: 'back', found }]
    await helmetBack(record)
    if (record === orphan) {
      if (!record.helmet.stopPending) orphan = null
      await saveRun(plain(record)).catch(() => {})
    } else if (record === live.record) await persist()
  }
})

// Leaving the page ends the run (its sound and timers live in this page) while
// the helmet program runs on: the browser asks first.
function askBeforeLeaving(e: BeforeUnloadEvent) {
  e.preventDefault()
  e.returnValue = ''
}
if (typeof window !== 'undefined') {
  watch(() => live.phase === 'starting' || live.phase === 'running' || !!live.record?.helmet.running || !!live.record?.helmet.stopPending, (on) => {
    if (on) window.addEventListener('beforeunload', askBeforeLeaving)
    else window.removeEventListener('beforeunload', askBeforeLeaving)
  }, { immediate: true })
}

/**
 * An earlier run was cut off (the page was reloaded or closed) and its helmet
 * program is still running: stop it, and note that in the stored run.
 */
export async function stopLeftover(record: RunRecord) {
  const updated = plain(record)
  const h = updated.helmet
  if (!armRunning(h)) return updated
  await call('session.stop')
  Object.assign(h, { running: false, stopPending: false, logId: h.logId || device.status?.logId || 0, stoppedAt: iso(), stopRetriedAt: iso(), error: '', linkNote: 'stopped from the Guides page, after the run was cut off' })
  return saveRun(updated)
}

// ---------------------------------------------------------------- steps
function playStep(step: GuideStep) {
  if (!engine || !live.record!.audio.enabled || live.record!.audio.error) return
  const ms = stepDurationMs(step) // null: open-ended, the audio holds
  try {
    engine.play(step.audio ?? null, { durationS: ms ? ms / 1000 : undefined, sham: live.record!.audio.sham })
  } catch (e) {
    live.record!.audio.error = errorMessage(e)
  }
}

function enterStep(i: number) {
  const step = live.guide!.steps[i]!
  const t = performance.now()
  if (live.paused) engine?.resume().catch(() => {})
  Object.assign(live, { phase: 'running', index: i, paused: false, audioInterrupted: false, confirmNext: '', accumMs: 0, resumedAt: t, now: t, stepStartedAt: iso(), timeUp: false })
  enteredAt = t
  suspendedSince = 0
  live.announce = `Step ${i + 1} of ${live.guide!.steps.length}: ${step.title}`
  playStep(step)
  holdScreen()
  const arm = armRange(live.guide)
  if (arm && i === arm.first) helmetStart()
  persist()
}

function closeStep(end: RunStepRecord['end']) {
  const step = live.guide!.steps[live.index]!
  const unfinished = inputPending(step.input, live.inputs[step.id])
  live.record!.steps.push({
    id: step.id, title: step.title, startedAt: live.stepStartedAt, endedAt: iso(), plannedMs: stepDurationMs(step),
    activeMs: Math.round(elapsedMs()), end, input: sealInput(step.input, live.inputs[step.id]), ...(unfinished ? { unfinished } : {}),
  })
  const arm = armRange(live.guide)
  if (arm && live.index === arm.last) helmetStop()
}

function tick() {
  live.now = performance.now()
  if (live.phase !== 'running' || live.paused) return
  // A suspended context that sent no state change (or did not wake on resume).
  if (engine && live.record!.audio.enabled && !live.record!.audio.error && engine.state === 'suspended') {
    suspendedSince ||= live.now
    if (live.now - suspendedSince > SUSPEND_GRACE_MS) return audioInterrupted()
  } else suspendedSince = 0
  const step = live.guide!.steps[live.index]!
  const ms = stepDurationMs(step)
  if (ms === null || elapsedMs() < ms) return
  if (advanceOf(step) === 'timer') next('timer')
  else if (!live.timeUp) {
    live.timeUp = true
    live.announce = 'Time is up for this step. Press Next when you are ready.'
  }
}

async function finish(stopped: boolean) {
  if (ticker) clearInterval(ticker)
  ticker = 0
  Object.assign(live, { phase: 'summary', confirmStop: false, confirmNext: '', paused: false, audioInterrupted: false })
  try {
    engine?.stop(stopped ? 0.3 : 1.5)
  } catch {
    /* already stopped */
  }
  await helmetStop()
  releaseWakeLock()
  Object.assign(live.record!, { endedAt: iso(), completed: !stopped, stopped })
  live.announce = stopped ? 'Session stopped.' : 'Session complete.'
  await persist()
}

// ---------------------------------------------------------------- controls
export async function begin(guide: GuideDoc, { helmet = false, fieldUT = null as number | null } = {}) {
  if (live.phase !== 'idle') return
  live.error = ''
  const audible = hasAudio(guide)
  let audioError = ''
  const audioReady = audible ? ensureEngine().catch((e: unknown) => (audioError = errorMessage(e) || String(e))) : null
  const now = new Date()
  const arm = helmet && guide.helmetArm && (guide.requires?.helmet ?? 'none') !== 'none' ? guide.helmetArm : null
  // Only binaural beats are inaudible as such; in the other modes a sham is easy to hear.
  const blind = audible && live.audio.blind && live.audio.mode === 'binaural'
  Object.assign(live, { phase: 'starting', guide, index: 0, paused: false, inputs: {}, ctx: { trial: null, arv: false }, confirmStop: false, confirmNext: '', audioInterrupted: false, saveError: '' })
  live.record = {
    id: runId(now), guideId: guide.id, guideName: guide.name, guideHash: '', startedAt: now.toISOString(), endedAt: null, completed: false, stopped: false,
    steps: [],
    audio: { enabled: audible, mode: live.audio.mode, levelDb: live.audio.levelDb, blind, sham: blind ? randomBelow(2) === 1 : false, levelChanges: [], interruptions: [], error: '' },
    helmet: {
      enabled: !!arm, presetId: arm?.preset ?? '', blind: !!arm?.blind, fieldUT: arm && Number(fieldUT) > 0 ? Number(fieldUT) : null, device: null,
      logId: 0, startedAt: null, stoppedAt: null, running: false, error: '',
    },
    env: null,
    reveal: null,
  }
  const envReady = readEnv()
  await audioReady
  if (audioError) live.record.audio.error = `Audio could not start: ${audioError}`
  else if (audible) {
    engine!.setMode(live.audio.mode)
    engine!.setLevelDb(live.audio.levelDb)
    // One level for the whole guide, so it never drops at the densest step.
    engine!.planHeadroom(guide.steps.map((s) => s.audio))
  }
  try {
    live.record.guideHash = await guideHash(guide)
  } catch {
    /* stays empty */
  }
  live.record.env = await envReady
  document.addEventListener('visibilitychange', onVisibility)
  ticker = setInterval(tick, 250)
  enterStep(0)
}

export function next(end: RunStepRecord['end'] = 'next') {
  if (live.phase !== 'running') return
  closeStep(end)
  if (live.index + 1 >= live.guide!.steps.length) return finish(false)
  enterStep(live.index + 1)
}

// Next / Skip from the controls: ignores a double tap, and asks before leaving an unfinished input.
export function requestNext() {
  if (live.phase !== 'running' || performance.now() - enteredAt < NEXT_GUARD_MS) return
  const step = live.guide!.steps[live.index]!
  const reason = inputPending(step.input, live.inputs[step.id])
  if (reason) {
    live.confirmNext = reason
    confirmAt = performance.now()
    return
  }
  next(advanceOf(step) === 'timer' ? 'skip' : 'next')
}

export function confirmLeave() {
  if (live.phase !== 'running' || performance.now() - confirmAt < NEXT_GUARD_MS) return
  live.confirmNext = ''
  next(advanceOf(live.guide!.steps[live.index]!) === 'timer' ? 'skip' : 'next')
}

export function pause() {
  if (live.phase !== 'running' || live.paused) return
  live.accumMs = elapsedMs()
  live.paused = true
  engine?.pause().catch(() => {})
  live.announce = 'Paused.'
}

export function resume() {
  if (live.phase !== 'running' || !live.paused) return
  live.resumedAt = live.now = performance.now()
  live.paused = false
  live.audioInterrupted = false
  suspendedSince = 0
  live.announce = 'Resumed.'
  engine?.resume().catch((e: unknown) => (live.error = `Audio: ${errorMessage(e)}`))
}

export function stop() {
  if (live.phase !== 'running') return
  closeStep('stop')
  return finish(true)
}

// Default mode for a guide: binaural only with headphones confirmed.
export function suggestMode(guide: GuideDoc, headphones: boolean) {
  if (!guide.requires?.headphones) return
  setAudio({ mode: headphones || preferredMode !== 'binaural' ? preferredMode : 'isochronic' }, { remember: false })
}

export function closeRun() {
  // Its program still has to be stopped when the helmet is back: that outlives the summary.
  if (live.record?.helmet.stopPending) orphan = plain(live.record)
  Object.assign(live, { phase: 'idle', guide: null, record: null, inputs: {}, ctx: { trial: null, arv: false }, announce: '', error: '', confirmStop: false, confirmNext: '', audioInterrupted: false })
}
