// Guide audio: pure timing maths (src/audio/schedule.js) and the Web Audio
// engine (src/audio/engine.js) against a small AudioContext mock.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reactive, isProxy } from '@vue/reactivity'

import {
  MODES, DEFAULT_CROSSFADE_S, MIN_FADE_S, ISO_MEAN, ISO_RMS, SWELL_DEPTH, dbToGain, beatAt, layerAt, isochronicEnvelope,
  isochronicSeries, seriesAt, isochronicCurves, isochronicLevels, monauralLevels, mapCurve, peakBound, curveAt, minCurves,
  mulCurves, levelCurve, beatCurve, matchLayers, LinearTrack, applyCurve, pinkNoise,
} from '../src/audio/schedule.js'
import { AudioEngine, CALIBRATION, HEADROOM_DB, PEAK_DB } from '../src/audio/engine.js'

const near = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`)

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test('modes', () => {
  assert.deepEqual(MODES, ['binaural', 'monaural', 'isochronic'])
})

test('dbToGain', () => {
  assert.equal(dbToGain(0), 1)
  near(dbToGain(-20), 0.1)
  near(dbToGain(-6), 0.501187, 1e-6)
  near(dbToGain(6), 1.995262, 1e-6)
  assert.equal(dbToGain(-Infinity), 0)
  assert.equal(dbToGain(undefined), 1)
  assert.equal(dbToGain(NaN), 0)
})

test('beatAt: constants and glides', () => {
  assert.equal(beatAt(4, 100, 60), 4)
  assert.equal(beatAt(0, 5, 60), 0)
  assert.equal(beatAt(null, 5, 60), 0)
  const glide = { from: 10, to: 7 }
  // over the step
  assert.equal(beatAt(glide, 0, 60), 10)
  near(beatAt(glide, 30, 60), 8.5)
  assert.equal(beatAt(glide, 60, 60), 7)
  assert.equal(beatAt(glide, 90, 60), 7)
  assert.equal(beatAt(glide, -5, 60), 10)
  // over rampS, then held
  near(beatAt({ from: 0, to: 16 }, 15, 720, 60), 4)
  assert.equal(beatAt({ from: 0, to: 16 }, 60, 720, 60), 16)
  assert.equal(beatAt({ from: 0, to: 16 }, 500, 720, 60), 16)
  // open-ended step without rampS stays at `from`; zero-length jumps to `to`
  assert.equal(beatAt(glide, 30, undefined), 10)
  assert.equal(beatAt(glide, 30, Infinity), 10)
  assert.equal(beatAt(glide, 0, 0), 7)
  // missing `to` = constant
  assert.equal(beatAt({ from: 3 }, 30, 60), 3)
})

test('layerAt: carriers, beat, sham', () => {
  const l = layerAt({ carrier: 200, beat: 10 }, 30, 120)
  assert.equal(l.leftHz, 200)
  assert.equal(l.rightHz, 210)
  assert.equal(l.active, true)
  assert.equal(l.gainDb, 0)
  const g = layerAt({ carrier: 200, beat: { from: 10, to: 7 } }, 30, 60)
  near(g.rightHz, 208.5)
  const s = layerAt({ carrier: 200, beat: { from: 10, to: 7 } }, 30, 60, { sham: true })
  assert.equal(s.leftHz, 200)
  assert.equal(s.rightHz, 200)
  assert.equal(s.beatHz, 0)
  assert.equal(layerAt({ carrier: 100, beat: 1.5 }, 12, 360, { sham: true }).rightHz, 100)
})

test('layerAt: gainDb, startS and rampS', () => {
  const layer = { carrier: 300, beat: { from: 0, to: 16 }, gainDb: -10, startS: 120, rampS: 60 }
  const before = layerAt(layer, 60, 720)
  assert.equal(before.active, false)
  assert.equal(before.gainDb, -Infinity)
  assert.equal(before.rightHz, 300) // glide not started
  const start = layerAt(layer, 120, 720)
  assert.equal(start.active, true)
  assert.equal(start.gainDb, -Infinity) // fade-in starts at 0
  const half = layerAt(layer, 150, 720)
  near(half.gainDb, -10 + 20 * Math.log10(0.5), 1e-9, 'half-way through the fade-in')
  near(half.rightHz, 308)
  const full = layerAt(layer, 200, 720)
  assert.equal(full.gainDb, -10)
  assert.equal(full.rightHz, 316)
  // rampS absent: fade-in over the crossfade (default 10 s), glide over the rest of the step
  const l2 = { carrier: 200, beat: { from: 4, to: 8 }, gainDb: -3, startS: 60 }
  near(layerAt(l2, 65, 360).gainDb, -3 + 20 * Math.log10(0.5))
  assert.equal(layerAt(l2, 70, 360).gainDb, -3)
  assert.equal(layerAt(l2, 65, 360, { crossfadeS: 20 }).fade, 0.25)
  near(layerAt(l2, 210, 360).rightHz, 206)
  // rampS 0 still fades over MIN_FADE_S (no clicks)
  assert.equal(layerAt({ carrier: 100, beat: 0, rampS: 0 }, MIN_FADE_S, 60).gainDb, 0)
  assert.ok(layerAt({ carrier: 100, beat: 0, rampS: 0 }, MIN_FADE_S / 2, 60).gainDb < -5)
})

test('layerAt: fade-out at the step end', () => {
  const layer = { carrier: 200, beat: 16, gainDb: -3, rampS: 1 }
  assert.equal(layerAt(layer, 100, 180, { fadeOutS: 30 }).gainDb, -3)
  near(layerAt(layer, 165, 180, { fadeOutS: 30 }).fade, 0.5)
  assert.equal(layerAt(layer, 180, 180, { fadeOutS: 30 }).gainDb, -Infinity)
  // open-ended steps never fade out
  assert.equal(layerAt(layer, 1e5, undefined, { fadeOutS: 30 }).gainDb, -3)
})

test('beatCurve agrees with beatAt', () => {
  const layers = [
    { carrier: 300, beat: { from: 0, to: 16 }, startS: 20, rampS: 60 },
    { carrier: 100, beat: { from: 1.5, to: 1 } },
    { carrier: 200, beat: 4 },
  ]
  for (const layer of layers) {
    const c = beatCurve(layer, 300)
    for (let t = 0; t <= 300; t += 7.5) near(curveAt(c, t), layerAt(layer, t, 300).beatHz, 1e-9, `${layer.carrier} at ${t}`)
    assert.deepEqual(beatCurve(layer, 300, { sham: true }), [{ t: 0, v: 0 }])
  }
})

test('isochronic envelope: raised cosine, 0..1, 50 % duty', () => {
  assert.equal(isochronicEnvelope(0.3, 0), 1) // beat 0 = steady tone
  const rate = 4
  const n = 40000
  let on = 0
  let sum = 0
  let max = 0
  let min = Infinity
  for (let i = 0; i < n; i++) {
    const t = i / (n * rate) // one period
    const e = isochronicEnvelope(t, rate)
    assert.ok(e >= 0 && e <= 1)
    if (e > 0) on++
    sum += e
    max = Math.max(max, e)
    min = Math.min(min, e)
  }
  near(on / n, 0.5, 1e-3, 'duty')
  near(sum / n, 0.25, 1e-4, 'mean')
  near(max, 1, 1e-6)
  assert.equal(min, 0)
  near(isochronicEnvelope(1 / 16, 4), 1, 1e-12, 'peak at a quarter period')
  near(isochronicEnvelope(1 / 32, 4), 0.5, 1e-12, 'raised cosine')
  assert.equal(isochronicEnvelope(3 / 16, 4), 0, 'silent half')
  near(isochronicEnvelope(10 + 1 / 16, 4), 1, 1e-9, 'periodic')
})

test('isochronic PeriodicWave series approximates the envelope', () => {
  const s = isochronicSeries()
  near(s.mean, 0.25, 1e-6)
  near(s.rms, Math.sqrt(3 / 16), 1e-6)
  assert.equal(s.real[0], 0)
  let worst = 0
  for (let i = 0; i < 1000; i++) {
    const p = i / 1000
    worst = Math.max(worst, Math.abs(seriesAt(s, p) - isochronicEnvelope(p, 1)))
  }
  assert.ok(worst < 3e-4, `max error ${worst}`)
})

test('isochronic rate/depth curves', () => {
  const { rate, depth } = isochronicCurves([{ t: 0, v: 0 }, { t: 60, v: 16 }])
  near(curveAt(rate, 30), 8)
  assert.equal(curveAt(depth, 0), 0)
  near(curveAt(depth, 60 * (0.25 / 16)), 0.5, 1e-9)
  assert.equal(curveAt(depth, 60 * (0.5 / 16)), 1)
  assert.equal(curveAt(depth, 30), 1)
  const steady = isochronicCurves([{ t: 0, v: 0 }])
  assert.equal(curveAt(steady.depth, 5), 0)
  // a glide through zero keeps |beat|
  const z = isochronicCurves([{ t: 0, v: -2 }, { t: 4, v: 2 }])
  assert.equal(curveAt(z.rate, 2), 0)
  near(curveAt(z.rate, 1), 1)
})

test('curve helpers', () => {
  const a = [{ t: 0, v: 0 }, { t: 10, v: 1 }]
  const b = [{ t: 4, v: 1 }, { t: 8, v: 0 }]
  assert.equal(curveAt(a, -1), 0)
  assert.equal(curveAt(a, 5), 0.5)
  assert.equal(curveAt(a, 11), 1)
  const m = minCurves(a, b)
  for (let t = -1; t <= 12; t += 0.25) near(curveAt(m, t), Math.min(curveAt(a, t), curveAt(b, t)), 1e-9, `min at ${t}`)
  const p = mulCurves(a, b)
  for (let t = -1; t <= 12; t += 0.25) near(curveAt(p, t), curveAt(a, t) * curveAt(b, t), 0.02, `mul at ${t}`)
  // fade-in shorter than the fade-out window: exact product
  const lc = levelCurve({ rampS: 5 }, 60, { fadeOutS: 10 })
  assert.equal(curveAt(lc, 2.5), 0.5)
  assert.equal(curveAt(lc, 30), 1)
  assert.equal(curveAt(lc, 55), 0.5)
  assert.equal(DEFAULT_CROSSFADE_S, 10)
})

test('LinearTrack mirrors linear automation and holds without jumps', () => {
  const tr = new LinearTrack(0)
  tr.set(1, 0)
  tr.ramp(11, 1)
  near(tr.valueAt(6), 0.5)
  assert.equal(tr.hold(6), 0.5)
  near(tr.valueAt(3.5), 0.25) // the past is kept up to the hold
  assert.equal(tr.valueAt(20), 0.5)
  tr.ramp(16, 0)
  near(tr.valueAt(11), 0.25)
  // applyCurve: step time 0 at t = 100, starting 30 s into the step
  const c = new LinearTrack(5)
  applyCurve(c, [{ t: 0, v: 10 }, { t: 60, v: 7 }], 100, 30)
  near(c.valueAt(100), 8.5)
  near(c.valueAt(115), 7.75)
  assert.equal(c.valueAt(130), 7)
})

test('matchLayers keeps shared carriers and prefers the closest beat', () => {
  const voices = [
    { carrier: 300, beat: 0 },
    { carrier: 300, beat: 16 },
    { carrier: 200, beat: 10, dying: true },
    { carrier: 100, beat: 1.5 },
  ]
  const layers = [
    { carrier: 300, beat: 16 },
    { carrier: 300, beat: 0 },
    { carrier: 200, beat: 4 },
    { carrier: 250, beat: 4 },
    { carrier: 100, beat: 1.5, eligible: false }, // starts later in the step
  ]
  assert.deepEqual(matchLayers(voices, layers), [1, 0, 2, -1, -1])
  assert.deepEqual(matchLayers([], layers), [-1, -1, -1, -1, -1])
})

// Power per band [lo, hi) Hz: Welch average of Hann-windowed FFT segments.
function bandPower(x, rate, bands, size = 1 << 14) {
  const out = bands.map(() => 0)
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  for (let s = 0; s + size <= x.length; s += size / 2) {
    for (let i = 0; i < size; i++) {
      re[i] = x[s + i] * Math.sin((Math.PI * i) / size) ** 2
      im[i] = 0
    }
    fft(re, im)
    bands.forEach(([lo, hi], b) => {
      for (let k = Math.ceil((lo * size) / rate); k < (hi * size) / rate; k++) out[b] += re[k] ** 2 + im[k] ** 2
    })
  }
  return out
}

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(a * k)
        const sn = Math.sin(a * k)
        const p = i + k
        const q = p + len / 2
        const tr = re[q] * c - im[q] * sn
        const ti = re[q] * sn + im[q] * c
        re[q] = re[p] - tr
        im[q] = im[p] - ti
        re[p] += tr
        im[p] += ti
      }
    }
  }
}

const db = (x) => 10 * Math.log10(x)

test('pink noise: level, Lane band 40-320 Hz, loop seam', () => {
  const rate = 24000
  const n = 1 << 18
  const x = pinkNoise(n, mulberry32(7), { sampleRate: rate })
  let sq = 0
  let mean = 0
  for (const v of x) {
    assert.ok(Number.isFinite(v))
    sq += v * v
    mean += v
  }
  near(Math.sqrt(sq / n), Math.SQRT1_2, 1e-4, 'rms')
  near(mean / n, 0, 1e-6, 'dc')
  const [lo, o1, o2, o3, hi, all] = bandPower(x, rate, [[10, 20], [40, 80], [80, 160], [160, 320], [640, 1280], [0, rate / 2]])
  // pink inside the band (equal power per octave), 12 dB/octave outside
  assert.ok(Math.abs(db(o2 / o3)) < 2, `80-160 vs 160-320: ${db(o2 / o3)}`)
  assert.ok(Math.abs(db(o2 / o1)) < 2, `80-160 vs 40-80: ${db(o2 / o1)}`)
  assert.ok(db(o2 / hi) > 15, `640-1280 Hz: ${db(hi / o2)} dB`)
  assert.ok(db(o2 / lo) > 15, `10-20 Hz: ${db(lo / o2)} dB`)
  assert.ok((o1 + o2 + o3) / all > 0.75, `in-band share ${(o1 + o2 + o3) / all}`)
  // full band on request: still pink (octaves equal), much more above 320 Hz
  const f = pinkNoise(n, mulberry32(7), { sampleRate: rate, lowHz: null, highHz: null })
  const [f2, f3, fhi] = bandPower(f, rate, [[80, 160], [160, 320], [640, 1280]])
  assert.ok(Math.abs(db(f2 / f3)) < 1.5 && Math.abs(db(f2 / fhi)) < 1.5, 'full-band pink')
  // wrap-around step is like any neighbouring-sample step
  let d = 0
  for (let i = 1; i < n; i++) d += (x[i] - x[i - 1]) ** 2
  const rmsStep = Math.sqrt(d / (n - 1))
  assert.ok(Math.abs(x[0] - x[n - 1]) < 5 * rmsStep, 'seam')
})

test('mapCurve: chords where the value changes', () => {
  const c = mapCurve([{ t: 0, v: 0 }, { t: 8, v: 1 }, { t: 10, v: 1 }], (v) => v * v, 4)
  assert.equal(c.length, 6)
  near(curveAt(c, 4), 0.25)
  near(curveAt(c, 9), 1)
  assert.deepEqual(mapCurve([{ t: 0, v: 2 }], (v) => -v), [{ t: 0, v: -2 }])
})

test('monaural levels: one-tone power at every depth, right tone silent at beat 0', () => {
  const { left, right } = monauralLevels([{ t: 0, v: 0 }, { t: 1, v: 1 }])
  for (let t = 0; t <= 1; t += 1 / 64) near(curveAt(left, t) ** 2 + curveAt(right, t) ** 2, 1, 3e-3, `power at ${t}`)
  assert.equal(curveAt(left, 0), 1)
  assert.equal(curveAt(right, 0), 0)
  near(curveAt(left, 1), Math.SQRT1_2)
  near(curveAt(right, 1), Math.SQRT1_2)
  // from a glide to beat 0, via isochronicCurves' depth
  const { depth } = isochronicCurves([{ t: 0, v: 1.5 }, { t: 30, v: 0 }])
  const m = monauralLevels(depth)
  near(curveAt(m.right, 10), Math.SQRT1_2)
  assert.equal(curveAt(m.right, 30), 0)
  assert.equal(curveAt(m.left, 30), 1)
})

test('isochronic levels: same power as a plain tone at every depth', () => {
  for (const d of [0, 0.25, 0.5, 0.75, 1]) {
    const { base, lfo } = isochronicLevels([{ t: 0, v: d }])
    const b = base[0].v
    const k = lfo[0].v
    let sq = 0
    let min = Infinity
    let max = 0
    const n = 20000
    for (let i = 0; i < n; i++) {
      const am = b + k * (isochronicEnvelope(i / n, 1) - ISO_MEAN)
      sq += am * am
      min = Math.min(min, am)
      max = Math.max(max, am)
    }
    near(sq / n, 1, 1e-6, `power at depth ${d}`)
    assert.ok(min >= -1e-9, `never negative at depth ${d}`)
    if (d === 1) near(max, 1 / ISO_RMS, 1e-6, 'pulse peak')
  }
  assert.deepEqual(isochronicLevels([{ t: 0, v: 0 }]), { base: [{ t: 0, v: 1 }], lfo: [{ t: 0, v: 0 }] })
})

test('peakBound: layers by mode, plus the noise crest and swell', () => {
  const lane = { layers: [{ carrier: 100, beat: 1.5 }, { carrier: 200, beat: 4 }, { carrier: 250, beat: 4 }, { carrier: 300, beat: 0 }] }
  assert.equal(peakBound(lane), 4)
  near(peakBound(lane, 'monaural'), 4 * Math.SQRT2)
  near(peakBound(lane, 'isochronic'), 4 / ISO_RMS)
  near(peakBound({ layers: [{ carrier: 1, gainDb: -6 }, { carrier: 2, gainDb: -6 }] }), 2 * dbToGain(-6))
  const n = dbToGain(-15) * Math.SQRT1_2 * 4
  near(peakBound({ ...lane, noise: { levelDb: -15 } }), 4 + n)
  near(peakBound({ ...lane, noise: {} }), 4 + n)
  const pan = Math.sin((SWELL_DEPTH * Math.PI) / 2)
  near(peakBound({ ...lane, noise: { levelDb: -15, swellS: 6 } }), 4 + n * Math.sqrt(1 + pan * pan))
  assert.equal(peakBound(null), 0)
})

// ------------------------------------------------------------ Web Audio mock
// AudioParam automation as in the spec (set, linear ramps, cancel, hold), nodes
// with their connections, sources with start/stop/onended. ampsAt() follows the
// connections to the destination and multiplies the gains on the way.
const mockOpts = { hold: true }

class Param {
  constructor(ctx, value, owner) {
    this.ctx = ctx
    this.owner = owner
    this.intrinsic = value
    this.events = []
    this.inputs = []
    ctx.params.push(this)
    if (!mockOpts.hold) this.cancelAndHoldAtTime = undefined // Firefox
  }

  get value() {
    return this.valueAt(this.ctx.currentTime)
  }

  set value(v) {
    if (!Number.isFinite(v)) throw new TypeError(`non-finite value ${v}`)
    if (this.events.length) this.setValueAtTime(v, this.ctx.currentTime)
    else this.intrinsic = v
  }

  _insert(e) {
    if (!Number.isFinite(e.time) || !Number.isFinite(e.value)) throw new TypeError(`non-finite event ${JSON.stringify(e)}`)
    if (e.time < 0) throw new RangeError('negative time')
    let i = this.events.length
    while (i > 0 && this.events[i - 1].time > e.time) i--
    this.events.splice(i, 0, e)
    return this
  }

  setValueAtTime(value, time) {
    return this._insert({ type: 'set', value, time })
  }

  linearRampToValueAtTime(value, time) {
    return this._insert({ type: 'ramp', value, time })
  }

  cancelScheduledValues(time) {
    this.events = this.events.filter((e) => e.time < time)
    return this
  }

  cancelAndHoldAtTime(time) {
    const value = this.valueAt(time)
    const next = this.events.find((e) => e.time >= time)
    this.events = this.events.filter((e) => e.time < time)
    return this._insert({ type: next?.type === 'ramp' ? 'ramp' : 'set', value, time })
  }

  valueAt(t) {
    const ev = this.events
    let i = -1
    for (let k = 0; k < ev.length && ev[k].time <= t; k++) i = k
    if (i < 0) return this.intrinsic
    const next = ev[i + 1]
    if (next?.type === 'ramp') return ev[i].value + ((next.value - ev[i].value) * (t - ev[i].time)) / (next.time - ev[i].time)
    return ev[i].value
  }
}

class Node {
  constructor(ctx, kind) {
    this.ctx = ctx
    this.kind = kind
    this.outs = []
    this.disconnected = false
    ctx.nodes.push(this)
  }

  connect(target, out = 0, inp = 0) {
    if (!target) throw new Error('connect to nothing')
    if (target instanceof Param) target.inputs.push(this)
    else if (target.kind === 'merger' && !(inp >= 0 && inp < 2)) throw new Error('bad merger input')
    this.outs.push({ target, inp })
    return target
  }

  disconnect() {
    this.outs = []
    this.disconnected = true
  }
}

class Source extends Node {
  constructor(ctx, kind) {
    super(ctx, kind)
    this.started = null
    this.offset = 0
    this.stopped = null
    this.onended = null
  }

  start(t = 0, offset = 0) {
    if (this.started != null) throw new Error('InvalidStateError: start twice')
    this.started = t
    this.offset = offset
  }

  stop(t = 0) {
    if (this.started == null) throw new Error('InvalidStateError: stop before start')
    this.stopped = t
  }
}

class MockContext {
  constructor() {
    this.currentTime = 0
    this.state = 'suspended'
    this.sampleRate = 48000
    this.nodes = []
    this.params = []
    this.onstatechange = null
    this.destination = new Node(this, 'destination')
    MockContext.last = this
  }

  _set(state) {
    if (this.state === 'closed') throw new Error('InvalidStateError: closed')
    if (state === this.state) return Promise.resolve()
    this.state = state
    this.onstatechange?.()
    return Promise.resolve()
  }

  resume() {
    return this._set('running')
  }

  suspend() {
    return this._set('suspended')
  }

  close() {
    return this._set('closed')
  }

  advance(dt) {
    if (this.state !== 'running') return
    this.currentTime += dt
    for (const n of this.nodes) {
      if (n.stopped != null && !n.endedFired && this.currentTime >= n.stopped) {
        n.endedFired = true
        n.onended?.()
      }
    }
  }

  createGain() {
    const n = new Node(this, 'gain')
    n.gain = new Param(this, 1, 'gain')
    return n
  }

  createOscillator() {
    const n = new Source(this, 'osc')
    n.frequency = new Param(this, 440, 'frequency')
    n.setPeriodicWave = (w) => (n.wave = w)
    return n
  }

  createChannelMerger(k) {
    const n = new Node(this, 'merger')
    n.k = k
    return n
  }

  createDynamicsCompressor() {
    const n = new Node(this, 'comp')
    for (const p of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[p] = new Param(this, 0, p)
    return n
  }

  createStereoPanner() {
    const n = new Node(this, 'panner')
    n.pan = new Param(this, 0, 'pan')
    return n
  }

  createBufferSource() {
    const n = new Source(this, 'buffer')
    n.loop = false
    return n
  }

  createBuffer(channels, length, rate) {
    if (!(rate >= 22050 && rate <= 96000)) throw new Error(`NotSupportedError: sample rate ${rate}`) // older Safari range
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    return { numberOfChannels: channels, length, sampleRate: rate, duration: length / rate, getChannelData: (c) => data[c] }
  }

  createPeriodicWave(real, imag, opts) {
    if (real.length !== imag.length) throw new Error('length mismatch')
    return { real, imag, opts }
  }
}
globalThis.AudioContext = MockContext

const gainOf = (node, t) => (node.kind === 'gain' ? node.gain.valueAt(t) : 1)

// [[channel, gain]] of every path from node to the destination
function paths(node, t, ch = null) {
  if (node.kind === 'destination') return ch == null ? [[0, 1], [1, 1]] : [[ch, 1]]
  const out = []
  for (const { target, inp } of node.outs) {
    if (target instanceof Param) continue
    const g = gainOf(target, t)
    for (const [c, h] of paths(target, t, target.kind === 'merger' ? inp : ch)) out.push([c, g * h])
  }
  return out
}

// Amplitude of a source in each ear (0 when not playing).
function ampsAt(src, t) {
  const a = [0, 0]
  if (src.started == null || t < src.started || (src.stopped != null && t >= src.stopped)) return a
  for (const [c, g] of paths(src, t)) a[c] += g
  return a
}

// Summed squared amplitudes of all tones per ear (power of distinct frequencies, x2).
function tonePower(ctx, t) {
  const p = [0, 0]
  for (const n of ctx.nodes) {
    if (n.kind !== 'osc' || n.wave || !n.outs.length || n.outs[0].target instanceof Param) continue
    const [l, r] = ampsAt(n, t)
    p[0] += l * l
    p[1] += r * r
  }
  return p
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

const timed = new WeakSet()

async function rig(t, options = {}, { hold = true } = {}) {
  if (!timed.has(t)) t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  timed.add(t)
  mockOpts.hold = hold
  const eng = new AudioEngine(options)
  await eng.start()
  return { eng, ctx: eng.ctx }
}

// Moves the audio clock (if running) and the timers together.
async function run(t, ctx, seconds, dt = 0.05, each = null) {
  for (let s = 0; s < seconds - 1e-9; s += dt) {
    ctx.advance(dt)
    t.mock.timers.tick(dt * 1000)
    each?.()
  }
  await flush()
}

const LANE = [
  { carrier: 100, beat: 1.5 },
  { carrier: 200, beat: 4 },
  { carrier: 250, beat: 4 },
  { carrier: 300, beat: 0 },
]
const RETURN = [
  { carrier: 200, beat: 16, gainDb: -3 },
  { carrier: 300, beat: 24, gainDb: -3 },
  { carrier: 100, beat: 0, gainDb: -3 },
  { carrier: 250, beat: 0, gainDb: -3 },
]
const NOISE = { levelDb: -15, swellS: 6 }
const oscsOf = (v) => v.oscs.filter((o) => !o.wave)
const master = (eng) => eng._master.valueAt(eng.ctx.currentTime)
// master x the limiter's make-up trim: the gain from the merger to the output
const scale = (eng) => master(eng) * eng.ctx.nodes.find((n) => n.kind === 'comp').outs[0].target.gain.value

test('engine: invalid levels fall back to the defaults, never to the cap', () => {
  for (const levelDb of [null, '', NaN, true, '0', undefined]) assert.equal(new AudioEngine({ levelDb }).levelDb, -20, String(levelDb))
  for (const maxLevelDb of [null, '', NaN, true]) assert.equal(new AudioEngine({ maxLevelDb }).maxLevelDb, -6, String(maxLevelDb))
  assert.equal(new AudioEngine({ maxLevelDb: 3 }).maxLevelDb, 0)
  assert.equal(new AudioEngine({ levelDb: -3 }).levelDb, -6)
  const eng = new AudioEngine({ levelDb: -30 })
  for (const v of [null, '', true, NaN, Infinity, '-3', undefined]) assert.equal(eng.setLevelDb(v), -30, String(v))
  assert.equal(eng.setLevelDb(-2), -6)
  assert.equal(eng.setLevelDb(-500), -90)
  assert.equal(eng.setLevelDb(-25), -25)
})

test('engine: Vue reactive() leaves it unwrapped, so voices survive', async (t) => {
  const { eng: raw, ctx } = await rig(t)
  const eng = reactive(raw)
  assert.equal(eng, raw)
  assert.equal(isProxy(eng), false)
  assert.equal(Object.keys(raw).includes('__v_skip'), false)
  eng.play({ layers: LANE, noise: NOISE, crossfadeS: 1 }, { durationS: 60 })
  await run(t, ctx, 2)
  assert.equal(raw._voices.length, 4)
  assert.ok(raw._voices.every((v) => v.endT == null))
})

test('engine: monaural layer gliding to beat 0 keeps its level; sham has the power of real', async (t) => {
  const { eng, ctx } = await rig(t, { mode: 'monaural' })
  const beating = { layers: [{ carrier: 100, beat: 1.5 }, { carrier: 250, beat: 4, gainDb: -6 }], crossfadeS: 1 }
  eng.play(beating, { durationS: 60 })
  await run(t, ctx, 3)
  const real = tonePower(ctx, ctx.currentTime)
  near(real[0], real[1], 1e-12, 'both ears')
  for (const v of eng._voices) {
    const [l, r] = oscsOf(v).map((o) => ampsAt(o, ctx.currentTime))
    near(l[0], r[0], 1e-12, 'pair at 1/sqrt2 each')
    near(l[0], l[1], 1e-12, 'both ears')
  }
  // the "Return" glide: the same carriers move to beat 0
  eng.play({ layers: [{ carrier: 100, beat: 0 }, { carrier: 250, beat: 0, gainDb: -6 }], crossfadeS: 2 }, { durationS: 60 })
  await run(t, ctx, 3)
  assert.equal(eng._voices.length, 2, 'morphed, not crossfaded')
  for (const v of eng._voices) {
    const [l, r] = oscsOf(v).map((o) => ampsAt(o, ctx.currentTime))
    assert.equal(r[0], 0, 'right tone faded out')
    near(l[0] / scale(eng), dbToGain(v.carrier === 100 ? 0 : -6), 1e-6, 'left tone at the layer gain')
  }
  const zero = tonePower(ctx, ctx.currentTime)
  near(zero[0], real[0], 1e-9, 'same power at beat 0')
  // sham: all beats 0 from the start
  const s = await rig(t, { mode: 'monaural' })
  s.eng.play(beating, { durationS: 60, sham: true })
  await run(t, s.ctx, 3)
  near(tonePower(s.ctx, s.ctx.currentTime)[0], real[0], 1e-9, 'sham = real')
})

test('engine: binaural and isochronic real and sham have equal tone power', async (t) => {
  for (const mode of ['binaural', 'isochronic']) {
    const r = await rig(t, { mode })
    r.eng.play({ layers: LANE, noise: NOISE, crossfadeS: 1 }, { durationS: 60 })
    await run(t, r.ctx, 3)
    const s = await rig(t, { mode })
    s.eng.play({ layers: LANE, noise: NOISE, crossfadeS: 1 }, { durationS: 60, sham: true })
    await run(t, s.ctx, 3)
    assert.equal(master(r.eng), master(s.eng), `${mode}: same master`)
    if (mode === 'binaural') {
      near(tonePower(r.ctx, r.ctx.currentTime)[1], tonePower(s.ctx, s.ctx.currentTime)[1], 1e-12)
      continue
    }
    // isochronic: steady (sham) at the plain-tone level, full pulses at 1/rms with the same power
    for (const v of s.eng._voices) {
      near(v.base.valueAt(s.ctx.currentTime), 1, 1e-12)
      assert.equal(v.depth.valueAt(s.ctx.currentTime), 0)
    }
    for (const v of r.eng._voices.filter((x) => x.carrier !== 300)) {
      near(v.base.valueAt(r.ctx.currentTime), ISO_MEAN / ISO_RMS, 1e-6)
      near(v.depth.valueAt(r.ctx.currentTime), 1 / ISO_RMS, 1e-6)
    }
    // noise stays 15 dB under each tone, as in the other modes
    near(r.eng._noise.level.valueAt(r.ctx.currentTime), dbToGain(-15), 1e-12)
  }
})

test('engine: shared carriers morph in place; constant tones start on one phase grid', async (t) => {
  const { eng, ctx } = await rig(t)
  eng.play({ layers: LANE, noise: NOISE, crossfadeS: 2 }, { durationS: 60 })
  await run(t, ctx, 3)
  const before = ctx.nodes.filter((n) => n.kind === 'osc').length
  eng.play({ layers: RETURN, noise: NOISE, crossfadeS: 2, fadeOutS: 1 }, { durationS: 30 })
  await run(t, ctx, 3)
  assert.equal(ctx.nodes.filter((n) => n.kind === 'osc').length, before, 'no new oscillators')
  assert.equal(eng._voices.length, 4)
  for (const v of eng._voices) {
    const layer = RETURN.find((l) => l.carrier === v.carrier)
    near(v.right.valueAt(ctx.currentTime), v.carrier + layer.beat, 1e-9)
    near(v.level.valueAt(ctx.currentTime), dbToGain(-3), 1e-9)
  }
  // two layers on one carrier, then a third one added later
  eng.play({ layers: [{ carrier: 300, beat: 0 }, { carrier: 300, beat: { from: 0, to: 16 }, gainDb: -10, rampS: 5 }, { carrier: 133, beat: 7 }], crossfadeS: 1 }, { durationS: 60 })
  await run(t, ctx, 1.37)
  eng.play({ layers: [{ carrier: 300, beat: 0 }, { carrier: 300, beat: 16, gainDb: -10 }, { carrier: 300, beat: 0, gainDb: -6 }, { carrier: 133, beat: 7 }], crossfadeS: 1 }, { durationS: 60 })
  const fresh = eng._voices.filter((v) => v.oscs[0].started >= ctx.currentTime)
  assert.equal(fresh.length, 1, 'one new voice')
  assert.ok(fresh[0].oscs[0].started < ctx.currentTime + 0.03 + 1 / 300)
  for (const v of eng._voices) {
    for (const o of oscsOf(v)) {
      const k = o.started * v.carrier
      near(k, Math.round(k), 1e-6, `${v.carrier} Hz starts at a whole period`)
    }
  }
})

test('engine: headroom keeps peaks under the budget, same for real and sham; limiter only a ceiling', async (t) => {
  const { eng, ctx } = await rig(t, { levelDb: -6 })
  const comp = ctx.nodes.find((n) => n.kind === 'comp')
  assert.equal(comp.threshold.value, -1)
  const step = { layers: LANE, noise: NOISE, crossfadeS: 1 }
  eng.play(step, { durationS: 60 })
  await run(t, ctx, 1)
  near(master(eng), dbToGain(-6 - HEADROOM_DB), 1e-12, 'binaural Lane set fits at the top level')
  assert.ok(master(eng) * peakBound(step, 'binaural') < dbToGain(PEAK_DB))
  eng.setMode('isochronic')
  await run(t, ctx, 1)
  near(master(eng) * peakBound(step, 'isochronic'), dbToGain(PEAK_DB), 1e-9, 'isochronic capped')
  // the cap holds for the rest of the run, also for lighter steps and when T0 moves
  eng.play({ layers: [{ carrier: 200, beat: 10 }], noise: NOISE }, { durationS: 60 })
  eng.setLevelDb(-7)
  await run(t, ctx, 1)
  near(master(eng) * peakBound(step, 'isochronic'), dbToGain(PEAK_DB), 1e-9)
  eng.setLevelDb(-30)
  await run(t, ctx, 1)
  near(master(eng), dbToGain(-30 - HEADROOM_DB), 1e-12, 'below the cap T0 rules')
  // a new run starts afresh; planHeadroom applies the densest step from the start
  eng.stop(0.1)
  await run(t, ctx, 1)
  eng.setLevelDb(-6)
  eng.planHeadroom([null, { layers: [{ carrier: 200, beat: 10 }] }, step])
  eng.play({ layers: [{ carrier: 200, beat: 10 }], noise: NOISE }, { durationS: 60, sham: true })
  await run(t, ctx, 1)
  near(master(eng) * peakBound(step, 'isochronic'), dbToGain(PEAK_DB), 1e-9, 'planned')
  // the calibration mix fits even at T0 = 0 dB
  const top = await rig(t, { levelDb: 0, maxLevelDb: 0 })
  const calPeak = dbToGain(CALIBRATION.mixDb) + dbToGain(CALIBRATION.noiseDb) * Math.SQRT1_2 * 4
  assert.ok(master(top.eng) * calPeak < dbToGain(PEAK_DB))
})

test('engine: stop while paused cuts at once; idle engine suspends itself and wakes on play', async (t) => {
  const { eng, ctx } = await rig(t)
  eng.play({ layers: LANE, noise: NOISE, crossfadeS: 1 }, { durationS: 60 })
  await run(t, ctx, 2)
  const voices = [...eng._voices]
  await eng.pause()
  assert.equal(eng.state, 'suspended')
  eng.stop()
  assert.equal(eng._voices.length, 0)
  for (const v of voices) for (const o of v.oscs) assert.ok(o.stopped != null && o.disconnected)
  assert.equal(eng._noise.level.valueAt(ctx.currentTime), 0)
  assert.equal(eng.state, 'idle')
  eng.play({ layers: LANE, noise: NOISE, crossfadeS: 1 }, { durationS: 60 })
  assert.equal(ctx.state, 'running', 'woken by play()')
  await run(t, ctx, 2)
  assert.equal(eng.state, 'running')
  // a normal stop fades, then frees everything and suspends the context
  eng.stop(0.5)
  await run(t, ctx, 0.3)
  assert.equal(ctx.state, 'running', 'still fading')
  await run(t, ctx, 1)
  assert.equal(ctx.state, 'suspended')
  assert.equal(eng._voices.length, 0)
  assert.equal(eng._reaper, null)
  assert.equal(ctx.nodes.filter((n) => n.kind === 'osc' && n.frequency.value > 1 && !n.disconnected).length, 0, 'tones released')
  await eng.start()
  assert.equal(ctx.state, 'running')
})

test('engine: setMode rebuilds the voices and releases the old ones', async (t) => {
  const { eng, ctx } = await rig(t)
  eng.play({ layers: LANE, noise: NOISE, crossfadeS: 1 }, { durationS: 120 })
  await run(t, ctx, 3)
  const old = [...eng._voices]
  eng.setMode('monaural')
  assert.equal(eng._voices.length, 8)
  assert.ok(old.every((v) => v.endT != null))
  await run(t, ctx, 3)
  assert.deepEqual(eng._voices.map((v) => v.mode), ['monaural', 'monaural', 'monaural', 'monaural'])
  for (const v of old) for (const n of v.nodes) assert.ok(n.disconnected)
  const v100 = eng._voices.find((v) => v.carrier === 100)
  near(v100.mixR.valueAt(ctx.currentTime), Math.SQRT1_2, 1e-9)
  const v300 = eng._voices.find((v) => v.carrier === 300)
  assert.equal(v300.mixR.valueAt(ctx.currentTime), 0, 'beat 0: right tone silent')
  eng.setMode('isochronic')
  await run(t, ctx, 3)
  assert.equal(eng._voices.length, 4)
  assert.ok(eng._voices.every((v) => v.mode === 'isochronic'))
  assert.throws(() => eng.setMode('nope'), /Unknown audio mode/)
})

test('engine: long run without jumps, the model matches the params, voices cleaned up', async (t) => {
  for (const hold of [true, false]) {
    const { eng, ctx } = await rig(t, {}, { hold })
    const created = []
    const create = eng._createVoice.bind(eng)
    eng._createVoice = (...args) => {
      const v = create(...args)
      created.push(v)
      return v
    }
    const timeline = [
      [0, () => eng.play({ layers: [], noise: NOISE, crossfadeS: 5 }, { durationS: 20 })],
      [20, () => eng.play({ layers: [{ carrier: 200, beat: 10 }], noise: NOISE }, { durationS: 30 })],
      [50, () => eng.play({ layers: [{ carrier: 200, beat: { from: 10, to: 7 } }], noise: NOISE }, { durationS: 20 })],
      [70, () => eng.play({ layers: LANE, noise: NOISE, crossfadeS: 8 }, { durationS: 60 })],
      [85, () => eng.setMode('monaural')],
      [95, () => eng.setMode('isochronic')],
      [100, () => eng.setLevelDb(-6)],
      [110, () => eng.play({ layers: [...LANE, { carrier: 300, beat: { from: 0, to: 16 }, gainDb: -10, rampS: 6 }], noise: NOISE }, { durationS: 60 })],
      [120, () => eng.pause()],
      [121, () => eng.resume()],
      [125, () => eng.setMode('binaural')],
      [130, () => eng.play({ layers: RETURN, noise: NOISE, crossfadeS: 8, fadeOutS: 5 }, { durationS: 30 })],
      [140, () => eng.setLevelDb(-25)],
      [160, () => eng.play(null)],
      [170, () => eng.play({ layers: [{ carrier: 200, beat: 10, startS: 5, rampS: 0 }], noise: null }, { durationS: 20, sham: true })],
      [185, () => eng.stop()],
    ]
    const prev = new Map()
    const jumps = []
    let i = 0
    let wall = 0
    const dt = 0.01
    while (wall < 190) {
      while (i < timeline.length && wall >= timeline[i][0]) timeline[i++][1]()
      const now = ctx.currentTime
      // mix/base/depth of a voice may jump only while its level is 0
      const quiet = new Set()
      for (const v of created) {
        if (v.level.valueAt(now) > 1e-3 || prev.get(v.level.params[0]) > 1e-3) continue
        for (const tr of [v.depth, v.base, v.mixL, v.mixR].filter(Boolean)) for (const p of tr.params) quiet.add(p)
      }
      for (const p of ctx.params) {
        const v = p.valueAt(now)
        assert.ok(Number.isFinite(v))
        const last = prev.get(p)
        if (p.owner === 'gain' && !quiet.has(p) && last != null && Math.abs(v - last) > 0.25) jumps.push({ t: now, from: last, to: v })
        prev.set(p, v)
      }
      for (const v of eng._voices) {
        for (const tr of [v.level, v.right, v.rate, v.depth, v.base, v.mixL, v.mixR].filter(Boolean)) {
          for (const p of tr.params) near(p.valueAt(now), tr.valueAt(now), 1e-9, `model at ${now}`)
        }
      }
      near(eng._master.params[0].valueAt(now), eng._master.valueAt(now), 1e-12)
      ctx.advance(dt)
      t.mock.timers.tick(dt * 1000)
      wall += dt
    }
    await flush()
    assert.deepEqual(jumps, [], `hold=${hold}`)
    assert.equal(eng._voices.length, 0)
    assert.ok(created.length >= 19, `${created.length} voices`)
    for (const v of created) {
      for (const n of v.nodes) assert.ok(n.disconnected, 'voice released')
      for (const o of v.oscs) assert.ok(o.stopped != null)
    }
    assert.equal(ctx.state, 'suspended', 'idle after stop')
  }
})

test('engine: noise is one shared mono buffer, played twice half a loop apart', async (t) => {
  const { eng, ctx } = await rig(t)
  const a = ctx.nodes.filter((n) => n.kind === 'buffer')
  assert.equal(a.length, 2)
  assert.equal(a[0].buffer, a[1].buffer)
  assert.equal(a[0].buffer.numberOfChannels, 1)
  near(Math.abs(a[1].offset - a[0].offset), a[0].buffer.duration / 2, 1e-9)
  const data = a[0].buffer.getChannelData(0)
  assert.ok(data.some((v) => v !== 0))
  // a second context reuses the samples
  const b = await rig(t)
  assert.deepEqual(b.ctx.nodes.find((n) => n.kind === 'buffer').buffer.getChannelData(0).subarray(0, 64), data.subarray(0, 64))
  await eng.close()
  await b.eng.close()
})

test('engine: testTone level, and it always resolves', async (t) => {
  const { eng, ctx } = await rig(t, { levelDb: -20 })
  let done = false
  const p = eng.testTone(2).then(() => (done = true))
  await flush()
  assert.equal(eng.state, 'running')
  const osc = ctx.nodes.find((n) => n.kind === 'osc' && n.frequency.value === CALIBRATION.carrier && !n.wave && n.outs.some((e) => e.target.kind === 'gain'))
  await run(t, ctx, 1)
  const [l, r] = ampsAt(osc, ctx.currentTime)
  near(l / scale(eng), dbToGain(CALIBRATION.mixDb), 1e-9, 'tone at the four-tone mix power')
  near(l, r, 1e-12)
  assert.equal(master(eng), dbToGain(-20 - HEADROOM_DB))
  await run(t, ctx, 1.2)
  await p
  assert.ok(done)
  assert.equal(eng.state, 'idle')
  assert.ok(osc.disconnected)
  // suspended mid-tone (pause, iOS interruption): resolves on the wall clock
  done = false
  const q = eng.testTone(3).then(() => (done = true))
  await flush()
  await eng.pause()
  await run(t, ctx, 3.5)
  assert.equal(done, false)
  await run(t, ctx, 1)
  assert.ok(done)
  await q
  // stop() and close() end it too
  await eng.start()
  done = false
  const s = eng.testTone(5).then(() => (done = true))
  await flush()
  eng.stop()
  await run(t, ctx, 0.2)
  assert.ok(done)
  await s
  done = false
  const c = eng.testTone(5).then(() => (done = true))
  await flush()
  await eng.close()
  await c
  assert.ok(done)
  // close() while start() is still waiting
  const e2 = new AudioEngine()
  const w = e2.testTone(1)
  const closing = e2.close()
  await assert.doesNotReject(w)
  await closing
  assert.equal(e2.state, 'idle')
})

test('engine: onStateChange reports interruptions; stepTime follows the audio clock', async (t) => {
  const calls = []
  const { eng, ctx } = await rig(t, { onStateChange: (state, info) => calls.push([state, info.interrupted]) })
  assert.equal(eng.stepTime, null)
  eng.play({ layers: LANE, noise: NOISE }, { durationS: 60 })
  assert.deepEqual(calls.at(-1), ['running', false])
  await run(t, ctx, 2)
  near(eng.stepTime, 2 - 0.03, 1e-9)
  await ctx.suspend() // the browser, not the app
  assert.deepEqual(calls.at(-1), ['suspended', true])
  await run(t, ctx, 5)
  near(eng.stepTime, 2 - 0.03, 1e-9, 'audio clock stood still')
  await eng.resume()
  assert.deepEqual(calls.at(-1), ['running', false])
  await eng.pause()
  assert.deepEqual(calls.at(-1), ['suspended', false])
  await eng.resume()
  eng.stop()
  assert.deepEqual(calls.at(-1), ['idle', false])
  await eng.close()
})
