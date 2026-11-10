// The brain view's data (webapp/src/lib/brain.js, plain JavaScript) with types
// on it. Nothing here adds behaviour. Light on purpose: the meshes and the
// region list load inside loadBrain(), and three.js is imported only by
// components/brain/Scene.vue, so a page can import this without either.
import * as brainJs from '#core/lib/brain.js'
import { HEAD_CENTRE as CORE_HEAD_CENTRE } from '#core/engine/field.js'
import type { Session } from './model'

/** A point or direction in MNI152 space (x right, y front, z up), mm. */
export type Vec3 = [number, number, number]

// ---------------------------------------------------------------- data
/** Where a note about a region comes from: a paper or a data set. */
export interface RegionSource { title: string, url?: string }
/** A curated target (cortex or deep), or the anatomy under a scalp site. */
export interface Region {
  id: string
  name: string
  kind: 'cortex' | 'deep' | 'site'
  /** Centre, MNI mm. */
  mni: Vec3
  /** Scalp to the region, mm. */
  depthMm?: number
  depthNote?: string
  /** The 10-05 site, for kind 'site'. */
  site?: string
  /** What the region does, by mainstream accounts. */
  function?: string
  /** What electrode or TMS stimulation of it did. */
  driven?: string
  drivenSources?: RegionSource[]
  /** Neurosynth meta-analysis terms. */
  terms?: string
  /** The Persinger-lab claim, and Murphy's own description. */
  claimed?: string
  murphy?: string
  sources?: RegionSource[]
}
/** One surface of the template brain, decoded. */
export interface BrainMesh {
  key: string
  name: string
  centroid: Vec3 | null
  /** x, y, z per vertex, MNI mm. */
  position: Float32Array
  /** Three vertex numbers per triangle. */
  index: Uint16Array | Uint32Array
}
export interface Brain {
  meshes: BrainMesh[]
  regions: Region[]
  zones: unknown[]
  siteGroups: unknown[]
  /** Where the data comes from, with licences. */
  sources: { mesh: string, regions: string }
}

// ---------------------------------------------------------------- estimates
export type Metric = 'peak' | 'rms'
/** A phase by its number, or the maximum over every phase. */
export type PhaseChoice = number | 'all'
/** Field per vertex, µT. */
export interface FieldStats { peak: Float32Array, rms: Float32Array }
export interface RegionExposure { region: Region, peak: number, rms: number }
export interface Exposure { meshes: Record<string, FieldStats>, regions: RegionExposure[] }
/** µT per vertex, by mesh key: what the scene paints. */
export type FieldValues = Record<string, Float32Array>
/** A coil on the head: the centre of its face and its axis, pointing inward. */
export interface CoilPose { site: string, face: Vec3, axis: Vec3 }
/** A single coil's field at the cortex straight below it. */
export interface UnderCoil { site: string, depthMm: number, uT: number }

// ---------------------------------------------------------------- the scene
export type ViewKey = 'iso' | 'left' | 'right' | 'front' | 'back' | 'top'
/** A coil as the scene draws it; weight 0 = not used in the phases shown. */
export interface SceneCoil extends CoilPose { weight: number }
/** A point picked on a surface: the mesh, its nearest vertex and the place. */
export interface ScenePick { key: string, vertex: number, point: Vec3 }

// ---------------------------------------------------------------- the core
/** 10-05 site positions, MNI mm. */
export const SITES = brainJs.SITES as unknown as Record<string, Vec3>
export const HEAD_CENTRE = CORE_HEAD_CENTRE as Vec3
/** The colour scale: log10 from min (dark) to max (bright), µT. */
export const SCALE = brainJs.SCALE as { min: number, max: number }
/** Meshes (1.5 MB) and regions, fetched once on first use. */
export const loadBrain = brainJs.loadBrain as unknown as () => Promise<Brain>
export const exposure = brainJs.exposure as unknown as (brain: Brain, session: Session, phase: PhaseChoice, uT?: number) => Exposure
/** The field at one instant for the coil drives of a frame (-1..1 per channel); reuses `out`. */
export const liveField = brainJs.liveField as unknown as (brain: Brain, session: Session, drives: number[], uT: number, out?: FieldValues) => FieldValues
export const underCoil = brainJs.underCoil as unknown as (brain: Brain, session: Session, uT: number) => (UnderCoil | null)[]
export const coilPoses = brainJs.coilPoses as unknown as (session: Session) => (CoilPose | null)[]
/** Position on the colour scale, 0..1. */
export const scalePos = brainJs.scalePos as (uT: number) => number
/** Colour on the scale as r, g, b in 0..1. */
export const fieldColor = brainJs.fieldColor as unknown as (uT: number) => Vec3
export const cssColor = brainJs.cssColor as (uT: number) => string
