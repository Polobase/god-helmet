// Blinded trials and the picture pool they draw from (webapp/src/lib, plain
// JavaScript) with types on them, plus the new-trial form, which has to
// outlive a page change. The protocol is in docs/BLE_PROTOCOL.md ("Trial
// commitment"), the method in docs/EXPERIMENTS.md.
import { reactive } from 'vue'
import * as poolJs from '#core/lib/pool.js'
import { sha256Hex as coreSha256Hex } from '#core/lib/crypto.js'
import { summarise as coreSummarise } from '#core/lib/stats.js'
import { arvTrials as coreArvTrials, isArvTrial as coreIsArvTrial } from '#core/lib/runs.js'
import { groupedPresets } from './programs'
import { loadResponse as loadStored, storeResponse as storeStored } from './responses'

// ---------------------------------------------------------------- trials
export type TrialMode = 'rv' | 'telepathy'
export type TrialState = 'open' | 'locked' | 'judging' | 'revealed' | 'aborted'
/** A trial as the helmet reports it; it tells more with each step. */
export interface Trial {
  id: number
  mode: TrialMode
  state: TrialState
  /** Unix seconds. */
  created: number
  presetId: string
  presetName: string
  blind: boolean
  manifestHash: string
  setCount: number
  commitment: string
  responseHash: string
  lockedAt: number
  kpValid: boolean
  kp: number
  ap: number
  /** Local sidereal time at lock, in hours; negative when unknown. */
  lst: number
  logId: number
  ranked: boolean
  /** 'hidden' in a blind trial until the reveal. */
  condition: 'hidden' | 'active' | 'sham' | 'none'
  // From judging on: the set and the shuffled display order.
  set?: string
  setSize?: number
  order?: number[]
  /** Rank per display position, once submitted. */
  ranks?: number[]
  // After the reveal.
  target?: number
  nonce?: string
  preimage?: string
  targetRank?: number
  revealedAt?: number
}
export interface TrialPage { total: number, items: Trial[] }
/** What a telepathy sender's phone gets while the trial is open. */
export interface SenderView { id: number, manifestHash: string, set: string, target: number }

export const MODE_NAME: Record<TrialMode, string> = { rv: 'remote viewing', telepathy: 'telepathy' }
/** States in which a trial still waits for a step. */
export const ACTIVE_STATES: TrialState[] = ['open', 'locked', 'judging']
export const isActive = (t: Trial) => ACTIVE_STATES.includes(t.state)

export const STEPS = ['Describe', 'Rank', 'Reveal'] as const
/** Where a trial is in the flow: 0 describe, 1 rank, 2 reveal, 3 done, -1 aborted. */
export const stepOf = (t: Trial) => ({ open: 0, locked: 1, judging: t.ranked ? 2 : 1, revealed: 3, aborted: -1 })[t.state] ?? -1

// ---------------------------------------------------------------- the new-trial form
// At module level: it survives leaving the tab (for instance the detour to the
// safety page), and the trial starts as chosen.
export const trialForm = reactive({ mode: 'rv' as TrialMode, presetId: 'remote-viewing', blind: true })

/** Programs that can run during a trial, by category, remote viewing and telepathy first. */
export const stimulationGroups = groupedPresets()
  .map((g) => ({ ...g, items: g.items.filter((p) => p.session) }))
  .filter((g) => g.items.length)
  .sort((a, b) => Number(b.key === 'psi') - Number(a.key === 'psi'))

// ---------------------------------------------------------------- the picture pool
export interface PoolImage { hash: string, blob: Blob, width: number, height: number }
export interface PictureSet { id: string, images: PoolImage[] }

export const SET_ID = poolJs.SET_ID as RegExp
export const listSets = poolJs.listSets as () => Promise<PictureSet[]>
export const getSet = poolJs.getSet as (id: string) => Promise<PictureSet | undefined>
export const addPictures = poolJs.addPictures as (setId: string, files: File[]) => Promise<PictureSet>
export const deleteSet = poolJs.deleteSet as (id: string) => Promise<void>
/** Sets a trial can use: 2 to 8 pictures. */
export const usableSets = poolJs.usableSets as (sets: PictureSet[]) => PictureSet[]
/** SHA-256 of every usable set's picture hashes, in order: the pool's fingerprint. */
export const manifestHash = poolJs.manifestHash as (sets: PictureSet[]) => Promise<string>
export const exportPool = poolJs.exportPool as () => Promise<Blob>
/** Resolves to the number of sets in the file. */
export const importPool = poolJs.importPool as (file: File) => Promise<number>

// ---------------------------------------------------------------- the response (kept on this phone)
export interface TrialResponse { trialId: number, text: string, sketch: string }

// Kept per helmet and trial (lib/responses.ts): every helmet numbers its trials from 1.
/** The stored response of trial `t` on helmet `helmet` (helmetKey()); empty when there is none. */
export const loadResponse = async (t: Trial, helmet: string): Promise<TrialResponse> => {
  const r = await loadStored(t, helmet)
  return { trialId: t.id, text: r?.text ?? '', sketch: r?.sketch ?? '' }
}
export const storeResponse = (r: TrialResponse, helmet: string) => storeStored({ trialId: r.trialId, text: r.text, sketch: r.sketch }, helmet)

export const sha256Hex = coreSha256Hex as (data: string | Uint8Array) => Promise<string>
/** What trial.lock sends: the hash of the response as it is stored. */
export const responseHash = (trialId: number, r: Pick<TrialResponse, 'text' | 'sketch'>) =>
  sha256Hex(JSON.stringify({ trialId, text: r.text, sketch: r.sketch }))

// ---------------------------------------------------------------- after the reveal
export interface TrialChecks { commitment: boolean, pool: boolean, response: boolean }
/** Nothing was changed: the commitment, the pool and the response still hash to what the helmet holds. */
export async function verifyTrial(t: Trial, sets: PictureSet[], r: Pick<TrialResponse, 'text' | 'sketch'>): Promise<TrialChecks> {
  return {
    commitment: (await sha256Hex(t.preimage ?? '')) === t.commitment,
    pool: (await manifestHash(sets)) === t.manifestHash,
    response: (await responseHash(t.id, r)) === t.responseHash,
  }
}

// ---------------------------------------------------------------- statistics
export interface TrialSummary { n: number, hits: number, expected: number, pHits: number, meanRank: number, z: number, pZ: number }
/** Hit and rank statistics of revealed trials (the same as tools/trial_stats.py); null for none. */
export const summarise = coreSummarise as (trials: Trial[]) => TrialSummary | null

/** An associative remote-viewing trial run from a guide, known by its commitment. */
export interface ArvTrial { commitment: string, [key: string]: unknown }
export const arvTrials = coreArvTrials as () => Promise<ArvTrial[]>
export const isArvTrial = coreIsArvTrial as (list: ArvTrial[], t: Trial) => boolean
