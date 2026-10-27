// Web Audio engine for guide steps: binaural / monaural / isochronic beats over pink noise.
// Graph: per layer oscillators -> layer gains -> ChannelMerger(2) -> master -> safety
// limiter (-1 dBFS) -> destination. Pink noise (40-320 Hz) joins at the master.
// Level: master = T0 - HEADROOM_DB. A run whose peak bound (schedule.js peakBound,
// the same for real and sham) would pass PEAK_DB gets a lower master instead, so
// the limiter never acts in normal use and cannot treat real and sham differently.
// All automation is linear ramps mirrored in LinearTrack, so a transition can
// start from the exact scheduled value. Pause/resume suspend the AudioContext,
// which freezes every ramp with it; after stop() the context suspends itself.
// Monaural: both oscillators of a layer reach both ears, at 1/sqrt2 each while
// beating; towards beat 0 the right one fades out (schedule.js monauralLevels).
// Isochronic: carrier x (base + LFO * depth), the LFO a 32-harmonic PeriodicWave
// of the raised-cosine pulse, scaled so pulsed and steady tones have the power of a plain tone.
// Constant-frequency oscillators start on a common phase grid (k / f), so layers
// sharing a carrier always add the same way.
import {
  MODES, DEFAULT_CROSSFADE_S, MIN_FADE_S, DEFAULT_NOISE_DB, SWELL_DEPTH,
  dbToGain, curveAt, scaleCurve, minCurves, mulCurves, riseCurve, fallCurve, beatCurve, beatAt,
  isochronicCurves, isochronicSeries, isochronicLevels, monauralLevels, peakBound, matchLayers,
  applyCurve, LinearTrack, pinkNoise,
} from './schedule.js'

const LEAD_S = 0.03 // schedule slightly ahead of currentTime
const MODE_FADE_S = 1.5 // crossfade when the mode changes mid-step
const LEVEL_RAMP_S = 0.1
const MIN_LEVEL_DB = -90
const NOISE_SECONDS = 20 // loop long enough not to be heard repeating
const NOISE_RATE = 24000 // band-limited to 320 Hz, so a low rate is enough; the browser resamples
const LIMIT_DB = -1
const LIMIT_RATIO = 20
export const DEFAULT_LEVEL_DB = -20
export const DEFAULT_MAX_LEVEL_DB = -6
export const HEADROOM_DB = 12 // master below T0: room for stacked layers
export const PEAK_DB = -2 // static peak budget, 1 dB under the limiter
// The calibration tone carries the power of the standard four-carrier mix
// (Lane set, four tones at T0), over the standard noise bed (-15 dB re T0).
export const CALIBRATION = { carrier: 200, mixDb: 10 * Math.log10(4), noiseDb: DEFAULT_NOISE_DB }

let noiseSamples = null // generated once per page, shared by every context
const noiseData = () => (noiseSamples ??= pinkNoise(NOISE_SECONDS * NOISE_RATE, Math.random, { sampleRate: NOISE_RATE }))

const isNum = (x) => typeof x === 'number' && Number.isFinite(x)

// AudioParams driven together, with the scheduled values mirrored in a LinearTrack.
class ParamTrack {
  constructor(ctx, params, value) {
    this.ctx = ctx
    this.params = params
    this.model = new LinearTrack(value)
    for (const p of params) p.value = value
  }

  valueAt(t) {
    return this.model.valueAt(t)
  }

  // Cut the automation at t without a jump: drop future events and ramp from
  // the current value to the value scheduled for t. cancelAndHoldAtTime keeps
  // a ramp in progress; the Firefox fallback re-sets the value right after.
  hold(t) {
    const now = this.ctx.currentTime
    const v0 = this.model.valueAt(now)
    const v1 = this.model.valueAt(t)
    for (const p of this.params) {
      if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now)
      else {
        p.cancelScheduledValues(now)
        p.setValueAtTime(v0, now)
      }
      if (t > now) p.linearRampToValueAtTime(v1, t)
    }
    this.model.hold(now)
    if (t > now) this.model.ramp(t, v1)
    return v1
  }

  set(t, v) {
    if (this.model.valueAt(t) === v) return
    for (const p of this.params) p.setValueAtTime(v, t)
    this.model.set(t, v)
  }

  ramp(t, v) {
    for (const p of this.params) p.linearRampToValueAtTime(v, t)
    this.model.ramp(t, v)
  }
}

const fadeTime = (s) => Math.max(MIN_FADE_S, Number.isFinite(Number(s)) && s !== null ? Number(s) : DEFAULT_CROSSFADE_S)

export class AudioEngine {
  // onStateChange(state, { ctxState, interrupted }): called when `state` or the
  // context state changes; interrupted = suspended while a step plays without
  // pause() (iOS call, output device change), so the view can hold its timer.
  constructor({ levelDb = DEFAULT_LEVEL_DB, mode = 'binaural', maxLevelDb = DEFAULT_MAX_LEVEL_DB, onStateChange = null } = {}) {
    Object.defineProperty(this, '__v_skip', { value: true }) // Vue markRaw: never proxied
    this.ctx = null
    this._maxLevelDb = Math.min(0, isNum(maxLevelDb) ? maxLevelDb : DEFAULT_MAX_LEVEL_DB)
    this._levelDb = this._clampLevel(isNum(levelDb) ? levelDb : DEFAULT_LEVEL_DB)
    this._mode = MODES.includes(mode) ? mode : 'binaural'
    this.onStateChange = typeof onStateChange === 'function' ? onStateChange : null
    this._voices = []
    this._step = null // { audio, D, sham, T, o } of the step now playing
    this._test = null
    this._reaper = null
    this._idleTimer = 0
    this._paused = false // suspended by pause()
    this._autoSuspended = false // suspended by the engine while idle
    this._runAudios = new Set() // step audios of this run (played or planned)
    this._runBound = 0 // largest peak bound of the run so far
    this._lastNote = ''
  }

  get state() {
    const s = this.ctx?.state
    if (!s || s === 'closed' || !(this._step || this._test)) return 'idle'
    return s === 'running' ? 'running' : 'suspended'
  }

  get mode() {
    return this._mode
  }

  get levelDb() {
    return this._levelDb
  }

  get maxLevelDb() {
    return this._maxLevelDb
  }

  // Seconds into the current step on the audio clock (stands still while suspended).
  get stepTime() {
    const s = this._step
    if (!s || !this.ctx) return null
    return s.o + Math.max(0, this.ctx.currentTime - s.T)
  }

  // Call from a user gesture (tap): creates or resumes the AudioContext.
  async start() {
    const ctx = this._ensure()
    this._paused = false
    this._autoSuspended = false
    clearTimeout(this._idleTimer)
    if (ctx.state !== 'running') {
      try {
        await ctx.resume()
      } catch (e) {
        if (this.ctx === ctx) throw e // else closed meanwhile
      }
    }
    return this.state
  }

  _clampLevel(db) {
    return Math.min(this._maxLevelDb, Math.max(MIN_LEVEL_DB, db))
  }

  _ensure() {
    if (this.ctx && this.ctx.state !== 'closed') return this.ctx
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext
    if (!Ctx) throw new Error('Web Audio is not available in this browser')
    try {
      // iOS 17+: play even with the ring/silent switch on
      if (globalThis.navigator?.audioSession) navigator.audioSession.type = 'playback'
    } catch { /* not supported */ }
    const ctx = new Ctx({ latencyHint: 'playback' })
    this.ctx = ctx
    this._voices = []
    this._step = null
    this._test = null
    this._paused = false
    this._autoSuspended = false
    ctx.onstatechange = () => this._notify()

    // Safety ceiling only: the master keeps peaks under PEAK_DB. Web Audio adds an
    // automatic make-up gain of (1 / gain at 0 dBFS)^0.6; the trim undoes it.
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = LIMIT_DB
    limiter.knee.value = 0
    limiter.ratio.value = LIMIT_RATIO
    limiter.attack.value = 0.003
    limiter.release.value = 0.25
    const trim = ctx.createGain()
    trim.gain.value = dbToGain(0.6 * LIMIT_DB * (1 - 1 / LIMIT_RATIO))
    const masterGain = ctx.createGain()
    this._master = new ParamTrack(ctx, [masterGain.gain], this._masterGain())
    this._merger = ctx.createChannelMerger(2)
    this._merger.connect(masterGain)
    masterGain.connect(limiter)
    limiter.connect(trim)
    trim.connect(ctx.destination)
    this._masterNode = masterGain

    const { real, imag, mean, rms } = isochronicSeries()
    this._isoWave = ctx.createPeriodicWave(real, imag, { disableNormalization: true })
    this._iso = { mean, rms }

    const data = noiseData()
    this._noiseBuffer = ctx.createBuffer(1, data.length, NOISE_RATE)
    this._noiseBuffer.getChannelData(0).set(data)
    this._noise = this._makeNoise()
    return ctx
  }

  // The mono noise loop twice, half a loop apart: uncorrelated left and right.
  _noisePair(dest, when = 0, offsetS = 0) {
    const ctx = this.ctx
    const merge = ctx.createChannelMerger(2)
    const srcs = [0, 1].map((ch) => {
      const src = ctx.createBufferSource()
      src.buffer = this._noiseBuffer
      src.loop = true
      src.connect(merge, 0, ch)
      src.start(when, (offsetS + (ch * NOISE_SECONDS) / 2) % NOISE_SECONDS)
      return src
    })
    merge.connect(dest)
    return { srcs, nodes: [...srcs, merge] }
  }

  // Looping noise -> level -> stereo panner (swell LFO on pan) -> master.
  _makeNoise() {
    const ctx = this.ctx
    const gain = ctx.createGain()
    this._noisePair(gain)
    const noise = { level: new ParamTrack(ctx, [gain.gain], 0) }
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner()
      const lfo = ctx.createOscillator()
      const depth = ctx.createGain()
      lfo.frequency.value = 1 / 6
      lfo.connect(depth)
      depth.connect(panner.pan)
      gain.connect(panner)
      panner.connect(this._masterNode)
      noise.rate = new ParamTrack(ctx, [lfo.frequency], 1 / 6)
      noise.depth = new ParamTrack(ctx, [depth.gain], 0)
      lfo.start()
    } else {
      gain.connect(this._masterNode)
    }
    return noise
  }

  _createVoice(carrier, T) {
    const ctx = this.ctx
    const mode = this._mode
    const v = { carrier, mode, endT: null, nodes: [], oscs: [], beat: new LinearTrack(0) }
    const gain = () => {
      const g = ctx.createGain()
      v.nodes.push(g)
      return g
    }
    const osc = (hz) => {
      const o = ctx.createOscillator()
      o.frequency.value = hz
      v.oscs.push(o)
      v.nodes.push(o)
      return o
    }
    const toBoth = (n) => {
      n.connect(this._merger, 0, 0)
      n.connect(this._merger, 0, 1)
    }
    let lfo = null
    if (mode === 'isochronic') {
      // carrier -> am -> out -> both ears; am = base + depth * (pulse - mean)
      const tone = osc(carrier)
      const am = gain()
      const depth = gain()
      const out = gain()
      lfo = osc(0)
      lfo.setPeriodicWave(this._isoWave)
      v.level = new ParamTrack(ctx, [out.gain], 0)
      v.rate = new ParamTrack(ctx, [lfo.frequency], 0)
      v.depth = new ParamTrack(ctx, [depth.gain], 0)
      v.base = new ParamTrack(ctx, [am.gain], 1)
      lfo.connect(depth)
      depth.connect(am.gain)
      tone.connect(am)
      am.connect(out)
      toBoth(out)
    } else {
      const left = osc(carrier)
      const right = osc(carrier)
      v.right = new ParamTrack(ctx, [right.frequency], carrier)
      if (mode === 'binaural') {
        const earL = gain()
        const earR = gain()
        left.connect(earL)
        right.connect(earR)
        earL.connect(this._merger, 0, 0)
        earR.connect(this._merger, 0, 1)
        v.level = new ParamTrack(ctx, [earL.gain, earR.gain], 0)
      } else {
        const mixL = gain()
        const mixR = gain()
        const out = gain()
        left.connect(mixL)
        right.connect(mixR)
        mixL.connect(out)
        mixR.connect(out)
        toBoth(out)
        v.level = new ParamTrack(ctx, [out.gain], 0)
        v.mixL = new ParamTrack(ctx, [mixL.gain], 1)
        v.mixR = new ParamTrack(ctx, [mixR.gain], 0)
      }
    }
    // Tones start at a whole number of carrier periods (L/R phase-locked, and in
    // phase with any other tone on this carrier); layers with startS stay silent until then.
    const t0 = carrier > 0 ? Math.ceil(T * carrier) / carrier : T
    for (const o of v.oscs) o.start(o === lfo ? T : t0)
    this._voices.push(v)
    return v
  }

  _scheduleVoice(v, layer, { T, o, D, sham, C, fadeOutS, matched, rebuildS }) {
    const G = dbToGain(layer.gainDb ?? 0)
    const plan = beatCurve(layer, D, { sham })
    let beat = plan
    let rise
    if (matched) {
      // morph from what is playing now to the new layer over the crossfade
      const fi = fadeTime(layer.rampS ?? C)
      beat = [{ t: o, v: v.beat.valueAt(T) }, { t: o + C, v: curveAt(plan, o + C) }, ...plan.filter((p) => p.t > o + C)]
      rise = [{ t: o, v: v.level.valueAt(T) }, { t: o + fi, v: G }]
    } else {
      rise = scaleCurve(riseCurve(layer, C), G)
      // entering part-way (mode change, resume): fade in from silence
      const entry = rebuildS || (o > 0 ? C : 0)
      if (entry) rise = minCurves(rise, [{ t: o, v: 0 }, { t: o + entry, v: G }])
    }
    applyCurve(v.beat, beat, T, o)
    applyCurve(v.level, mulCurves(rise, fallCurve(D, fadeOutS)), T, o)
    const { rate, depth } = isochronicCurves(beat)
    if (v.mode === 'isochronic') {
      const { base, lfo } = isochronicLevels(depth, this._iso)
      applyCurve(v.rate, rate, T, o)
      applyCurve(v.depth, lfo, T, o)
      applyCurve(v.base, base, T, o)
      return
    }
    applyCurve(v.right, beat.map((p) => ({ t: p.t, v: v.carrier + p.v })), T, o)
    if (v.mode === 'monaural') {
      const { left, right } = monauralLevels(depth)
      applyCurve(v.mixL, left, T, o)
      applyCurve(v.mixR, right, T, o)
    }
  }

  _fadeOutVoice(v, T, f) {
    v.level.hold(T)
    v.level.ramp(T + f, 0)
    v.endT = T + f + 0.05
    if (!this._reaper) this._reaper = setInterval(() => this._reap(), 500)
  }

  _dispose(v) {
    for (const o of v.oscs) {
      try { o.stop() } catch { /* not started */ }
    }
    for (const n of v.nodes) {
      try { n.disconnect() } catch { /* already */ }
    }
    this._voices = this._voices.filter((x) => x !== v)
  }

  // Stops and disconnects voices whose fade-out has finished (in context time,
  // so a paused context keeps them).
  _reap() {
    const now = this.ctx?.currentTime ?? Infinity
    for (const v of [...this._voices]) if (v.endT != null && now >= v.endT) this._dispose(v)
    if (!this._voices.some((v) => v.endT != null)) {
      clearInterval(this._reaper)
      this._reaper = null
    }
  }

  _tones(audio, { T, o, D, sham, C, rebuildS = 0 }) {
    const layers = Array.isArray(audio?.layers) ? audio.layers : []
    const live = rebuildS ? [] : this._voices.filter((v) => v.mode === this._mode)
    const pairs = matchLayers(
      live.map((v) => ({ carrier: v.carrier, beat: v.beat.valueAt(T), dying: v.endT != null })),
      layers.map((l) => {
        const s = Math.max(0, Number(l.startS) || 0)
        return { carrier: Number(l.carrier) || 0, beat: sham ? 0 : beatAt(l.beat, o - s, D - s, l.rampS), eligible: s <= o }
      }),
    )
    const keep = new Set()
    layers.forEach((layer, i) => {
      const matched = pairs[i] >= 0
      const v = matched ? live[pairs[i]] : this._createVoice(Number(layer.carrier) || 0, T)
      v.endT = null
      keep.add(v)
      this._scheduleVoice(v, layer, { T, o, D, sham, C, fadeOutS: audio?.fadeOutS, matched, rebuildS })
    })
    for (const v of this._voices) if (!keep.has(v) && (v.endT == null || rebuildS)) this._fadeOutVoice(v, T, rebuildS || C)
  }

  _noiseTo(noise, { T, o, D, C, fadeOutS }) {
    const n = this._noise
    const G = noise ? dbToGain(noise.levelDb ?? DEFAULT_NOISE_DB) : 0
    const rise = [{ t: o, v: n.level.valueAt(T) }, { t: o + C, v: G }]
    applyCurve(n.level, mulCurves(rise, fallCurve(D, fadeOutS)), T, o)
    if (!n.depth) return
    const swell = noise?.swellS > 0
    n.depth.hold(T)
    n.depth.ramp(T + C, swell ? SWELL_DEPTH : 0)
    if (swell) {
      n.rate.hold(T)
      n.rate.ramp(T + C, 1 / noise.swellS)
    }
  }

  // ---------------------------------------------------------------- level
  _masterGain() {
    const t0 = dbToGain(this._levelDb - HEADROOM_DB)
    return this._runBound > 0 ? Math.min(t0, dbToGain(PEAK_DB) / this._runBound) : t0
  }

  // Ramps the master from now to its target, reached at endT.
  _levelTo(endT) {
    if (!this.ctx || !this._master) return
    const g = this._masterGain()
    if (this._master.valueAt(Infinity) === g) return
    const now = this.ctx.currentTime
    this._master.hold(now)
    this._master.ramp(Math.max(endT, now), g)
  }

  // Adds a step to the run's peak bound. It only grows within a run, so the
  // master only drops, and play() has it down by T, before the step's layers rise.
  _grow(audio) {
    if (audio) this._runAudios.add(audio)
    for (const a of this._runAudios) this._runBound = Math.max(this._runBound, peakBound(a, this._mode))
  }

  // Optional: the step audios of the coming run (e.g. guide.steps.map((s) => s.audio)),
  // so one level covers the whole guide instead of dropping at its densest step.
  planHeadroom(audios = []) {
    for (const a of audios) if (a) this._runAudios.add(a)
    this._grow(null)
    this._levelTo((this.ctx?.currentTime ?? 0) + LEVEL_RAMP_S)
  }

  // T0 (per tone, relative to the calibration), clamped to maxLevelDb; anything
  // but a finite number is ignored.
  setLevelDb(db) {
    if (!isNum(db)) return this._levelDb
    this._levelDb = this._clampLevel(db)
    if (this.ctx) this._levelTo(this.ctx.currentTime + LEVEL_RAMP_S)
    return this._levelDb
  }

  // ---------------------------------------------------------------- transport
  // Transition to a step's audio (null = silence) over its crossfadeS.
  // durationS: step length (omit for open-ended steps); offsetS: start part-way into the step.
  play(stepAudio, { durationS, sham = false, offsetS = 0 } = {}) {
    const ctx = this._ensure()
    clearTimeout(this._idleTimer)
    if (this._autoSuspended) {
      this._autoSuspended = false
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    }
    const audio = stepAudio || null
    const T = ctx.currentTime + LEAD_S
    const o = Math.max(0, Number(offsetS) || 0)
    const D = Number(durationS) > 0 ? Number(durationS) : Infinity
    const C = fadeTime(audio?.crossfadeS ?? DEFAULT_CROSSFADE_S)
    this._step = { audio, D, sham: !!sham, T, o }
    this._grow(audio)
    this._levelTo(T)
    this._tones(audio, { T, o, D, sham: !!sham, C })
    this._noiseTo(audio?.noise, { T, o, D, C, fadeOutS: audio?.fadeOutS })
    this._notify()
  }

  pause() {
    if (this.ctx?.state !== 'running') return Promise.resolve()
    this._paused = true
    clearTimeout(this._idleTimer)
    return this.ctx.suspend()
  }

  resume() {
    this._paused = false
    this._autoSuspended = false
    return this.ctx && this.ctx.state !== 'closed' && this.ctx.state !== 'running' ? this.ctx.resume() : Promise.resolve()
  }

  stop(fadeS = 0.5) {
    const ctx = this.ctx
    if (!ctx || ctx.state === 'closed') return
    this._step = null
    this._stopTest()
    this._runAudios.clear()
    this._runBound = 0 // the next play() or testTone() sets the master
    this._paused = false
    const now = ctx.currentTime
    if (ctx.state !== 'running') {
      // paused: a fade would not be heard; cut now (silent until resumed)
      for (const v of [...this._voices]) this._dispose(v)
      this._noise.level.hold(now)
      this._noise.level.set(now, 0)
      this._autoSuspended = true
      this._notify()
      return
    }
    const T = now + LEAD_S
    const f = Math.max(MIN_FADE_S, Number(fadeS) || 0)
    for (const v of this._voices) this._fadeOutVoice(v, T, f)
    this._noise.level.hold(T)
    this._noise.level.ramp(T + f, 0)
    this._suspendWhenSilent(T + f + 0.05)
    this._notify()
  }

  // Once idle and silent (context time endT), frees the voices and suspends the
  // context, so the noise loop and LFOs stop using CPU; play() or start() wakes it.
  _suspendWhenSilent(endT) {
    clearTimeout(this._idleTimer)
    const check = () => {
      this._idleTimer = 0
      const ctx = this.ctx
      if (!ctx || ctx.state !== 'running' || this._step || this._test) return
      const wait = endT - ctx.currentTime
      if (wait > 0) {
        this._idleTimer = setTimeout(check, wait * 1000 + 50)
        return
      }
      for (const v of [...this._voices]) this._dispose(v)
      this._reap()
      this._autoSuspended = true
      ctx.suspend().catch(() => {})
    }
    this._idleTimer = setTimeout(check, Math.max(0, endT - this.ctx.currentTime) * 1000 + 50)
  }

  // Releases the AudioContext (e.g. when the view unmounts).
  async close() {
    clearInterval(this._reaper)
    this._reaper = null
    clearTimeout(this._idleTimer)
    this._idleTimer = 0
    const ctx = this.ctx
    const test = this._test
    this.ctx = null
    this._voices = []
    this._step = null
    this._test = null
    this._runAudios.clear()
    this._runBound = 0
    test?.done()
    if (ctx) ctx.onstatechange = null
    this._notify()
    if (ctx && ctx.state !== 'closed') await ctx.close()
  }

  setMode(mode) {
    if (!MODES.includes(mode)) throw new Error(`Unknown audio mode: ${mode}`)
    if (mode === this._mode) return
    this._mode = mode
    const s = this._step
    if (!s || !this.ctx) return
    const T = this.ctx.currentTime + LEAD_S
    const o = s.o + (T - s.T)
    const C = fadeTime(s.audio?.crossfadeS ?? DEFAULT_CROSSFADE_S)
    this._grow(null)
    this._levelTo(T)
    this._tones(s.audio, { T, o, D: s.D, sham: s.sham, C, rebuildS: MODE_FADE_S })
  }

  _notify() {
    const cb = this.onStateChange
    if (!cb) return
    const ctxState = this.ctx?.state ?? 'closed'
    const state = this.state
    const interrupted = state === 'suspended' && !this._paused
    const note = `${state} ${ctxState} ${interrupted}`
    if (note === this._lastNote) return
    this._lastNote = note
    try {
      cb(state, { ctxState, interrupted })
    } catch (e) {
      console.error(e)
    }
  }

  // ---------------------------------------------------------------- calibration
  // 200 Hz in both ears at the power of the standard four-tone mix at T0, over the
  // standard noise bed (-15 dB re T0), so T0 is judged on the loudness the guides play.
  // Resolves when the tone ends, is stopped, or the engine closes; also after
  // seconds + 1 s of wall time if the context is suspended. setLevelDb() during the tone is heard live.
  async testTone(seconds = 3) {
    await this.start()
    const ctx = this.ctx
    if (!ctx || ctx.state === 'closed') return
    clearTimeout(this._idleTimer)
    this._stopTest()
    const T = ctx.currentTime + LEAD_S
    this._levelTo(T)
    const dur = Math.max(0.5, Number(seconds) || 3)
    const end = T + dur
    const osc = ctx.createOscillator()
    osc.frequency.value = CALIBRATION.carrier
    const tone = ctx.createGain()
    osc.connect(tone)
    tone.connect(this._merger, 0, 0)
    tone.connect(this._merger, 0, 1)
    const bed = ctx.createGain()
    const pair = this._noisePair(bed, T, Math.random() * NOISE_SECONDS)
    bed.connect(this._masterNode)
    const test = { sources: [osc, ...pair.srcs], nodes: [osc, tone, bed, ...pair.nodes], gains: [], done: null }
    const finished = new Promise((resolve) => (test.done = resolve))
    for (const [node, peak] of [[tone, dbToGain(CALIBRATION.mixDb)], [bed, dbToGain(CALIBRATION.noiseDb)]]) {
      const g = new ParamTrack(ctx, [node.gain], 0)
      applyCurve(g, [{ t: 0, v: 0 }, { t: MIN_FADE_S, v: peak }, { t: dur - MIN_FADE_S, v: peak }, { t: dur, v: 0 }], T)
      test.gains.push(g)
    }
    osc.start(T)
    for (const s of test.sources) s.stop(end)
    osc.onended = () => test.done()
    const timer = setTimeout(() => test.done(), (dur + 1) * 1000)
    this._test = test
    this._notify()
    await finished
    clearTimeout(timer)
    for (const n of test.nodes) {
      try { n.disconnect() } catch { /* already */ }
    }
    if (this._test === test) this._test = null
    if (this.ctx === ctx) {
      this._notify()
      if (!this._step && !this._test && ctx.state === 'running') this._suspendWhenSilent(ctx.currentTime)
    }
  }

  // Ends a running test tone with a short fade.
  _stopTest() {
    const t = this._test
    if (!t) return
    this._test = null
    const T = this.ctx.currentTime + LEAD_S
    for (const g of t.gains) {
      g.hold(T)
      g.ramp(T + MIN_FADE_S, 0)
    }
    for (const s of t.sources) {
      try { s.stop(T + MIN_FADE_S + 0.01) } catch { /* ended */ }
    }
    // resolve testTone() after the fade, even if the context is not running
    setTimeout(t.done, (LEAD_S + MIN_FADE_S + 0.05) * 1000)
  }
}
