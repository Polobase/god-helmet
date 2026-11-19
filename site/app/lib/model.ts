// The shapes of the shared core's data (core/, plain JavaScript) and the
// small lookups that go with them: evidence levels, fidelity, layouts, categories.
// Light on purpose: public pages import this, and it must not pull in the
// program library (lib/programs.ts) or the helmet connection (lib/device.ts).
import * as layoutsJs from '#core/lib/layouts.js'
import { sessionSites as coreSessionSites } from '#core/lib/brain.js'
import { EVIDENCE as CORE_EVIDENCE } from '#core/lib/evidence.js'
import { CATEGORY_LABELS as CORE_CATEGORY_LABELS } from '#core/lib/categories.js'
import { FIDELITY as CORE_FIDELITY, doseText as coreDoseText } from '#core/lib/presetSchema.js'
import type { Dose, ProgramDoc } from '#shared/program'

export type { Category, Dose, Evidence, Fidelity, PatternDoc, PhaseDoc, PlacementDoc, ProgramDoc, SpatialDoc, TrackDoc } from '#shared/program'

// ---------------------------------------------------------------- programs
export interface Pattern { type: string, [key: string]: unknown }
export interface Spatial { mode: string, ccw?: boolean, [key: string]: unknown }
export interface Track { level: number, pattern: Pattern, spatial: Spatial }
export interface Phase extends Track { name: string, durationMs: number, crossfade: boolean, track2: Track | null }
export type LayoutKey = 'ring' | 'temporal' | 'custom'
export interface Session {
  id: string
  name: string
  layout: LayoutKey
  geometry: { side: number[], order: number[] }
  /** Site name per channel, '' where a channel is unused. */
  sites: string[]
  fadeInMs: number
  fadeOutMs: number
  phases: Phase[]
  totalMs: number
}
/** A program file with its parsed session, or the reason it does not parse. */
export interface Preset { doc: ProgramDoc, session: Session | null, error: string | null }
export interface SourceEntry { text: string, url: string | null, extra: string[] }

export const CATEGORY_LABELS = CORE_CATEGORY_LABELS as Record<string, string>
export const categoryLabel = (key?: string) => (key ? CATEGORY_LABELS[key] ?? key : '')
/** The coil sites of a session, one per channel (null = unused). */
export const sessionSites = coreSessionSites as (session: Session) => (string | null)[]

export interface EvidenceLevel { label: string, info: string, tone: string }
export const EVIDENCE = CORE_EVIDENCE as Record<string, EvidenceLevel>
/** How well this helmet reproduces the cited exposure (docs/PRESET_FORMAT.md). */
export const FIDELITY = CORE_FIDELITY as Record<string, EvidenceLevel>
/** "1–5 µT at the scalp (Healey 1996 p.2)", or '' without a dose. */
export const doseText = coreDoseText as (dose?: Dose) => string

// ---------------------------------------------------------------- layouts
export interface LayoutChannel { site: string, where: string, region: string }
export interface Layout { key: LayoutKey, name: string, letter?: string, title: string, summary?: string, source?: string, channels?: LayoutChannel[] }
export const LAYOUTS = layoutsJs.LAYOUTS as unknown as Record<'ring' | 'temporal', Required<Layout>>
export const layoutInfo = layoutsJs.layoutInfo as (layout: string) => Layout
export const STATE_MAP = layoutsJs.STATE_MAP as { state: string, region: string, preset: string, [key: string]: unknown }[]
