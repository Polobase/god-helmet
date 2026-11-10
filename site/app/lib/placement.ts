// Coil placement: the tape recipes, the user's head, the coil ticks and the
// site tables (webapp/src/lib, plain JavaScript) with types on them, and the
// few helpers the Placement page and the library's browse modes share.
import { computed, ref, shallowRef } from 'vue'
import * as brainJs from '#core/lib/brain.js'
import * as headJs from '#core/lib/head.js'
import * as tapeJs from '#core/lib/tape.js'
import * as placementsJs from '#core/lib/placements.js'
import { placementState as corePlacementState } from '#core/lib/placementState.js'
import { norm } from '#core/lib/search.js'
import type { PlacementGroup } from './programs'

// ---------------------------------------------------------------- sites
export type MapView = 'top' | 'left' | 'right'
export type Xyz = [number, number, number]
/** Every 10-05 site with its position on the template head (MNI, mm). */
export const SITES = brainJs.SITES as unknown as Record<string, Xyz | undefined>
/** The canonical name of a site ("fT7" is "FT7"), or null if there is no such site. */
export const siteName = brainJs.siteName as (name?: string | null) => string | null

/** Where a site sits in the 10-10 grid; null for landmarks and unknown names. */
export const parseSite = tapeJs.parseSite as unknown as (name?: string | null) => { name: string, side: 'left' | 'right' | 'mid', kind: string } | null
/** Side and part of the head in plain words: "Left, just above the ear". */
export const describeSite = (name: string) => (tapeJs.describeSite(name) as string).replace(' · ', ', ')

const sideOf = (name: string | null) => {
  const x = SITES[name ?? '']?.[0] ?? 0
  return x < -12 ? 'left' : x > 12 ? 'right' : 'mid'
}
/** The side view when every coil sits on one side, else the view from above. */
export function bestView(g: { sites: (string | null)[] }): MapView {
  const sides = new Set(g.sites.filter(Boolean).map((s) => sideOf(siteName(s))))
  const [only] = [...sides]
  return sides.size === 1 && only && only !== 'mid' ? only : 'top'
}

// ---------------------------------------------------------------- tape recipes
/** How to find one site with a tape measure, in cm for the head in use. */
export interface Recipe {
  name: string
  band: 'on' | 'above' | 'below'
  /** Distance from the band line along the head, cm. */
  bandCm: number
  text: string
  detail: string
  /** The cm value is scaled from the template head, not from a 10-10 rule. */
  estimate: boolean
  [key: string]: unknown
}
export const recipeFor = headJs.recipeFor as unknown as (site: string | null) => Recipe | null
/** "on the band", "3.5 cm above the band". */
export const bandText = headJs.bandText as (r: Recipe | null) => string

// ---------------------------------------------------------------- the user's head
export type HeadKey = 'nasionInion' | 'earEar' | 'circumference'
/** The three measurements as typed (cm; '' while empty). The core saves them on this device. */
export const head = headJs.head as Record<HeadKey, number | string | null>
export interface HeadInUse {
  nasionInion: number
  earEar: number
  circumference: number
  /** The measurements that are missing or out of range, replaced by typical values. */
  defaulted: HeadKey[]
  typical: boolean
}
export const headInUse = headJs.headInUse as unknown as () => HeadInUse
export const HEAD_DEFAULTS = tapeJs.HEAD_DEFAULTS as Record<HeadKey, number>
export const HEAD_LIMITS = tapeJs.HEAD_LIMITS as unknown as Record<HeadKey, [number, number]>
export const HEAD_LABELS = tapeJs.HEAD_LABELS as Record<HeadKey, string>

// ---------------------------------------------------------------- ticks and view
/** Kept in memory only: every session needs a fresh check of the coils. */
export interface PlacementState {
  /** Coils ticked as placed, per placement key. */
  placed: Record<string, boolean[]>
  view: { key: string, view: MapView } | null
  /** The coil list shows the measuring details of every row. */
  details: boolean
}
export const placementState = corePlacementState as PlacementState
/** "Layout A", "Shared placement", … */
export const placementKind = placementsJs.placementKind as unknown as (g: PlacementGroup) => string
/** A placement's name; generated names join their parts with a middle dot. */
export const placementName = (g: PlacementGroup) => g.name.replace(' · ', ', ')

// ---------------------------------------------------------------- what lies under the sites
export interface Citation { title: string, url?: string | null }
export interface Region {
  id: string
  name: string
  kind: 'site' | 'deep' | 'cortex' | (string & {})
  mni: number[]
  depthMm: number
  /** MRI and cap studies, separated by " | ". */
  anatomy: string
  function: string
  claimed?: string
  nearest?: string[]
  sources?: Citation[]
  site?: string
}
/** A 10-10 site the MRI tables cover. */
export interface SiteRegion extends Region { kind: 'site', site: string }
/** One of Murphy's scalp zones (claims). */
export interface Zone { name: string, sites: string[], anatomy: string, claimed: string, mainstream?: string, sources?: Citation[] }
/** What direct stimulation of an area did, and the sites over it. */
export interface StimulatedArea { area: string, sites: string[], driven: string, anatomy?: string, sources: Citation[] }
export interface RegionData { regions: Region[], zones: Zone[], siteGroups: StimulatedArea[], source?: string }
export type Charted = Record<string, SiteRegion>

const loadRegions = brainJs.loadRegions as unknown as () => Promise<RegionData>
const regionData = shallowRef<RegionData | null>(null)
const charted = computed<Charted>(() => Object.fromEntries(
  (regionData.value?.regions ?? []).filter((r): r is SiteRegion => r.kind === 'site' && !!r.site).map((r) => [r.site, r]),
))
let loading: Promise<unknown> | null = null
/**
 * The site tables (regions, Murphy's zones, stimulation findings), loaded on
 * first use and then shared. `charted` holds the 10-10 sites by name.
 */
export function useRegions() {
  loading ??= loadRegions().then((d) => (regionData.value = d))
  return { data: regionData, charted }
}

/** For a site the tables do not cover: the nearest one they do, and how far away (mm). */
export function nearestCharted(name: string, sites: Charted): { region: SiteRegion, mm: number } | null {
  const p = SITES[name]
  if (!p) return null
  let best: { region: SiteRegion, mm: number } | null = null
  for (const region of Object.values(sites)) {
    const q = SITES[region.site]
    if (!q) continue
    const mm = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    if (!best || mm < best.mm) best = { region, mm }
  }
  return best
}

// ---------------------------------------------------------------- the library's Placement mode
export const LOBES = ['temporal', 'frontal', 'central', 'parietal', 'occipital', 'inion'] as const
/** The placements a lobe and a filter text leave (name, sites and program names are searched). */
export function filterGroups(all: PlacementGroup[], lobe: string | null, query: string) {
  const q = norm(query.trim()) as string
  return all.filter((g) => (!lobe || g.lobes.includes(lobe))
    && (!q || (norm(`${g.name} ${g.sites.filter(Boolean).join(' ')} ${g.programs.map((p) => p.doc.name).join(' ')}`) as string).includes(q)))
}
/** Set by "Show this placement in the library": the gallery brings the open placement into view, once. */
export const revealOpenGroup = ref(false)
