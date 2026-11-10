// Guided sessions: the guide files, their steps and inputs, the records of
// their runs, the questionnaires and the picture pool (webapp/src/lib, plain
// JavaScript) with types on them. Nothing here adds behaviour, except the
// library's filters, which outlive the page. The run itself is in
// lib/guideRun.ts.
import { reactive } from 'vue'
import * as guidesJs from '#core/lib/guides.js'
import * as runsJs from '#core/lib/runs.js'
import * as instrumentsJs from '#core/lib/instruments.js'
import * as poolJs from '#core/lib/pool.js'
import { idb as coreIdb } from '#core/lib/idb.js'
import { MODES as CORE_MODES } from '#core/audio/schedule.js'
import type { DeviceKind } from './device'

// ---------------------------------------------------------------- guide files
export type HelmetRequirement = 'none' | 'optional' | 'required'
export interface GuideRequires { headphones?: boolean, helmet?: HelmetRequirement, pool?: boolean }
export interface GuideSource { title: string, url?: string }

export interface AudioLayer { carrier: number, beat: number | { from: number, to: number }, gainDb?: number, startS?: number, rampS?: number }
export interface StepAudio { layers?: AudioLayer[], noise?: { levelDb: number, swellS?: number } | null, crossfadeS?: number, fadeOutS?: number }

export interface RatingItem { key: string, label?: string, min?: number, max?: number, minLabel?: string, maxLabel?: string }
export interface CrvField { key: string, label?: string, kind?: string }
export type TrialAction = 'create' | 'lock' | 'judge' | 'reveal'

export interface NoInputSpec { type: 'none' }
export interface TextInputSpec { type: 'text', key?: string, prompt?: string, placeholder?: string }
export interface SketchInputSpec { type: 'sketch', key?: string, prompt?: string }
export interface RatingInputSpec { type?: 'rating', prompt?: string, items?: RatingItem[] }
export interface QuestionnaireInputSpec { type: 'questionnaire', instrument: string }
export interface ChoiceInputSpec { type: 'choice', key?: string, prompt?: string, options?: (string | { label?: string })[], trials?: number, feedback?: boolean }
export interface CrvInputSpec { type: 'crv', stage?: number, fields?: CrvField[] }
export interface TrialInputSpec { type: 'trial', action: TrialAction, mode?: 'rv' | 'telepathy', arv?: boolean, prompt?: string }
export interface OutcomeInputSpec { type: 'outcome', key?: string, prompt?: string, options?: string[] }
export interface RngInputSpec { type: 'rng', key?: string, prompt?: string, trials?: number, bits?: number, aim?: string }
export type StepInput = NoInputSpec | TextInputSpec | SketchInputSpec | (RatingInputSpec & { type: 'rating' }) | QuestionnaireInputSpec
  | ChoiceInputSpec | CrvInputSpec | TrialInputSpec | OutcomeInputSpec | RngInputSpec

export interface GuideStep {
  id: string
  title: string
  minutes?: number
  seconds?: number
  /** Markdown, from the repository's own guide files. */
  instructions?: string
  audio?: StepAudio | null
  input?: StepInput
  advance?: 'timer' | 'manual'
}
export interface HelmetArm { preset: string, blind: boolean, steps: string[] }
/** A guide file (guides/*.json) as written. */
export interface GuideDoc {
  id: string
  name: string
  category: string
  summary?: string
  evidence?: string
  minutes?: number
  requires?: GuideRequires
  setting?: string
  cautions?: string
  unlock?: string
  sources?: GuideSource[]
  helmetArm?: HelmetArm
  steps: GuideStep[]
}
/** A guide file with the problems its validation found ([] = it can run). */
export interface GuideEntry { doc: GuideDoc, errors: string[] }

export const guides = guidesJs.guides as GuideEntry[]
export const guideById = guidesJs.guideById as (id: string) => GuideEntry | undefined
export const CATEGORY_LABELS = guidesJs.CATEGORY_LABELS as Record<string, string>
export const guideHash = guidesJs.guideHash as (doc: GuideDoc) => Promise<string>

/** A guide's page: its detail, and its runner while it runs. */
export const guidePath = (id: string) => `/app/guides/${encodeURIComponent(id)}`

/**
 * The library's search and filters, kept while a guide is open; `y` is where
 * the list was scrolled to, and `back` says the next visit returns from a guide.
 */
export const guideLibrary = reactive({ query: '', category: '', onlyHeadphones: false, onlyHelmet: false, y: 0, back: false })

// ---------------------------------------------------------------- audio
export type AudioMode = 'binaural' | 'monaural' | 'isochronic'
export const MODES = CORE_MODES as AudioMode[]
export interface AudioChoice { mode: AudioMode, levelDb: number, blind: boolean }

// ---------------------------------------------------------------- run records
/** What a step's input wrote: its shape belongs to the input type. */
export type InputValue = Record<string, unknown>

export interface RunStepRecord {
  id: string
  title?: string
  startedAt: string
  endedAt: string
  plannedMs: number | null
  activeMs?: number
  end: 'next' | 'skip' | 'timer' | 'stop'
  input: InputValue | null
  /** Why the input was left unfinished. */
  unfinished?: string
}
export interface RunAudio {
  enabled: boolean
  mode: AudioMode
  levelDb: number
  blind: boolean
  /** Left out of an export until the audio is revealed (then `shamHidden`). */
  sham?: boolean
  shamHidden?: boolean
  levelChanges: { at: string, step: number, levelDb: number }[]
  interruptions: { at: string, step: number }[]
  error: string
}
/** Which helmet: by its fixed id where the firmware reports one, else by how it was reached and its name. */
export interface RunDevice { kind: DeviceKind | null, name: string, firmware?: string, helmetId?: string }
/** The connection to the helmet dropped, or came back, during a run. */
export interface RunLinkEvent {
  at: string
  step: number
  event: 'lost' | 'back'
  /** What the app found when it was back. */
  found?: 'back' | 'running' | 'ended' | 'restarted' | 'other'
}
export interface RunHelmet {
  enabled: boolean
  presetId: string
  blind: boolean
  fieldUT: number | null
  device: RunDevice | null
  logId: number
  startedAt: string | null
  stoppedAt: string | null
  running: boolean
  error: string
  stopFailedAt?: string
  stopNote?: string
  /** The token the start carried: the helmet names its session by it, so the app finds it again. */
  token?: string
  /** Which start of the helmet it ran in (hello.bootId); 0 for older firmware. */
  bootId?: number
  /** The answer to the start was lost; the session was found on the helmet afterwards. */
  adopted?: boolean
  /** The stop at the end of the arm could not be sent: it is sent when the helmet is back and the session still runs. */
  stopPending?: boolean
  /** When that late stop was sent. */
  stopRetriedAt?: string
  /** What the connection did to the arm, in words. */
  linkNote?: string
}
/** Kp and sidereal time at the start: from the helmet, or from NOAA and the last known longitude. */
export interface RunEnv {
  from: string
  kpValid?: boolean
  kp?: number
  ap?: number
  kpSource?: string
  kpTime?: string
  kpNote?: string
  timeValid?: boolean
  lst?: number
  lstNote?: string
  longitude?: number
  [key: string]: unknown
}
export interface RunReveal {
  at: string
  rating: number
  notes: string
  guess: { audio?: string, helmet?: string }
  audio?: 'real' | 'sham'
  helmet?: string
  helmetAt?: string
}
export interface TrialChecks { commitment: boolean, pool: boolean, response: boolean }
/** An ARV trial scored after the run, once the outcome was known. */
export interface ArvReveal {
  trialId: number
  outcome: string
  prediction: string
  hit: boolean
  pass: boolean | null
  targetRank: number
  setSize: number
  condition: string
  set: string
  feedbackIndex: number
  checks: TrialChecks
  revealedAt: string
}
export interface RunRecord {
  id: string
  guideId: string
  guideName: string
  guideHash: string
  startedAt: string
  endedAt: string | null
  completed: boolean
  stopped: boolean
  steps: RunStepRecord[]
  audio: RunAudio
  helmet: RunHelmet
  env: RunEnv | null
  reveal: RunReveal | null
  arvReveals?: Record<string, ArvReveal>
  /** Every drop and return of the helmet connection during the run. */
  links?: RunLinkEvent[]
}
/** An ARV trial of a stored run that still waits for its outcome. */
export interface PendingArv {
  trialId: number
  commitment: string
  device: RunDevice | null
  options: string[]
  key: string
  outcomeIdx: number
  revealIdx: number
  outcome: string | null
  pass: boolean | null
}

export const EXPORT_FILENAME = runsJs.EXPORT_FILENAME as string
export const runId = runsJs.runId as (date?: Date) => string
export const listRuns = runsJs.listRuns as () => Promise<RunRecord[]>
export const saveRun = runsJs.saveRun as (run: RunRecord) => Promise<RunRecord>
export const deleteRun = runsJs.deleteRun as (id: string) => Promise<void>
/** Blind runs not revealed yet are exported without their sham flag. */
export const exportBlob = runsJs.exportBlob as (runs: RunRecord[]) => Blob
/** JSON round trip: drops Vue proxies and anything that cannot be stored. */
export const plain = runsJs.plain as <T>(value: T) => T

/** Step length in ms; null for an open-ended step. */
export const stepDurationMs = runsJs.stepDurationMs as (step: GuideStep | null | undefined) => number | null
export const plannedMs = runsJs.plannedMs as (guide: GuideDoc | null | undefined) => number
/** First and last step index of the helmet arm. */
export const armRange = runsJs.armRange as (guide: GuideDoc | null | undefined) => { first: number, last: number } | null
export const stepHasAudio = runsJs.stepHasAudio as (step: GuideStep | null | undefined) => boolean
export const hasAudio = runsJs.hasAudio as (guide: GuideDoc | null | undefined) => boolean
export const sealInput = runsJs.sealInput as (input: StepInput | undefined, value: InputValue | null | undefined) => InputValue | null
/** Why leaving this input now leaves it unfinished; '' when it is done. */
export const inputPending = runsJs.inputPending as (input: StepInput | undefined, value: InputValue | null | undefined) => string
export const inputSummary = runsJs.inputSummary as (input: StepInput | undefined, value: InputValue | null | undefined) => string
export const lstHours = runsJs.lstHours as (date: Date, lonDeg: number) => number

// ---------------------------------------------------------------- statistics of the tasks
export interface ChoiceSummary { n: number, hits: number, passes: number, chance: number, expected: number, p: number }
export interface ChoiceTrial {
  trial: number
  commitment: string
  nonce: string
  target: number
  targetLabel?: string
  source: string
  guess: number | null
  pass: boolean
  hit: boolean
  ms: number
  verified: boolean
}
export interface ChoicePending { trial: number, target: number, source: string, nonce: string, commitment: string, shownAt: number }
export const binomialTail = runsJs.binomialTail as (k: number, n: number, p: number) => number
export const choiceSummary = runsJs.choiceSummary as (trials: ChoiceTrial[], nOptions: number) => ChoiceSummary
export const choicePreimage = runsJs.choicePreimage as (p: { trial: number, target: number, nonce: string }) => string
export const uniformFromHex = runsJs.uniformFromHex as (hex: unknown, n: number) => number | null

export type RngAim = 'high' | 'low' | 'none'
export interface RngTrial {
  trial: number
  aim: RngAim
  bits: number
  planned: number
  hits: number
  hex: string
  source: string
  at: string
  complete: boolean
  endedAt?: string
  interrupted?: boolean
}
interface RngSide { trials: number, n: number, hits: number, rate: number | null }
export interface RngSummary { n: number, aimed: number, rate: number | null, z: number, p: number, high: RngSide, low: RngSide, none: RngSide, control: boolean, diffZ: number | null }
export const isHex = runsJs.isHex as (s: unknown) => s is string
export const hexToBits = runsJs.hexToBits as (hex: string, nBits?: number) => number[]
export const isHit = runsJs.isHit as (bit: number, i: number) => boolean
export const alternatingHits = runsJs.alternatingHits as (bits: number[]) => number
export const bitZ = runsJs.bitZ as (hits: number, n: number) => number
export const rngRate = runsJs.rngRate as (bits: number) => number
export const rngSummary = runsJs.rngSummary as (trials: RngTrial[]) => RngSummary

// ---------------------------------------------------------------- blinded trials
/** A trial as the helmet reports it (docs/BLE_PROTOCOL.md); it tells more with each step. */
export interface Trial {
  id: number
  mode: 'rv' | 'telepathy'
  state: 'open' | 'locked' | 'judging' | 'revealed' | 'aborted'
  created: number
  commitment: string
  manifestHash: string
  responseHash: string
  lockedAt: number
  kpValid: boolean
  kp: number
  lst: number
  ranked: boolean
  /** 'hidden' in a blind trial until the reveal. */
  condition: string
  // From judging on: the set, and the picture index per position on screen.
  set?: string
  setSize?: number
  order?: number[]
  /** Rank per position, once submitted. */
  ranks?: number[]
  // After the reveal.
  target?: number
  targetRank?: number
  preimage?: string
  nonce?: string
}
/** A trial in judging or revealed: its set is known. */
export type JudgedTrial = Trial & Required<Pick<Trial, 'set' | 'setSize' | 'order'>>
/** A revealed trial: target and rank are known too. */
export type RevealedTrial = JudgedTrial & Required<Pick<Trial, 'target' | 'targetRank'>>
export interface TrialResponse { trialId: number, text: string, sketch: string, sketches?: string[] }
export const responseHashOf = runsJs.responseHashOf as (trialId: number, r: TrialResponse) => Promise<string>
export const sketchDigests = runsJs.sketchDigests as (sketches: string[]) => Promise<string[]>
export const trialChecks = runsJs.trialChecks as (t: RevealedTrial, o: { manifest: string, response: TrialResponse | undefined }) => Promise<TrialChecks>
/** ARV: rank 1 on the helmet's target picture predicts the first option. */
export const arvPrediction = runsJs.arvPrediction as (t: RevealedTrial) => 0 | 1
export const arvPictureFor = runsJs.arvPictureFor as (t: RevealedTrial, option: number) => number
export const trialStepIndex = runsJs.trialStepIndex as (guide: GuideDoc, from: number, action: TrialAction) => number
export const arvPassStep = runsJs.arvPassStep as (guide: GuideDoc, judgeIdx: number) => (GuideStep & { input: RatingInputSpec }) | null
export const arvPass = runsJs.arvPass as (guide: GuideDoc, judgeIdx: number, valueOf: (stepId: string) => InputValue | null | undefined) => boolean | null
export const arvOutcomeStep = runsJs.arvOutcomeStep as (guide: GuideDoc, judgeIdx: number) => (GuideStep & { input: OutcomeInputSpec }) | null
export const pendingArv = runsJs.pendingArv as (record: RunRecord, guide: GuideDoc | null) => PendingArv[]
export const markArvTrial = runsJs.markArvTrial as (t: Trial) => Promise<void>

// ---------------------------------------------------------------- picture pool
export interface PoolImage { hash: string, blob: Blob, width: number, height: number }
export interface PictureSet { id: string, images: PoolImage[] }
export const listSets = poolJs.listSets as () => Promise<PictureSet[]>
export const getSet = poolJs.getSet as (id: string) => Promise<PictureSet | undefined>
/** Sets of 2 to 8 pictures. */
export const usableSets = poolJs.usableSets as (sets: PictureSet[]) => PictureSet[]
export const manifestHash = poolJs.manifestHash as (sets: PictureSet[]) => Promise<string>

/** The app's IndexedDB: 'sets', 'responses' (lib/responses.ts), 'kv', 'runs'. */
export const idb = coreIdb as {
  get: <T = unknown>(store: string, key: IDBValidKey) => Promise<T | undefined>
  getAll: <T = unknown>(store: string) => Promise<T[]>
  put: (store: string, value: unknown, key?: IDBValidKey) => Promise<unknown>
  delete: (store: string, key: IDBValidKey) => Promise<void>
}

// ---------------------------------------------------------------- questionnaires
// Items, scales, scoring and alerts come from the core as they are: the wording
// of the published instruments is under licence and must not be touched here.
export interface Scale { min: number, max: number, labels?: string[] }
export interface InstrumentItem {
  id: string
  text: string
  /** none = a row of numbers, 'choice' = every label shown, 'number' = a free number. */
  kind?: 'choice' | 'number'
  scale?: Scale | false
  optional?: boolean
  min?: number
  max?: number
  step?: number
  unit?: string
  askIf?: { blinded?: 'audio' | 'helmet', item?: string, in?: number[] }
}
export type Answers = Record<string, number | string | null | undefined>
export interface InstrumentAlert { id: string, item: string, message: string, href: string }
export interface Instrument {
  id: string
  name: string
  instructions?: string
  citation?: string
  url?: string
  license?: string
  scale?: Scale
  items: InstrumentItem[]
  score: (answers: Answers, context?: { actualMinutes?: number }) => Record<string, number | null> | null
  alerts: (answers: Answers) => InstrumentAlert[]
}
/** Which conditions of the run were blinded (for the blinding check). */
export interface AskContext { blinded: { audio: boolean, helmet: boolean } }
export const instrumentById = instrumentsJs.instrumentById as (id: string) => Instrument | null
export const itemScale = instrumentsJs.itemScale as (inst: Instrument, item: InstrumentItem) => Scale | null
/** true = ask and require, false = skip, null = unknown (show it, do not require it). */
export const isAsked = instrumentsJs.isAsked as (inst: Instrument, item: InstrumentItem, answers: Answers, context?: AskContext) => boolean | null
export const isComplete = instrumentsJs.isComplete as (inst: Instrument, answers: Answers, context?: AskContext) => boolean
/** Minutes the steps with audio or the helmet actually ran. */
export const sessionMinutes = instrumentsJs.sessionMinutes as (guide: GuideDoc, stepRecords: RunStepRecord[] | undefined) => number | null
