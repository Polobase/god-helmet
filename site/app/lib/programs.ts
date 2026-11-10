// The program library and the open program (webapp/src/lib, plain JavaScript)
// with types on them. Nothing here adds behaviour. Heavy: it holds every
// program file, so only the app imports it. Types and small lookups are in
// lib/model.ts, the helmet connection in lib/device.ts.
import * as presetsJs from '#core/lib/presets.js'
import * as stateJs from '#core/lib/programState.js'
import * as readinessJs from '#core/lib/readiness.js'
import type { ShallowRef } from 'vue'
import type { DeviceInfo, DeviceState } from './device'
import type { Preset, SourceEntry } from './model'

export * from './model'

// ---------------------------------------------------------------- the library
export const presets = presetsJs.presets as Preset[]
export const presetById = presetsJs.presetById as (id: string) => Preset | undefined
export const groupedPresets = presetsJs.groupedPresets as () => { key: string, label: string, items: Preset[] }[]
export const sourceEntries = presetsJs.sourceEntries as (source?: string) => SourceEntry[]

// ---------------------------------------------------------------- the open program
export interface ProgramState {
  id: string
  /** Selected phase: Overview timeline and Brain phase chips. */
  phase: number
  /** Intensity at 20 mm: Brain estimate and Start. */
  uT: number
  /** Preview: times slower than real time. */
  speed: number
  startOpen: boolean
  /** What a sub-page should show first: 'measure' or 'place'. */
  focus: string
  /** A target region for the Brain page to open. */
  region: string
}
export interface LibraryState {
  mode: 'category' | 'placement' | 'site' | 'experience'
  query: string
  evidence: string
  category: string
  more: Record<string, boolean>
  lobe: string | null
  allGroups: boolean
  group: string | null
  site: string
  y: number
}
/** Programs that put the coils on the same sites. */
export interface PlacementGroup {
  key: string
  name: string
  sites: (string | null)[]
  programs: Preset[]
  lobes: string[]
  coils: number
  layout?: string
  basis?: string
  named?: boolean
  [key: string]: unknown
}
export interface PreviewFrame { drives: number[], phase: number, phaseMs: number, programMs: number }

export const program = stateJs.program as ProgramState
export const library = stateJs.library as LibraryState
export const preview = stateJs.preview as ShallowRef<PreviewFrame | null>
export const groups = stateJs.groups as PlacementGroup[]
export const groupOf = stateJs.groupOf as (id: string) => PlacementGroup | null
export const usedCoils = stateJs.usedCoils as (g: PlacementGroup | null) => number[]
export const placedCount = stateJs.placedCount as (g: PlacementGroup | null) => number
export const ticksOf = stateJs.ticksOf as (g: PlacementGroup | null) => boolean[]
export const selectProgram = stateJs.selectProgram as (id: string) => void
export const setPhase = stateJs.setPhase as (i: number) => void
export const startPreview = stateJs.startPreview as (fromPhase?: number) => void
export const stopPreview = stateJs.stopPreview as () => void

// ---------------------------------------------------------------- ready to start?
export interface ReadinessRow { key: string, status: 'ok' | 'warn' | 'bad', text: string, action?: string }
export const readiness = readinessJs.readiness as unknown as (o: { device: DeviceState, head: unknown, placed: number, used: number, nowS: number }) => ReadinessRow[]
export const hoursSinceLast = readinessJs.hoursSinceLast as (info: DeviceInfo | null, nowS: number) => number | null
export const minGapHours = readinessJs.minGapHours as (info: DeviceInfo | null) => number
