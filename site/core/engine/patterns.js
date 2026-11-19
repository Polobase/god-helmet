// JavaScript port of firmware/lib/engine/src/patterns.cpp (keep in sync).
// s(t) in [-1, 1]. Synthesised from the published descriptions of the
// Persinger/Koren signals; the original point files were never published.

export const PATTERN_TYPES = ['off', 'dc', 'sine', 'chirp', 'burst', 'thomas', 'pulse', 'semirandom', 'table', 'pm', 'noise']

export const PATTERN_INFO = {
  off: 'No output (sham)',
  dc: 'Constant current (tests)',
  sine: 'Smooth sine wave at one frequency',
  chirp: 'Frequency sweep: the frequency changes steadily during each sweep',
  burst: 'Accelerating "burst-firing" pattern derived from amygdala EEG',
  thomas: 'Decelerating "Thomas pulse": the frequency falls during each pulse',
  pulse: 'Rectangular pulses',
  semirandom: 'Pseudo-random value per point',
  table: 'Point table (exact published waveform or generated pulse train)',
  pm: 'Phase-modulated sine: the wave is pushed back and forth at a slower rate',
  noise: 'Random noise limited to a frequency band',
}

export function patternDefaults(type) {
  const p = { type, f0: 7, f1: 7, sweepMs: 2000, gapMs: 0, pointMs: 0, pulseMs: 100, alternate: true, seed: 1, depth: 1, table: null }
  switch (type) {
    case 'sine': Object.assign(p, { f0: 7, f1: 7, pointMs: 1 }); break
    case 'chirp': Object.assign(p, { f0: 4, f1: 40, sweepMs: 2000, pointMs: 1 }); break
    case 'burst': Object.assign(p, { f0: 6, f1: 30, sweepMs: 1500, gapMs: 4000, pointMs: 3 }); break
    case 'thomas': Object.assign(p, { f0: 25, f1: 6, sweepMs: 2500, gapMs: 1000, pointMs: 3 }); break
    case 'pulse': Object.assign(p, { pulseMs: 100, gapMs: 100, alternate: true }); break
    case 'semirandom': Object.assign(p, { pointMs: 3 }); break
    case 'table': Object.assign(p, { pointMs: 3 }); break
    case 'pm': Object.assign(p, { f0: 40, f1: 0.5, depth: 3, pointMs: 1 }); break
    case 'noise': Object.assign(p, { f0: 4, f1: 8, pointMs: 1 }); break
  }
  return p
}

const holdTime = (t, pointMs) => (pointMs > 0 ? Math.floor(t / pointMs) * pointMs : t)
const sinCycles = (c) => Math.sin(2 * Math.PI * (c - Math.floor(c)))

function mix32(x) {
  x >>>= 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d) >>> 0
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b) >>> 0
  x ^= x >>> 16
  return x >>> 0
}

function sweep(p, tMs) {
  if (p.sweepMs <= 0) return 0
  const period = p.sweepMs + (p.gapMs > 0 ? p.gapMs : 0)
  const tau = holdTime(tMs % period, p.pointMs)
  if (tau >= p.sweepMs) return 0
  const ts = tau / 1000
  const window = p.sweepMs / 1000
  return sinCycles(p.f0 * ts + ((p.f1 - p.f0) * ts * ts) / (2 * window))
}

export function patternValue(p, tMs) {
  if (tMs < 0) return 0
  const t = holdTime(tMs, p.pointMs)
  switch (p.type) {
    case 'off': return 0
    case 'dc': return 1
    case 'sine': return sinCycles((p.f0 * t) / 1000)
    case 'chirp':
    case 'burst':
    case 'thomas': return sweep(p, tMs)
    case 'pulse': {
      const period = p.pulseMs + (p.gapMs > 0 ? p.gapMs : 0)
      if (period <= 0) return 0
      const index = Math.floor(t / period)
      if (t - index * period >= p.pulseMs) return 0
      return p.alternate && index % 2 === 1 ? -1 : 1
    }
    case 'semirandom': {
      const step = p.pointMs > 0 ? p.pointMs : 1
      const k = Math.floor(tMs / step) >>> 0
      const h = mix32(k ^ mix32(p.seed))
      return h / 2147483647.5 - 1
    }
    case 'pm': {
      const ts = t / 1000
      return sinCycles(p.f0 * ts + (p.depth * Math.sin(2 * Math.PI * p.f1 * ts)) / (2 * Math.PI))
    }
    case 'noise': {
      const K = 12
      const ts = t / 1000
      let sum = 0
      for (let i = 0; i < K; i++) {
        const f = p.f0 + ((i + 0.5) * (p.f1 - p.f0)) / K
        const phase = mix32((Math.imul(p.seed, 0x9e3779b9) + i) >>> 0) / 4294967296
        sum += sinCycles(f * ts + phase)
      }
      return Math.max(-1, Math.min(1, sum / (2.5 * Math.sqrt(K / 2))))
    }
    case 'table': {
      if (!p.table || p.table.length === 0) return 0
      const step = p.pointMs > 0 ? p.pointMs : 1
      const total = p.table.length * step + (p.gapMs > 0 ? p.gapMs : 0)
      const i = Math.floor((tMs % total) / step)
      if (i >= p.table.length) return 0
      return p.table[i] / 127
    }
  }
  return 0
}
