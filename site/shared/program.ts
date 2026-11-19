// A program file (presets/*.json) as written: docs/PRESET_FORMAT.md.
// Types only. The lists themselves are in core/lib (categories.js, evidence.js,
// presetSchema.js, engine/patterns.js, engine/spatial.js); test/presets.test.ts
// keeps these unions equal to them.

export type Category = 'spiritual' | 'presence' | 'obe' | 'psi' | 'meditation' | 'mood' | 'dreams' | 'body' | 'signals' | 'courses'
  | 'lowfield' | 'persinger' | 'replication' | 'research' | 'control'
/** How well the source protocol is supported. */
export type Evidence = 'established' | 'single-lab' | 'claim' | 'anecdote' | 'unverified'
/** How well this helmet reproduces the cited exposure. */
export type Fidelity = 'exact' | 'approximation' | 'timing' | 'construct'
export type DoseUnit = 'nT' | 'mG' | 'uT' | 'mT'
export type DosePlane = 'scalp' | 'coil' | 'intracranial' | 'centre' | 'unstated'
/** What the source states about field strength, and where it was measured. */
export interface Dose {
  value: number | [number, number]
  unit: DoseUnit
  plane: DosePlane
  /** Source and page, e.g. "Persinger 2000 p.5 [663]". */
  cite: string
}

export type PatternType = 'off' | 'dc' | 'sine' | 'chirp' | 'burst' | 'thomas' | 'pulse' | 'semirandom' | 'table' | 'pm' | 'noise'
export interface PatternDoc {
  type: PatternType
  f0?: number
  f1?: number
  sweepMs?: number
  gapMs?: number
  pointMs?: number
  pulseMs?: number
  alternate?: boolean
  seed?: number
  depth?: number
  /** Point values 0–255, 128 = zero. */
  data?: number[]
  dataB64?: string
}
export type SpatialMode = 'bilateral' | 'left' | 'right' | 'rotate' | 'cycle' | 'alternate' | 'single'
export interface SpatialDoc {
  mode?: SpatialMode
  dir?: 'ccw' | 'cw'
  side?: 'left' | 'right' | 'both'
  dirLeft?: 'ccw' | 'cw'
  dirRight?: 'ccw' | 'cw'
  dwellMs?: number
  /** [start, step, end] in ms. */
  dwell?: [number, number, number]
  crossfade?: boolean
  alternateMs?: number
  channel?: number
  /** Eight multipliers −1…1; negative reverses a coil's polarity. */
  weights?: number[]
}
export interface TrackDoc {
  level?: number
  pattern?: PatternDoc
  spatial?: SpatialDoc
}
export interface PhaseDoc extends TrackDoc {
  name?: string
  minutes?: number
  seconds?: number
  crossfade?: boolean
  /** One or two tracks played together, instead of pattern / spatial / level. */
  tracks?: TrackDoc[]
}
export interface PlacementDoc {
  /** Eight 10-05 site names, '' for an unused channel. */
  sites: string[]
  /** Counter-clockwise rotation order: used channels 0–7. */
  order?: number[]
}
export interface ProgramDoc {
  id: string
  name: string
  category?: Category | (string & {})
  evidence?: Evidence | (string & {})
  fidelity?: Fidelity | (string & {})
  dose?: Dose
  origin?: string
  /** Peak field 20 mm in front of each coil, µT (0–5; default 1). */
  uT?: number
  summary?: string
  source?: string
  setting?: string
  schedule?: string
  notes?: string
  targets?: string[]
  layout?: 'ring' | 'temporal' | 'custom'
  placement?: PlacementDoc
  fadeInS?: number
  fadeOutS?: number
  phases?: PhaseDoc[]
  tableData?: number[]
  tableDataB64?: string
}
