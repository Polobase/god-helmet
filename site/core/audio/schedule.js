// Pure timing maths for the guide audio (no Web Audio here, testable in node).
// Times are seconds within a step. A curve is a sorted list of {t, v} points:
// linear between points, held before the first and after the last, which is
// exactly what AudioParam.linearRampToValueAtTime produces.

export const MODES = ['binaural', 'monaural', 'isochronic']
export const DEFAULT_CROSSFADE_S = 10
export const MIN_FADE_S = 0.05 // shortest gain ramp, avoids clicks
export const DEFAULT_NOISE_DB = -15 // Lane et al. 1998: tones 15 dB above the noise
export const NOISE_BAND_HZ = [40, 320] // Lane et al. 1998: flat 40-320 Hz, 12 dB/octave outside
export const NOISE_CREST = 4 // noise peaks counted at 4x RMS (Gaussian: exceeded 6e-5 of the time)
export const SWELL_DEPTH = 0.6 // pan swing of the noise swell (StereoPanner units)
export const FULL_DEPTH_HZ = 0.5 // below this beat the modulation depth fades out, so beat 0 is a steady tone
export const ISO_HARMONICS = 32
export const ISO_MEAN = 0.25 // of the isochronic pulse
export const ISO_RMS = Math.sqrt(3 / 16)
// Peak amplitude of one layer at gain 1 in each mode (see monauralLevels, isochronicLevels).
export const MODE_PEAK = { binaural: 1, monaural: Math.SQRT2, isochronic: 1 / ISO_RMS }

const num = (x, fallback = 0) => (Number.isFinite(Number(x)) && x !== null && x !== '' ? Number(x) : fallback)
const clamp01 = (x) => Math.min(1, Math.max(0, x))
const startOf = (layer) => Math.max(0, num(layer?.startS))

export function dbToGain(db) {
  if (db === -Infinity) return 0
  const d = db == null ? 0 : Number(db)
  return Number.isFinite(d) ? 10 ** (d / 20) : 0
}

export const gainToDb = (g) => (g > 0 ? 20 * Math.log10(g) : -Infinity)

// Beat in Hz at tS seconds after the glide starts. A glide {from, to} runs
// over rampS if given, else over durS (the rest of the step). An open-ended
// step (durS Infinity/undefined) without rampS stays at `from`.
export function beatAt(beat, tS, durS, rampS) {
  if (beat == null) return 0
  if (typeof beat !== 'object') return num(beat)
  const from = num(beat.from)
  const to = num(beat.to, from)
  const span = rampS > 0 ? rampS : (durS ?? Infinity)
  const x = span > 0 ? clamp01(tS / span) : 1
  return from + (to - from) * x
}

export function curveAt(points, t) {
  if (!points.length) return 0
  let i = -1
  for (let k = 0; k < points.length && points[k].t <= t; k++) i = k
  if (i < 0) return points[0].v
  if (i === points.length - 1) return points[i].v
  const a = points[i]
  const b = points[i + 1]
  return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t)
}

export const scaleCurve = (points, k) => points.map((p) => ({ t: p.t, v: p.v * k }))

const times = (a, b) => [...new Set([...a, ...b].map((p) => p.t))].sort((x, y) => x - y)

// Pointwise minimum; exact (adds the crossing points).
export function minCurves(a, b) {
  const ts = times(a, b)
  const out = []
  ts.forEach((t, i) => {
    if (i > 0) {
      const t0 = ts[i - 1]
      const d0 = curveAt(a, t0) - curveAt(b, t0)
      const d1 = curveAt(a, t) - curveAt(b, t)
      if (d0 * d1 < 0) {
        const tx = t0 + ((t - t0) * d0) / (d0 - d1)
        out.push({ t: tx, v: curveAt(a, tx) })
      }
    }
    out.push({ t, v: Math.min(curveAt(a, t), curveAt(b, t)) })
  })
  return out
}

// Pointwise product. Exact where one factor is constant; where both change
// (fade-out overlapping a fade-in) the parabola is approximated by chords.
export function mulCurves(a, b) {
  const ts = times(a, b)
  const out = []
  ts.forEach((t, i) => {
    if (i > 0) {
      const t0 = ts[i - 1]
      if (curveAt(a, t0) !== curveAt(a, t) && curveAt(b, t0) !== curveAt(b, t)) {
        for (let k = 1; k < 4; k++) {
          const tm = t0 + ((t - t0) * k) / 4
          out.push({ t: tm, v: curveAt(a, tm) * curveAt(b, tm) })
        }
      }
    }
    out.push({ t, v: curveAt(a, t) * curveAt(b, t) })
  })
  return out
}

// Fade-in factor 0..1 of a layer: starts at startS, lasts rampS (default: the crossfade).
export function riseCurve(layer, crossfadeS = DEFAULT_CROSSFADE_S) {
  const s = startOf(layer)
  const ramp = Math.max(MIN_FADE_S, num(layer?.rampS, num(crossfadeS, DEFAULT_CROSSFADE_S)))
  return [{ t: s, v: 0 }, { t: s + ramp, v: 1 }]
}

// Fade-out factor 0..1 over the last fadeOutS of a step with a known duration.
export function fallCurve(stepDurS, fadeOutS = 0) {
  const d = num(stepDurS, Infinity)
  if (!Number.isFinite(d) || !(fadeOutS > 0)) return [{ t: 0, v: 1 }]
  const f = Math.min(d, Math.max(MIN_FADE_S, fadeOutS))
  return [{ t: d - f, v: 1 }, { t: d, v: 0 }]
}

export function levelCurve(layer, stepDurS, { crossfadeS = DEFAULT_CROSSFADE_S, fadeOutS = 0 } = {}) {
  return mulCurves(riseCurve(layer, crossfadeS), fallCurve(stepDurS, fadeOutS))
}

// Beat (Hz) of a layer over the step as a curve; sham forces 0.
export function beatCurve(layer, stepDurS, { sham = false } = {}) {
  const b = layer?.beat
  if (sham || b == null || typeof b !== 'object') return [{ t: 0, v: sham ? 0 : num(b) }]
  const s = startOf(layer)
  const d = (stepDurS ?? Infinity) - s
  const span = layer.rampS > 0 ? layer.rampS : d
  const from = num(b.from)
  const to = num(b.to, from)
  if (!(span > 0)) return [{ t: s, v: to }]
  if (!Number.isFinite(span)) return [{ t: s, v: from }]
  return [{ t: s, v: from }, { t: s + span, v: to }]
}

// State of one layer at tS seconds into its step (fades include startS/rampS
// and, with fadeOutS, the end-of-step fade). gainDb is relative to T0.
export function layerAt(layer, tS, stepDurS, { sham = false, crossfadeS = DEFAULT_CROSSFADE_S, fadeOutS = 0 } = {}) {
  const s = startOf(layer)
  const carrier = num(layer?.carrier)
  const beat = sham ? 0 : beatAt(layer?.beat, tS - s, (stepDurS ?? Infinity) - s, layer?.rampS)
  const active = tS >= s
  const fade = active ? curveAt(levelCurve(layer, stepDurS, { crossfadeS, fadeOutS }), tS) : 0
  return {
    leftHz: carrier,
    rightHz: carrier + beat,
    beatHz: beat,
    gainDb: fade > 0 ? num(layer?.gainDb) + gainToDb(fade) : -Infinity,
    fade,
    active,
  }
}

// Isochronic envelope: a raised-cosine (Hann) pulse filling the first half of
// each cycle and silence in the second half (50 % duty), range 0..1.
// Rate 0 gives a steady tone (1).
const isoShape = (p) => (p < 0.5 ? Math.sin(2 * Math.PI * p) ** 2 : 0)

export function isochronicEnvelope(tS, rateHz) {
  const r = Math.abs(num(rateHz))
  if (!(r > 0)) return 1
  const x = tS * r
  return isoShape(x - Math.floor(x))
}

// Fourier series of the envelope for a PeriodicWave LFO (disableNormalization).
// The DC term is dropped by Web Audio, so the engine adds `mean` itself.
// `rms` (sqrt(3/16)) is the steady level with the same power as the pulses.
// The pulse is C1-continuous, so harmonics fall off as 1/k^3: 32 harmonics stay
// within 3e-4 of the exact shape (dipping at most that far below 0; checked in
// test/audio.test.js).
export function isochronicSeries(harmonics = ISO_HARMONICS, samples = 4096) {
  const re = new Float64Array(harmonics + 1)
  const im = new Float64Array(harmonics + 1)
  let mean = 0
  let sq = 0
  for (let j = 0; j < samples; j++) {
    const p = j / samples
    const e = isoShape(p)
    mean += e
    sq += e * e
    for (let k = 1; k <= harmonics; k++) {
      re[k] += e * Math.cos(2 * Math.PI * k * p)
      im[k] += e * Math.sin(2 * Math.PI * k * p)
    }
  }
  const real = new Float32Array(harmonics + 1)
  const imag = new Float32Array(harmonics + 1)
  for (let k = 1; k <= harmonics; k++) {
    real[k] = (2 * re[k]) / samples
    imag[k] = (2 * im[k]) / samples
  }
  return { real, imag, mean: mean / samples, rms: Math.sqrt(sq / samples) }
}

export function seriesAt({ real, imag, mean }, p) {
  let y = mean
  for (let k = 1; k < real.length; k++) y += real[k] * Math.cos(2 * Math.PI * k * p) + imag[k] * Math.sin(2 * Math.PI * k * p)
  return y
}

// LFO rate (|beat|) and modulation depth 0..1 (isochronic pulses, monaural
// right tone), with breakpoints where the beat crosses 0 or ±fullHz so both stay exact.
export function isochronicCurves(beatPoints, fullHz = FULL_DEPTH_HZ) {
  const pts = []
  beatPoints.forEach((p, i) => {
    if (i > 0) {
      const a = beatPoints[i - 1]
      const cuts = []
      for (const level of [-fullHz, 0, fullHz]) {
        if ((a.v - level) * (p.v - level) < 0) cuts.push({ t: a.t + ((level - a.v) * (p.t - a.t)) / (p.v - a.v), v: level })
      }
      pts.push(...cuts.sort((x, y) => x.t - y.t))
    }
    pts.push(p)
  })
  return {
    rate: pts.map((p) => ({ t: p.t, v: Math.abs(p.v) })),
    depth: pts.map((p) => ({ t: p.t, v: Math.min(1, Math.abs(p.v) / fullHz) })),
  }
}

// f applied to a curve; segments where the value changes get n chords.
export function mapCurve(points, f, n = 8) {
  const out = []
  points.forEach((p, i) => {
    const a = points[i - 1]
    if (a && a.v !== p.v && p.t > a.t) {
      for (let k = 1; k < n; k++) out.push({ t: a.t + ((p.t - a.t) * k) / n, v: f(a.v + ((p.v - a.v) * k) / n) })
    }
    out.push({ t: p.t, v: f(p.v) })
  })
  return out
}

// Monaural gains of a layer's two oscillators (both reach both ears) from the
// depth curve. A beating pair plays at 1/sqrt2 each, the power of one tone. Towards
// beat 0 the right one fades out (equal-power cos/sin): two equal tones frozen at
// some phase would add to anything from silence to +3 dB, and sham (always beat 0)
// would differ from real.
export function monauralLevels(depth) {
  return {
    left: mapCurve(depth, (d) => Math.cos((d * Math.PI) / 4)),
    right: mapCurve(depth, (d) => Math.sin((d * Math.PI) / 4)),
  }
}

// Isochronic gains: am = base + lfo * (pulse - mean). Same power as a plain tone
// at every depth: steady at d = 0 (base 1), pure pulses at d = 1 (peaks 1 / rms, +7.3 dB).
export function isochronicLevels(depth, { mean = ISO_MEAN, rms = ISO_RMS } = {}) {
  const k = 1 - (mean / rms) ** 2
  return {
    base: mapCurve(depth, (d) => Math.sqrt(1 - k * d * d)),
    lfo: depth.map((p) => ({ t: p.t, v: p.v / rms })),
  }
}

// Upper bound of a step's peak amplitude per ear, re one tone at T0: the layer
// gains (all assumed beating, so real and sham get the same bound) plus the
// noise crest, raised by the swell (the panner adds part of one channel to the other).
export function peakBound(audio, mode = 'binaural') {
  const layers = Array.isArray(audio?.layers) ? audio.layers : []
  let peak = (MODE_PEAK[mode] ?? 1) * layers.reduce((s, l) => s + dbToGain(num(l?.gainDb)), 0)
  if (audio?.noise) {
    const pan = audio.noise.swellS > 0 ? Math.sin((SWELL_DEPTH * Math.PI) / 2) : 0
    peak += dbToGain(num(audio.noise.levelDb, DEFAULT_NOISE_DB)) * Math.SQRT1_2 * NOISE_CREST * Math.sqrt(1 + pan * pan)
  }
  return peak
}

// Pairs new layers with playing voices of the same carrier (closest beat
// first) so shared tones morph instead of crossfading against themselves,
// which would cancel partly when the two oscillators are out of phase.
// voices: [{carrier, beat, dying}], layers: [{carrier, beat, eligible}] -> voice index per layer or -1.
export function matchLayers(voices, layers) {
  const pairs = []
  layers.forEach((l, i) => {
    if (l.eligible === false) return
    voices.forEach((v, j) => {
      if (v.carrier === l.carrier) pairs.push([Math.abs(v.beat - l.beat) + (v.dying ? 1e3 : 0), i, j])
    })
  })
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
  const out = layers.map(() => -1)
  const used = new Set()
  for (const [, i, j] of pairs) {
    if (out[i] < 0 && !used.has(j)) {
      out[i] = j
      used.add(j)
    }
  }
  return out
}

// Mirror of an AudioParam's linear automation, so the engine always knows the
// value it scheduled (cancelAndHoldAtTime is missing in Firefox).
export class LinearTrack {
  constructor(value = 0) {
    this.points = [{ t: 0, v: value }]
  }

  valueAt(t) {
    return curveAt(this.points, t)
  }

  // Drop everything from t on and hold the value at t.
  hold(t) {
    const v = this.valueAt(t)
    const before = this.points.filter((p) => p.t < t)
    this.points = [...before.slice(-1), { t, v }]
    return v
  }

  set(t, v) {
    if (this.hold(t) !== v) this.points.push({ t, v })
  }

  ramp(t, v) {
    const last = this.points[this.points.length - 1]
    this.points.push({ t: Math.max(t, last.t), v })
  }
}

// Schedules a curve given in step time onto a track, with step time `offsetS`
// at absolute time `atS`.
export function applyCurve(track, points, atS, offsetS = 0) {
  track.hold(atS)
  track.set(atS, curveAt(points, offsetS))
  for (const p of points) if (p.t > offsetS) track.ramp(atS + p.t - offsetS, p.v)
}

// RBJ cookbook biquad, Q 0.707 (Butterworth, 12 dB/octave).
export function biquad(type, hz, sampleRate, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * hz) / sampleRate
  const cos = Math.cos(w)
  const alpha = Math.sin(w) / (2 * q)
  const a0 = 1 + alpha
  const b = type === 'lowpass' ? [(1 - cos) / 2, 1 - cos] : [(1 + cos) / 2, -(1 + cos)]
  return { b0: b[0] / a0, b1: b[1] / a0, b2: b[0] / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 }
}

// Pink noise (Paul Kellet's refined filter), band-limited to lowHz-highHz (null:
// full band), DC removed, scaled after filtering to the RMS of a full-scale sine
// (so noise.levelDb compares with the tones), with an equal-power crossfade at the loop seam.
export function pinkNoise(length, random = Math.random, { sampleRate = 48000, lowHz = NOISE_BAND_HZ[0], highHz = NOISE_BAND_HZ[1] } = {}) {
  const seam = Math.min(2048, Math.floor(length / 4))
  const x = new Float32Array(length + seam)
  const pass = { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
  const h = lowHz > 0 ? biquad('highpass', lowHz, sampleRate) : pass
  const l = highHz > 0 && highHz < sampleRate / 2 ? biquad('lowpass', highHz, sampleRate) : pass
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  let hx1 = 0, hx2 = 0, hy1 = 0, hy2 = 0, lx1 = 0, lx2 = 0, ly1 = 0, ly2 = 0
  for (let i = -Math.max(4096, Math.round(sampleRate / 4)); i < x.length; i++) {
    const w = random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    const p = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
    b6 = w * 0.115926
    const hy = h.b0 * p + h.b1 * hx1 + h.b2 * hx2 - h.a1 * hy1 - h.a2 * hy2
    hx2 = hx1
    hx1 = p
    hy2 = hy1
    hy1 = hy
    const y = l.b0 * hy + l.b1 * lx1 + l.b2 * lx2 - l.a1 * ly1 - l.a2 * ly2
    lx2 = lx1
    lx1 = hy
    ly2 = ly1
    ly1 = y
    if (i >= 0) x[i] = y
  }
  const out = x.slice(0, length)
  for (let i = 0; i < seam; i++) {
    const a = (((i + 0.5) / seam) * Math.PI) / 2
    out[i] = x[i] * Math.sin(a) + x[length + i] * Math.cos(a)
  }
  let mean = 0
  for (let i = 0; i < length; i++) mean += out[i]
  mean /= length
  let sq = 0
  for (let i = 0; i < length; i++) sq += (out[i] - mean) ** 2
  const k = sq > 0 ? Math.SQRT1_2 / Math.sqrt(sq / length) : 0
  for (let i = 0; i < length; i++) out[i] = (out[i] - mean) * k
  return out
}
