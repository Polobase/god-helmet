<script>
// Run state lives at module level, so a running guide (audio, timer, helmet
// arm, inputs) survives the view being remounted, e.g. after a tab switch.
import { reactive, watch } from 'vue'
import { AudioEngine } from '../../audio/engine.js'
import { MODES } from '../../audio/schedule.js'
import { device, call } from '../../ble/device.js'
import { presetById } from '../../lib/presets.js'
import { guideHash } from '../../lib/guides.js'
import { randomBelow } from '../../lib/crypto.js'
import { fetchKp } from '../../lib/noaa.js'
import { runId, saveRun, stepDurationMs, armRange, hasAudio, stepHasAudio, sealInput, inputPending, lstHours } from '../../lib/runs.js'

export const MAX_LEVEL_DB = -6
const MIN_LEVEL_DB = -50
const PREFS_KEY = 'guide-audio'
const LON_KEY = 'guide-longitude'
const NEXT_GUARD_MS = 700 // a double tap on Next must not skip a step
const SUSPEND_GRACE_MS = 1500

const clampLevel = (db) => Math.min(MAX_LEVEL_DB, Math.max(MIN_LEVEL_DB, Number.isFinite(Number(db)) ? Number(db) : -20))
const prefs = (() => {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {}
  } catch {
    return {}
  }
})()

export const live = reactive({
  phase: 'idle', // idle | starting | running | summary
  guide: null,
  record: null,
  index: 0,
  paused: false,
  accumMs: 0, // active time of the current step before the last resume
  resumedAt: 0, // performance.now() of the last (re)start
  now: 0,
  stepStartedAt: '',
  timeUp: false,
  inputs: {}, // step id -> input value
  ctx: { trial: null, arv: false }, // shared by trial steps
  audio: { mode: MODES.includes(prefs.mode) ? prefs.mode : 'binaural', levelDb: clampLevel(prefs.levelDb ?? -20), blind: false },
  audioInterrupted: false,
  testing: false,
  confirmStop: false,
  confirmNext: '', // why the current input is unfinished, while asking to leave it
  announce: '',
  error: '',
  saveError: '',
})

let preferredMode = live.audio.mode // last mode the user picked
let engine = null
let ticker = 0
let wakeLock = null
let wakeLocking = false
let helmetStarting = null
let enteredAt = 0
let confirmAt = 0
let suspendedSince = 0

const iso = () => new Date().toISOString()
export const advanceOf = (step) => step.advance ?? (stepDurationMs(step) ? 'timer' : 'manual')
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
function onAudioState(state, { interrupted }) {
  if (interrupted && live.phase === 'running' && !live.paused && performance.now() - live.resumedAt > 1000) audioInterrupted()
}
function audioInterrupted() {
  if (live.phase !== 'running' || live.paused) return
  pause()
  live.audioInterrupted = true
  live.record.audio.interruptions.push({ at: iso(), step: live.index })
  live.announce = 'The sound was interrupted. The session is paused until you resume the audio.'
}

export function setAudio(patch, { remember = true } = {}) {
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
  if (live.phase === 'running') live.record.audio.levelChanges.push({ at: iso(), step: live.index, levelDb: live.audio.levelDb })
}

export async function testTone() {
  if (live.testing) return
  live.testing = true
  live.error = ''
  try {
    await ensureEngine()
    engine.setMode(live.audio.mode)
    engine.setLevelDb(live.audio.levelDb)
    await engine.testTone(3)
  } catch (e) {
    live.error = `Audio: ${e.message}`
  } finally {
    live.testing = false
  }
}

const within = (ms, p) => Promise.race([p, new Promise((resolve) => setTimeout(() => resolve(null), ms))])

// Kp and sidereal time: from the helmet when connected, else Kp from NOAA and
// LST from the last known helmet longitude.
async function readEnv() {
  if (device.kind) {
    try {
      const hello = await within(3000, call('hello'))
      const env = hello?.env ?? device.info?.env
      if (env) return { ...env, from: device.kind }
    } catch {
      if (device.info?.env) return { ...device.info.env, from: device.kind }
    }
  }
  const env = { from: 'app', kpValid: false, timeValid: true, lst: -1 }
  try {
    const kp = device.kp ?? (await within(4000, fetchKp()))
    if (kp && Number.isFinite(kp.kp)) Object.assign(env, { kpValid: true, kp: kp.kp, ap: kp.ap, kpSource: 'noaa', kpTime: kp.time })
    else env.kpNote = '(NOAA did not answer)'
  } catch (e) {
    env.kpNote = `(not available: ${e.message})`
  }
  const lon = knownLongitude()
  if (Number.isFinite(lon)) Object.assign(env, { lst: lstHours(new Date(), lon), longitude: lon })
  else env.lstNote = '(no longitude known: connect the helmet once, or set it in Setup)'
  return env
}

// The screen stays on while a timed step or the audio runs; an open-ended step
// without audio (e.g. "come back when the outcome is known") lets the phone sleep.
function wantsScreen() {
  if (live.phase !== 'running') return false
  const step = live.guide.steps[live.index]
  return stepDurationMs(step) !== null || (live.record.audio.enabled && stepHasAudio(step))
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
    live.saveError = `Could not save the run on this phone: ${e.message}`
  }
}

// ---------------------------------------------------------------- helmet arm
function helmetStart() {
  const h = live.record.helmet
  if (!h.enabled || h.logId || helmetStarting) return
  helmetStarting = (async () => {
    const p = presetById(h.presetId)
    if (!p?.doc) return (h.error = `Preset "${h.presetId}" not found; helmet arm skipped.`)
    if (!device.kind) return (h.error = 'Helmet not connected; arm skipped.')
    // Which helmet ran it: the later reveal (log.rate) must talk to the same one.
    h.device = { kind: device.kind, name: device.name, firmware: device.info?.firmware ?? '' }
    try {
      const r = await call('session.start', { session: p.doc, presetId: p.doc.id, blind: h.blind, ...(h.fieldUT ? { fieldUT: h.fieldUT } : {}) })
      Object.assign(h, { logId: r?.logId ?? 0, startedAt: iso(), running: true })
    } catch (e) {
      h.error = `Helmet: ${e.message}`
    }
  })().finally(() => {
    helmetStarting = null
    persist()
  })
}

async function helmetStop() {
  if (helmetStarting) await helmetStarting
  const h = live.record?.helmet
  if (!h?.running) return
  h.running = false
  if (!device.kind || (h.device && (h.device.kind !== device.kind || h.device.name !== device.name))) {
    h.error = 'The helmet was not connected at the end, so the app could not stop the program; it runs on to its own end. Reconnect and check the Programs tab.'
    h.stopFailedAt = iso()
    return
  }
  const s = device.status
  // Nothing to stop if it already ended or another session runs now.
  if (s && (s.state === 'idle' || (s.logId && s.logId !== h.logId))) {
    Object.assign(h, { stoppedAt: iso(), stopNote: s.state === 'idle' ? 'had already ended' : 'another session was running' })
    return
  }
  try {
    await call('session.stop')
    h.stoppedAt = iso()
  } catch (e) {
    Object.assign(h, { error: `Helmet stop: ${e.message}`, stopFailedAt: iso() })
  }
}

// ---------------------------------------------------------------- steps
function playStep(step) {
  if (!engine || !live.record.audio.enabled || live.record.audio.error) return
  const ms = stepDurationMs(step) // null: open-ended, the audio holds
  try {
    engine.play(step.audio ?? null, { durationS: ms ? ms / 1000 : undefined, sham: live.record.audio.sham })
  } catch (e) {
    live.record.audio.error = e.message
  }
}

function enterStep(i) {
  const step = live.guide.steps[i]
  const t = performance.now()
  if (live.paused) engine?.resume().catch(() => {})
  Object.assign(live, { phase: 'running', index: i, paused: false, audioInterrupted: false, confirmNext: '', accumMs: 0, resumedAt: t, now: t, stepStartedAt: iso(), timeUp: false })
  enteredAt = t
  suspendedSince = 0
  live.announce = `Step ${i + 1} of ${live.guide.steps.length}: ${step.title}`
  playStep(step)
  holdScreen()
  const arm = armRange(live.guide)
  if (arm && i === arm.first) helmetStart()
  persist()
}

function closeStep(end) {
  const step = live.guide.steps[live.index]
  const unfinished = inputPending(step.input, live.inputs[step.id])
  live.record.steps.push({
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
  if (engine && live.record.audio.enabled && !live.record.audio.error && engine.state === 'suspended') {
    suspendedSince ||= live.now
    if (live.now - suspendedSince > SUSPEND_GRACE_MS) return audioInterrupted()
  } else suspendedSince = 0
  const step = live.guide.steps[live.index]
  const ms = stepDurationMs(step)
  if (ms === null || elapsedMs() < ms) return
  if (advanceOf(step) === 'timer') next('timer')
  else if (!live.timeUp) {
    live.timeUp = true
    live.announce = 'Time is up for this step. Press Next when you are ready.'
  }
}

async function finish(stopped) {
  clearInterval(ticker)
  ticker = 0
  Object.assign(live, { phase: 'summary', confirmStop: false, confirmNext: '', paused: false, audioInterrupted: false })
  try {
    engine?.stop(stopped ? 0.3 : 1.5)
  } catch {
    /* already stopped */
  }
  await helmetStop()
  releaseWakeLock()
  Object.assign(live.record, { endedAt: iso(), completed: !stopped, stopped })
  live.announce = stopped ? 'Session stopped.' : 'Session complete.'
  await persist()
}

// ---------------------------------------------------------------- controls
export async function begin(guide, { helmet = false, fieldUT = null } = {}) {
  if (live.phase !== 'idle') return
  live.error = ''
  const audible = hasAudio(guide)
  let audioError = ''
  const audioReady = audible ? ensureEngine().catch((e) => (audioError = e.message || String(e))) : null
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
    engine.setMode(live.audio.mode)
    engine.setLevelDb(live.audio.levelDb)
    // One level for the whole guide, so it never drops at the densest step.
    engine.planHeadroom(guide.steps.map((s) => s.audio))
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

export function next(end = 'next') {
  if (live.phase !== 'running') return
  closeStep(end)
  if (live.index + 1 >= live.guide.steps.length) return finish(false)
  enterStep(live.index + 1)
}

// Next / Skip from the controls: ignores a double tap, and asks before leaving an unfinished input.
export function requestNext() {
  if (live.phase !== 'running' || performance.now() - enteredAt < NEXT_GUARD_MS) return
  const step = live.guide.steps[live.index]
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
  next(advanceOf(live.guide.steps[live.index]) === 'timer' ? 'skip' : 'next')
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
  engine?.resume().catch((e) => (live.error = `Audio: ${e.message}`))
}

export function stop() {
  if (live.phase !== 'running') return
  closeStep('stop')
  return finish(true)
}

// Default mode for a guide: binaural only with headphones confirmed.
export function suggestMode(guide, headphones) {
  if (!guide.requires?.headphones) return
  setAudio({ mode: headphones || preferredMode !== 'binaural' ? preferredMode : 'isochronic' }, { remember: false })
}

export function closeRun() {
  Object.assign(live, { phase: 'idle', guide: null, record: null, inputs: {}, ctx: { trial: null, arv: false }, announce: '', error: '', confirmStop: false, confirmNext: '', audioInterrupted: false })
}
</script>

<script setup>
import { computed, provide, ref, watch } from 'vue'
import { marked } from 'marked'
import { connect } from '../../ble/device.js'
import { fmtDuration, fmtMinutes } from '../../lib/format.js'
import AudioSetup from './AudioSetup.vue'
import RunSummary from './RunSummary.vue'
import TextInput from './TextInput.vue'
import SketchInput from './SketchInput.vue'
import RatingInput from './RatingInput.vue'
import QuestionnaireInput from './QuestionnaireInput.vue'
import ChoiceTrainer from './ChoiceTrainer.vue'
import CrvStage from './CrvStage.vue'
import TrialStep from './TrialStep.vue'
import OutcomeInput from './OutcomeInput.vue'
import RngTask from './RngTask.vue'

const props = defineProps({ guide: { type: Object, required: true }, headphones: { type: Boolean, default: false } })
const emit = defineEmits(['exit'])
provide('guideRun', live)

const INPUTS = { text: TextInput, sketch: SketchInput, rating: RatingInput, questionnaire: QuestionnaireInput, choice: ChoiceTrainer, crv: CrvStage, trial: TrialStep, outcome: OutcomeInput, rng: RngTask }

const guide = computed(() => live.guide ?? props.guide)
const steps = computed(() => guide.value.steps ?? [])

// ---- set-up
const audible = computed(() => hasAudio(props.guide))
const helmetMode = computed(() => props.guide.requires?.helmet ?? 'none')
const armAvailable = computed(() => !!props.guide.helmetArm && helmetMode.value !== 'none')
const armPreset = computed(() => (props.guide.helmetArm ? presetById(props.guide.helmetArm.preset) : null))
const armSteps = computed(() => {
  const r = armRange(props.guide)
  return r ? steps.value.slice(r.first, r.last + 1).map((s) => s.title).join(', ') : ''
})
const useHelmet = ref(true)
const canBegin = computed(() => helmetMode.value !== 'required' || (!!device.kind && (!props.guide.helmetArm || !!armPreset.value)))
if (live.phase === 'idle') suggestMode(props.guide, props.headphones)
// Only what the user changed: an untouched suggested mode is not remembered as their choice.
const audioModel = computed({
  get: () => ({ ...live.audio }),
  set: (v) => setAudio(Object.fromEntries(Object.entries(v).filter(([k, x]) => live.audio[k] !== x))),
})
// Field strength of the arm (as in the Programs tab: the preset's value, capped by the helmet).
const maxField = computed(() => Math.min(device.info?.maxFieldUT ?? 5, device.info?.maxReachableUT ?? 5))
const fieldPick = ref(null)
const fieldUT = computed({
  get: () => Math.min(maxField.value, fieldPick.value ?? armPreset.value?.doc.uT ?? device.info?.defaultFieldUT ?? 1),
  set: (v) => (fieldPick.value = Number(v)),
})
const onBegin = () => begin(props.guide, { helmet: armAvailable.value && useHelmet.value && !!device.kind && !!armPreset.value, fieldUT: fieldUT.value })

// ---- running
const step = computed(() => (live.phase === 'running' ? steps.value[live.index] : null))
const durMs = computed(() => (step.value ? stepDurationMs(step.value) : null))
const elapsed = computed(() => Math.max(0, live.accumMs + (live.paused ? 0 : live.now - live.resumedAt)))
const isTimer = computed(() => !!step.value && advanceOf(step.value) === 'timer')
const clock = computed(() => (isTimer.value && durMs.value ? Math.max(0, durMs.value - elapsed.value) : elapsed.value))
const stepFrac = computed(() => (durMs.value ? Math.min(1, elapsed.value / durMs.value) : 0))
const overallFrac = computed(() => (live.index + stepFrac.value) / Math.max(1, steps.value.length))
const isLast = computed(() => live.index === steps.value.length - 1)
const html = computed(() => (step.value?.instructions ? marked.parse(step.value.instructions) : ''))
const inputComp = computed(() => INPUTS[step.value?.input?.type] ?? null)
const helmet = computed(() => live.record?.helmet ?? null)
const nextLabel = computed(() => (isLast.value ? 'Finish' : isTimer.value ? 'Skip step' : 'Next'))
const pct = (x) => `${Math.round(x * 1000) / 10}%`

watch(() => live.index, () => {
  if (live.phase === 'running') window.scrollTo({ top: 0 })
})

function done() {
  closeRun()
  emit('exit')
}
</script>

<template>
  <div class="page">
    <!-- set-up -->
    <template v-if="live.phase === 'idle'">
      <header class="card">
        <span class="eyebrow">Get ready</span>
        <h2>{{ guide.name }}</h2>
        <p v-if="guide.setting" class="small">{{ guide.setting }}</p>
        <p v-if="guide.cautions" class="small warn">{{ guide.cautions }}</p>
      </header>

      <section v-if="audible" class="card">
        <AudioSetup v-model="audioModel" :max-level-db="MAX_LEVEL_DB" :testing="live.testing" :headphones="headphones" @test="testTone" />
      </section>

      <section v-if="armAvailable" class="card">
        <h3>Helmet</h3>
        <template v-if="!armPreset">
          <p class="small warn">The preset “{{ guide.helmetArm.preset }}” is missing from this app; the field arm cannot run.</p>
        </template>
        <template v-else-if="device.kind">
          <label class="check"><input v-model="useHelmet" type="checkbox" :disabled="helmetMode === 'required'" /> Run “{{ armPreset.doc.name }}” during: {{ armSteps }}</label>
          <label v-if="useHelmet" class="field">Intensity at 20 mm depth: <b class="num">{{ Number(fieldUT).toFixed(1) }} µT</b>
            <input v-model="fieldUT" type="range" min="0.1" :max="maxField.toFixed(1)" step="0.1" />
          </label>
          <p class="small muted">{{ guide.helmetArm.blind ? 'Blind: the helmet’s hardware RNG picks real or sham. It is revealed after your final rating.' : 'Not blind: the field is real.' }}</p>
          <p v-if="device.info && !device.info.safetyAccepted" class="small warn">Accept the <a href="#safety">safety page</a> first, or the helmet will refuse to start.</p>
        </template>
        <template v-else>
          <p class="small">{{ helmetMode === 'required' ? 'This guide needs the helmet.' : 'Optional: connect the helmet to add the field.' }}</p>
          <div class="row">
            <button type="button" class="btn sm" :disabled="!device.bluetooth || device.connecting" @click="connect('ble')">Connect helmet</button>
            <button type="button" class="btn ghost sm" @click="connect('demo')">Demo</button>
          </div>
        </template>
      </section>

      <p v-if="live.error" class="card small bad">{{ live.error }}</p>
      <div class="row">
        <button type="button" class="btn primary" :disabled="!canBegin" @click="onBegin">Begin</button>
        <button type="button" class="btn ghost" @click="emit('exit')">Back</button>
      </div>
      <p class="small muted">The screen stays on during timed steps and while audio plays; open-ended steps let the phone sleep. Pause holds audio and timer (a helmet program keeps running); Stop ends everything.</p>
    </template>

    <section v-else-if="live.phase === 'starting'" class="card"><p>Starting…</p></section>

    <!-- running -->
    <template v-else-if="live.phase === 'running' && step">
      <section class="card runner">
        <div class="row between">
          <span class="eyebrow">{{ guide.name }}</span>
          <span class="eyebrow">Step {{ live.index + 1 }} of {{ steps.length }}</span>
        </div>
        <h2 class="title">{{ step.title }}</h2>
        <div class="clockrow">
          <span class="clock num" :class="{ paused: live.paused }">{{ fmtDuration(clock) }}</span>
          <span class="small muted">{{ isTimer ? 'left' : durMs ? `elapsed · about ${fmtMinutes(durMs)}` : 'elapsed' }}{{ live.paused ? ' · paused' : '' }}</span>
        </div>
        <div class="bar" role="progressbar" aria-label="Step progress" :aria-valuenow="Math.round(stepFrac * 100)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: pct(stepFrac) }"></i></div>
        <div class="bar thin" role="progressbar" aria-label="Session progress" :aria-valuenow="Math.round(overallFrac * 100)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: pct(overallFrac) }"></i></div>
        <!-- eslint-disable-next-line vue/no-v-html -- trusted guide files from the repo -->
        <div v-if="html" class="instructions" v-html="html"></div>
        <p v-if="live.timeUp" class="small warn">Time is up for this step. Press Next when you are ready.</p>
      </section>

      <section v-if="live.audioInterrupted" class="card interrupted" role="alert">
        <p><b>The sound was interrupted</b> (a call, the lock screen or another app took the audio). The timer is paused, so nothing runs on in silence.</p>
        <div class="row"><button type="button" class="btn primary" @click="resume">Tap to resume audio</button></div>
      </section>

      <section v-if="inputComp" class="card">
        <component :is="inputComp" :key="step.id" v-model="live.inputs[step.id]" :input="step.input" />
      </section>

      <section class="status small">
        <p v-if="helmet?.enabled">
          <span class="muted">Helmet:</span>
          <template v-if="helmet.running">{{ armPreset?.doc.name ?? helmet.presetId }} running{{ helmet.blind ? ' (blind)' : '' }}{{ live.paused ? ' · keeps running while paused' : '' }}</template>
          <template v-else-if="helmet.stoppedAt">finished</template>
          <template v-else-if="!helmet.error">starts at “{{ steps[armRange(guide)?.first]?.title }}”</template>
          <span v-if="helmet.error" class="warn"> {{ helmet.error }}</span>
        </p>
        <p v-if="live.record?.audio.error" class="warn">{{ live.record.audio.error }}</p>
        <p v-if="live.error" class="warn">{{ live.error }}</p>
        <p v-if="live.saveError" class="bad">{{ live.saveError }}</p>
      </section>

      <details v-if="live.record?.audio.enabled" class="card level">
        <summary>Sound level</summary>
        <label class="field">T0: <b class="num">{{ live.audio.levelDb }} dB</b>
          <input type="range" :value="live.audio.levelDb" :min="-50" :max="MAX_LEVEL_DB" step="1" @input="setAudio({ levelDb: Number($event.target.value) })" @change="commitLevel" />
        </label>
      </details>

      <div class="controls" role="group" aria-label="Session controls">
        <template v-if="live.confirmNext">
          <span class="small warn">{{ live.confirmNext }} Leave this step anyway? There is no way back to it.</span>
          <button type="button" class="btn" @click="live.confirmNext = ''">Stay</button>
          <button type="button" class="btn primary" @click="confirmLeave">Leave step</button>
        </template>
        <template v-else-if="!live.confirmStop">
          <button type="button" class="btn" @click="live.paused ? resume() : pause()">{{ live.paused ? 'Resume' : 'Pause' }}</button>
          <button type="button" class="btn primary" @click="requestNext">{{ nextLabel }}</button>
          <button type="button" class="btn danger" @click="live.confirmStop = true">Stop</button>
        </template>
        <template v-else>
          <span class="small">Stop now? Audio and helmet end at once; everything so far is saved.</span>
          <button type="button" class="btn danger" @click="stop">Stop session</button>
          <button type="button" class="btn" @click="live.confirmStop = false">Continue</button>
        </template>
      </div>
    </template>

    <!-- summary -->
    <section v-else-if="live.phase === 'summary' && live.record" class="card">
      <span class="eyebrow">Summary</span>
      <RunSummary :record="live.record" :guide="guide" @saved="(r) => (live.record = r)" />
      <p v-if="live.saveError" class="small bad">{{ live.saveError }}</p>
      <div class="row"><button type="button" class="btn primary" @click="done">Done</button></div>
    </section>

    <div class="sr-only" aria-live="polite" aria-atomic="true">{{ live.announce }}</div>
  </div>
</template>

<style scoped>
.between { justify-content: space-between; }
.runner { gap: 14px; }
.title { font-size: clamp(26px, 7vw, 40px); line-height: 1.1; }
.clockrow { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.clock { font-size: clamp(48px, 16vw, 72px); line-height: 1; }
.clock.paused { color: var(--muted); }
.bar.thin { height: 3px; }
.bar.thin > i { background: var(--blue); }
.instructions { font-size: 17px; line-height: 1.6; display: grid; gap: 10px; }
.instructions :deep(p) { margin: 0; }
.instructions :deep(ul), .instructions :deep(ol) { margin: 0; padding-left: 22px; }
.status { display: grid; gap: 4px; }
.level summary { cursor: pointer; font-weight: 600; }
.controls { position: sticky; bottom: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: var(--bg); border-top: 1px solid var(--line); padding: 10px 0 calc(10px + env(safe-area-inset-bottom, 0px)); }
.controls .btn { flex: 1 1 90px; padding-block: 14px; }
.controls .small { flex: 1 1 100%; }
.interrupted { border-color: var(--warn); }
.interrupted p { margin: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
