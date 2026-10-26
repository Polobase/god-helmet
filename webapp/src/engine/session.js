// JavaScript port of firmware/lib/engine/src/{session,preset_json,drive}.cpp (keep in sync).
import { patternDefaults, patternValue, PATTERN_TYPES } from './patterns.js'
import { spatialDefaults, spatialGains, SPATIAL_MODES } from './spatial.js'

export const MAX_SESSION_MS = 60 * 60 * 1000
export const MAX_PHASES = 12
export const PHASE_RAMP_MS = 2000
export const STOP_FADE_MS = 2000

function parsePattern(v = {}) {
  const type = v.type ?? 'off'
  if (!PATTERN_TYPES.includes(type)) throw new Error(`unknown pattern type: ${type}`)
  const p = patternDefaults(type)
  for (const key of ['f0', 'f1', 'sweepMs', 'gapMs', 'pointMs', 'pulseMs', 'seed']) if (typeof v[key] === 'number') p[key] = v[key]
  if (typeof v.alternate === 'boolean') p.alternate = v.alternate
  if (p.f0 < 0 || p.f1 < 0 || p.f0 > 500 || p.f1 > 500) throw new Error('frequency out of range')
  if (p.pointMs < 0 || p.pointMs > 1000) throw new Error('pointMs out of range')
  return p
}

function parseSpatial(v) {
  const s = spatialDefaults()
  if (!v) return s
  if (v.mode !== undefined) {
    if (!SPATIAL_MODES.includes(v.mode)) throw new Error(`unknown spatial mode: ${v.mode}`)
    s.mode = v.mode
  }
  s.ccw = v.dir !== 'cw'
  s.side = v.side === 'left' ? 'left' : 'right'
  s.crossfade = !!v.crossfade
  if (typeof v.alternateMs === 'number') s.alternateMs = v.alternateMs
  s.channel = v.channel ?? 0
  if (s.channel < 0 || s.channel > 7) throw new Error('channel out of range')
  if (typeof v.dwellMs === 'number') {
    s.dwellStartMs = s.dwellEndMs = v.dwellMs
    s.dwellStepMs = 0
  }
  if (Array.isArray(v.dwell)) {
    if (v.dwell.length !== 3) throw new Error('dwell must be [start, step, end]')
    ;[s.dwellStartMs, s.dwellStepMs, s.dwellEndMs] = v.dwell
  }
  if (s.dwellStartMs < 0.5 || s.dwellEndMs < 0.5) throw new Error('dwell must be >= 0.5 ms')
  if (Array.isArray(v.weights)) {
    if (v.weights.length !== 8) throw new Error('weights needs 8 values')
    if (v.weights.some((x) => x < 0 || x > 1)) throw new Error('weights must be 0..1')
    s.weights = [...v.weights]
  }
  return s
}

// Same validation as engine::sessionFromJson. Throws Error with a message.
export function parseSession(doc) {
  if (!doc || typeof doc !== 'object') throw new Error('preset must be an object')
  const layout = doc.layout ?? 'temporal'
  if (!['ring', 'temporal'].includes(layout)) throw new Error(`unknown layout: ${layout}`)
  if (!Array.isArray(doc.phases) || doc.phases.length === 0) throw new Error('phases missing')
  if (doc.phases.length > MAX_PHASES) throw new Error('too many phases')
  let table = null
  if (Array.isArray(doc.tableData)) {
    if (doc.tableData.length === 0 || doc.tableData.length > 8192) throw new Error('tableData needs 1..8192 values')
    table = doc.tableData.map((v) => {
      if (v < 0 || v > 255) throw new Error('tableData values must be 0..255')
      return Math.max(-127, Math.floor(v) - 128)
    })
  }
  const phases = doc.phases.map((pv, i) => {
    let ms = 0
    if (pv.minutes !== undefined) ms = pv.minutes * 60000
    else if (pv.seconds !== undefined) ms = pv.seconds * 1000
    if (!(ms > 0)) throw new Error(`phase ${i + 1}: duration missing`)
    const level = pv.level ?? 1
    if (level < 0 || level > 1) throw new Error('level must be 0..1')
    let pattern, spatial
    try {
      pattern = parsePattern(pv.pattern)
      spatial = parseSpatial(pv.spatial)
    } catch (e) {
      throw new Error(`phase ${i + 1}: ${e.message}`)
    }
    if (pattern.type === 'table') {
      if (!table) throw new Error(`phase ${i + 1}: table pattern needs tableData`)
      pattern.table = table
    }
    return { name: pv.name ?? '', durationMs: Math.floor(ms), level, crossfade: !!pv.crossfade, pattern, spatial }
  })
  const session = {
    id: doc.id ?? 'custom',
    name: doc.name ?? doc.id ?? 'custom',
    layout,
    fadeInMs: Math.floor((doc.fadeInS ?? 10) * 1000),
    fadeOutMs: Math.floor((doc.fadeOutS ?? 10) * 1000),
    phases,
  }
  session.totalMs = phases.reduce((a, p) => a + p.durationMs, 0)
  if (session.totalMs > MAX_SESSION_MS) throw new Error('session longer than 60 min')
  return session
}

export class SessionRunner {
  start(session) {
    this.session = session
    this.programMs = 0
    this.elapsedMs = 0
    this.stopping = false
    this.stopStartedMs = 0
    this.frame = { running: !!session && session.phases.length > 0 && session.totalMs > 0, phase: 0, phaseMs: 0, programMs: 0, elapsedMs: 0, envelope: 0 }
    this.update()
    return this.frame
  }

  get running() {
    return !!this.frame?.running
  }

  advance(dtMs) {
    if (!this.running) return this.frame
    this.programMs += dtMs
    this.elapsedMs += dtMs
    this.update()
    return this.frame
  }

  phaseStart(phase) {
    let t = 0
    for (let i = 0; i < phase; i++) t += this.session.phases[i].durationMs
    return t
  }

  skipPhase() {
    if (!this.running || this.stopping) return
    const next = this.frame.phase + 1
    if (next >= this.session.phases.length) return this.requestStop()
    this.programMs = this.phaseStart(next)
    this.update()
  }

  requestStop() {
    if (!this.running || this.stopping) return
    this.stopping = true
    this.stopStartedMs = this.elapsedMs
    this.update()
  }

  abort() {
    this.frame = { ...this.frame, running: false, envelope: 0 }
  }

  update() {
    if (!this.running) return
    const s = this.session
    const total = s.totalMs
    if (this.programMs >= total) {
      this.frame = { ...this.frame, running: false, envelope: 0, programMs: total, elapsedMs: this.elapsedMs }
      return
    }
    let phase = 0
    let start = 0
    while (phase < s.phases.length - 1 && this.programMs >= start + s.phases[phase].durationMs) {
      start += s.phases[phase].durationMs
      phase++
    }
    let env = 1
    if (s.fadeInMs > 0) env = Math.min(env, this.programMs / s.fadeInMs)
    if (s.fadeOutMs > 0) env = Math.min(env, (total - this.programMs) / s.fadeOutMs)
    const phaseMs = this.programMs - start
    if (phase > 0 && s.phases[phase].crossfade) env = Math.min(env, phaseMs / PHASE_RAMP_MS)
    if (this.stopping) {
      const t = this.elapsedMs - this.stopStartedMs
      if (t >= STOP_FADE_MS) {
        this.frame = { ...this.frame, running: false, envelope: 0, elapsedMs: this.elapsedMs }
        return
      }
      env = Math.min(env, 1 - t / STOP_FADE_MS)
    }
    this.frame = { running: true, phase, phaseMs, programMs: this.programMs, elapsedMs: this.elapsedMs, envelope: Math.max(0, Math.min(1, env)) }
  }
}

// v_ch = envelope * phase.level * g_ch(t) * s(t)
export function render(session, frame) {
  const out = new Array(8).fill(0)
  if (!frame.running || frame.phase >= session.phases.length) return out
  const ph = session.phases[frame.phase]
  const s = patternValue(ph.pattern, frame.phaseMs)
  const scale = frame.envelope * ph.level * s
  if (scale === 0) return out
  const gains = spatialGains(ph.spatial, session.layout, frame.phaseMs)
  for (let ch = 0; ch < 8; ch++) out[ch] = Math.max(-1, Math.min(1, scale * gains[ch]))
  return out
}

// drive.cpp
export const DRIVE_DEFAULTS = { seriesOhm: 2200, coilOhm: 4.2, vFullScale: 10 }
export const maxCurrentMA = (cfg = DRIVE_DEFAULTS) => (cfg.vFullScale / (cfg.seriesOhm + cfg.coilOhm)) * 1000
export const maxFieldUT = (uTperMA, cfg = DRIVE_DEFAULTS) => maxCurrentMA(cfg) * uTperMA
