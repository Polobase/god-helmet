// Guide library: the JSON files in /guides (format: docs/GUIDES.md).
//
// The globs sit in a try block so this module also loads in plain Node (unit
// tests), where import.meta.glob does not exist. instruments.js is globbed
// rather than imported for the same reason; Vite still bundles it.
import { sha256Hex } from './crypto.js'
import { DEFAULT_CROSSFADE_S } from '../audio/schedule.js'

let files = {}
let presetFiles = {}
let instrumentModules = {}
try {
  files = import.meta.glob('../../../guides/*.json', { eager: true, import: 'default' })
  presetFiles = import.meta.glob('../../../presets/*.json', { eager: true, import: 'default' })
  instrumentModules = import.meta.glob('./instruments.js', { eager: true })
} catch {
  // not running under Vite
}

export const CATEGORY_LABELS = {
  gateway: 'Gateway-style sessions',
  'remote-viewing': 'Remote viewing',
  'esp-training': 'ESP training',
  'self-test': 'Psi self-tests',
  questionnaire: 'Questionnaires',
  sleep: 'Sleep',
}

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS)
export const EVIDENCE_LEVELS = ['established', 'single-lab', 'claim', 'anecdote', 'unverified']
export const HELMET_REQUIREMENTS = ['none', 'optional', 'required']
export const INPUT_TYPES = ['none', 'text', 'sketch', 'rating', 'questionnaire', 'choice', 'crv', 'trial', 'outcome', 'rng']
export const TRIAL_ACTIONS = ['create', 'lock', 'judge', 'reveal']
export const RNG_AIMS = ['high', 'low', 'alternate', 'none']
// crv fields: 'text' one line, 'words' one short entry per line, 'sketch' a drawing
export const CRV_FIELD_KINDS = ['text', 'words', 'sketch']

export const AUDIO_LIMITS = { carrier: [20, 1500], beat: [0, 40], gainDb: [-60, 0], levelDb: [-60, 0] }
export const MAX_RNG_BITS = 2048 // one rng.bytes call (n <= 256)
export const MIN_RNG_BITS = 8 // RngTask uses at least one byte per trial

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
const KEY = /^[a-z][a-z0-9_-]*$/

const GUIDE_KEYS = ['id', 'name', 'category', 'summary', 'evidence', 'minutes', 'requires', 'setting', 'cautions', 'unlock', 'sources', 'helmetArm', 'steps']
const STEP_KEYS = ['id', 'title', 'minutes', 'seconds', 'instructions', 'audio', 'input', 'advance']
const AUDIO_KEYS = ['layers', 'noise', 'crossfadeS', 'fadeOutS']
const LAYER_KEYS = ['carrier', 'beat', 'gainDb', 'startS', 'rampS']
const INPUT_KEYS = {
  none: [],
  text: ['key', 'prompt', 'placeholder'],
  sketch: ['key', 'prompt'],
  rating: ['items'],
  questionnaire: ['instrument'],
  choice: ['key', 'prompt', 'options', 'trials', 'feedback'],
  crv: ['stage', 'fields'],
  trial: ['action', 'mode', 'arv'],
  outcome: ['key', 'prompt', 'options'],
  rng: ['key', 'prompt', 'trials', 'bits', 'aim'],
}

// Duration of a step in seconds, or null for an open-ended step.
export function stepSeconds(step) {
  if (typeof step?.minutes === 'number') return step.minutes * 60
  if (typeof step?.seconds === 'number') return step.seconds
  return null
}

// Sum of the steps that have a duration (open-ended steps count 0).
export function timedMinutes(doc) {
  return (doc?.steps ?? []).reduce((a, s) => a + (stepSeconds(s) ?? 0), 0) / 60
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string' && v.trim() !== ''
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isInt = (v) => Number.isInteger(v)
const inRange = (v, [lo, hi]) => isNum(v) && v >= lo && v <= hi
const asSet = (v) => (v == null ? null : new Set(v))

function unknownKeys(obj, allowed, where, errors) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) errors.push(`${where}: unknown field "${k}"`)
}

// Checks one step's audio; returns true if a layer plays a non-zero beat.
function checkAudio(audio, durS, where, errors) {
  if (audio === null || audio === undefined) return false
  if (!isObj(audio)) {
    errors.push(`${where}: audio must be an object or null`)
    return false
  }
  unknownKeys(audio, AUDIO_KEYS, where, errors)
  if (!Array.isArray(audio.layers)) errors.push(`${where}: audio.layers must be an array (may be empty)`)
  const layers = Array.isArray(audio.layers) ? audio.layers : []
  if (!layers.length && !audio.noise) errors.push(`${where}: audio needs at least one layer or noise (use null for silence)`)
  // Without rampS a layer fades in over the step's crossfade (schedule.js riseCurve).
  const defaultRamp = isNum(audio.crossfadeS) ? audio.crossfadeS : DEFAULT_CROSSFADE_S
  let beat = false
  layers.forEach((l, i) => {
    const at = `${where}: audio.layers[${i}]`
    if (!isObj(l)) return errors.push(`${at} must be an object`)
    unknownKeys(l, LAYER_KEYS, at, errors)
    if (!inRange(l.carrier, AUDIO_LIMITS.carrier)) errors.push(`${at}.carrier must be 20-1500 Hz`)
    if (isObj(l.beat)) {
      unknownKeys(l.beat, ['from', 'to'], `${at}.beat`, errors)
      if (!inRange(l.beat.from, AUDIO_LIMITS.beat) || !inRange(l.beat.to, AUDIO_LIMITS.beat)) errors.push(`${at}.beat glide from/to must be 0-40 Hz`)
      // beatCurve glides over the rest of the step; an open-ended step would hold "from" forever.
      if (durS === null && l.rampS === undefined) errors.push(`${at}: a beat glide on an open-ended step needs rampS`)
      if (l.beat.from > 0 || l.beat.to > 0) beat = true
    } else if (!inRange(l.beat, AUDIO_LIMITS.beat)) errors.push(`${at}.beat must be 0-40 Hz or {from, to}`)
    else if (l.beat > 0) beat = true
    if (l.gainDb !== undefined && !inRange(l.gainDb, AUDIO_LIMITS.gainDb)) errors.push(`${at}.gainDb must be -60..0 dB`)
    if (l.startS !== undefined && !(isNum(l.startS) && l.startS >= 0)) errors.push(`${at}.startS must be >= 0`)
    if (l.rampS !== undefined && !(isNum(l.rampS) && l.rampS > 0)) errors.push(`${at}.rampS must be > 0`)
    const ramp = isNum(l.rampS) ? l.rampS : defaultRamp
    if (durS !== null && (isNum(l.startS) ? l.startS : 0) + ramp > durS) errors.push(`${at}: startS + rampS (default: the crossfade) exceed the step duration`)
  })
  if (audio.noise !== undefined && audio.noise !== null) {
    const at = `${where}: audio.noise`
    if (!isObj(audio.noise)) errors.push(`${at} must be an object or null`)
    else {
      unknownKeys(audio.noise, ['levelDb', 'swellS'], at, errors)
      if (!inRange(audio.noise.levelDb, AUDIO_LIMITS.levelDb)) errors.push(`${at}.levelDb must be -60..0 dB`)
      if (audio.noise.swellS !== undefined && !(isNum(audio.noise.swellS) && audio.noise.swellS > 0)) errors.push(`${at}.swellS must be > 0`)
    }
  }
  for (const k of ['crossfadeS', 'fadeOutS']) {
    if (audio[k] === undefined) continue
    if (!(isNum(audio[k]) && audio[k] >= 0)) errors.push(`${where}: audio.${k} must be >= 0`)
    else if (durS !== null && audio[k] > durS) errors.push(`${where}: audio.${k} exceeds the step duration`)
  }
  // fallCurve needs the step's end; on an open-ended step the fade would never run.
  if (durS === null && audio.fadeOutS > 0) errors.push(`${where}: audio.fadeOutS needs a step with minutes or seconds`)
  if (durS !== null && (audio.crossfadeS ?? 0) + (audio.fadeOutS ?? 0) > durS) errors.push(`${where}: crossfadeS + fadeOutS exceed the step duration`)
  return beat
}

const NEXT_TRIAL_ACTION = { none: 'create', create: 'lock', lock: 'judge', judge: 'reveal', reveal: 'create' }

// Where a guide's trial is split: `starts` is the first trial action when the
// guide continues a trial made elsewhere, `stops` the last one when the trial
// goes on elsewhere (null when complete); `arv` if that last trial is ARV.
export function trialSplit(doc) {
  const steps = Array.isArray(doc?.steps) ? doc.steps : []
  const actions = steps.filter((s) => s?.input?.type === 'trial').map((s) => s.input)
  const first = actions[0]?.action
  const last = actions.at(-1)?.action
  return {
    starts: first && first !== 'create' ? first : null,
    stops: last && last !== 'reveal' ? last : null,
    arv: actions.findLast((a) => a.action === 'create')?.arv === true,
  }
}

// Returns a list of problems; [] means the guide is valid. presetIds and
// instrumentIds (arrays or Sets) are checked only when given.
export function validateGuide(doc, { presetIds, instrumentIds } = {}) {
  const errors = []
  if (!isObj(doc)) return ['guide must be a JSON object']
  const presets = asSet(presetIds)
  const instruments = asSet(instrumentIds)
  unknownKeys(doc, GUIDE_KEYS, 'guide', errors)

  if (!(typeof doc.id === 'string' && ID.test(doc.id))) errors.push('id must be lowercase words joined by "-"')
  for (const k of ['name', 'summary', 'setting', 'cautions']) if (!isStr(doc[k])) errors.push(`${k} is required`)
  if (!CATEGORY_ORDER.includes(doc.category)) errors.push(`category must be one of ${CATEGORY_ORDER.join(', ')}`)
  if (!EVIDENCE_LEVELS.includes(doc.evidence)) errors.push(`evidence must be one of ${EVIDENCE_LEVELS.join(', ')}`)
  if (!(isNum(doc.minutes) && doc.minutes > 0)) errors.push('minutes must be a positive number')
  if (doc.unlock !== undefined && !isStr(doc.unlock)) errors.push('unlock must be a string')

  const req = doc.requires
  if (!isObj(req)) errors.push('requires is required: {headphones, helmet, pool}')
  else {
    unknownKeys(req, ['headphones', 'helmet', 'pool'], 'requires', errors)
    if (typeof req.headphones !== 'boolean') errors.push('requires.headphones must be true or false')
    if (!HELMET_REQUIREMENTS.includes(req.helmet)) errors.push('requires.helmet must be none, optional or required')
    if (typeof req.pool !== 'boolean') errors.push('requires.pool must be true or false')
  }

  if (!Array.isArray(doc.sources) || !doc.sources.length) errors.push('sources must list at least one source')
  else
    doc.sources.forEach((s, i) => {
      if (!isObj(s)) return errors.push(`sources[${i}] must be {title, url}`)
      unknownKeys(s, ['title', 'url'], `sources[${i}]`, errors)
      if (!isStr(s.title)) errors.push(`sources[${i}].title is required`)
      if (s.url !== undefined && !/^https?:\/\/\S+$/.test(s.url)) errors.push(`sources[${i}].url must be an http(s) URL`)
    })

  const steps = Array.isArray(doc.steps) ? doc.steps : []
  if (!steps.length) errors.push('steps must be a non-empty array')
  const stepIds = new Set()
  const keys = new Set()
  const usedInstruments = new Set()
  const crvStages = new Set()
  const addKey = (key, where) => {
    if (!(typeof key === 'string' && KEY.test(key))) return errors.push(`${where}: key must be lowercase letters, digits, "-" or "_"`)
    if (keys.has(key)) errors.push(`${where}: key "${key}" is used twice`)
    keys.add(key)
  }
  const prompt = (input, where) => {
    if (!isStr(input.prompt)) errors.push(`${where}: prompt is required`)
  }
  const options = (input, where, n) => {
    const o = input.options
    if (!Array.isArray(o) || o.length < 2 || o.some((x) => !isStr(x)) || new Set(o).size !== o.length) errors.push(`${where}: options must be at least 2 distinct strings`)
    else if (n && o.length !== n) errors.push(`${where}: options must have exactly ${n} entries`)
  }

  // Trial actions run create -> lock -> judge -> reveal, one trial at a time.
  // A trial may be split: the first trial steps of a guide may continue a
  // trial made elsewhere (TrialStep then offers the helmet's open trials), and
  // a guide may stop right after create (a target armed for another guide) or,
  // for ARV, after judge (outcome and reveal come later, in the run summary).
  let trialPhase = 'none' // none | create | lock | judge | reveal
  let arvTrial = false
  let continued = false
  let hasTrial = false
  let trialCount = 0
  let arvCount = 0
  let outcomeCount = 0
  let outcomeOpen = false // an outcome step waits for its reveal
  let beats = false

  steps.forEach((step, i) => {
    let where = `steps[${i}]`
    if (!isObj(step)) return errors.push(`${where} must be an object`)
    if (typeof step.id === 'string') where += ` (${step.id})`
    unknownKeys(step, STEP_KEYS, where, errors)
    if (!(typeof step.id === 'string' && ID.test(step.id))) errors.push(`${where}: id must be lowercase words joined by "-"`)
    else if (stepIds.has(step.id)) errors.push(`${where}: duplicate step id`)
    else stepIds.add(step.id)
    if (!isStr(step.title)) errors.push(`${where}: title is required`)
    if (!isStr(step.instructions)) errors.push(`${where}: instructions are required`)

    if (step.minutes !== undefined && step.seconds !== undefined) errors.push(`${where}: give minutes or seconds, not both`)
    for (const k of ['minutes', 'seconds']) if (step[k] !== undefined && !(isNum(step[k]) && step[k] > 0)) errors.push(`${where}: ${k} must be a positive number`)
    const durS = stepSeconds(step)
    if (!['timer', 'manual'].includes(step.advance)) errors.push(`${where}: advance must be timer or manual`)
    if (step.advance === 'timer' && durS === null) errors.push(`${where}: a timer step needs minutes or seconds`)

    if (checkAudio(step.audio, durS, where, errors)) beats = true

    const input = step.input ?? { type: 'none' }
    if (!isObj(input)) return errors.push(`${where}: input must be an object`)
    if (!INPUT_TYPES.includes(input.type)) return errors.push(`${where}: input.type must be one of ${INPUT_TYPES.join(', ')}`)
    unknownKeys(input, ['type', ...INPUT_KEYS[input.type]], `${where}: input`, errors)
    if (input.type !== 'none' && step.advance === 'timer') errors.push(`${where}: steps with an input must use advance "manual"`)
    const at = `${where}: input`

    switch (input.type) {
      case 'text':
        addKey(input.key, at)
        prompt(input, at)
        if (input.placeholder !== undefined && typeof input.placeholder !== 'string') errors.push(`${at}: placeholder must be a string`)
        break
      case 'sketch':
        addKey(input.key, at)
        prompt(input, at)
        break
      case 'rating':
        if (!Array.isArray(input.items) || !input.items.length) {
          errors.push(`${at}: items must be a non-empty array`)
          break
        }
        input.items.forEach((it, j) => {
          const w = `${at}.items[${j}]`
          if (!isObj(it)) return errors.push(`${w} must be an object`)
          unknownKeys(it, ['key', 'label', 'min', 'max', 'minLabel', 'maxLabel'], w, errors)
          addKey(it.key, w)
          if (!isStr(it.label)) errors.push(`${w}: label is required`)
          if (!(isInt(it.min) && isInt(it.max) && it.min < it.max)) errors.push(`${w}: min and max must be integers with min < max`)
          for (const k of ['minLabel', 'maxLabel']) if (it[k] !== undefined && typeof it[k] !== 'string') errors.push(`${w}: ${k} must be a string`)
        })
        break
      case 'questionnaire':
        if (!isStr(input.instrument)) errors.push(`${at}: instrument is required`)
        else {
          if (instruments && !instruments.has(input.instrument)) errors.push(`${at}: unknown instrument "${input.instrument}"`)
          if (usedInstruments.has(input.instrument)) errors.push(`${at}: instrument "${input.instrument}" is used twice`)
          usedInstruments.add(input.instrument)
        }
        break
      case 'choice':
        addKey(input.key, at)
        prompt(input, at)
        options(input, at)
        if (!(isInt(input.trials) && input.trials >= 1 && input.trials <= 500)) errors.push(`${at}: trials must be an integer 1-500`)
        if (typeof input.feedback !== 'boolean') errors.push(`${at}: feedback must be true or false`)
        break
      case 'crv': {
        if (!(isInt(input.stage) && input.stage >= 1 && input.stage <= 6)) errors.push(`${at}: stage must be 1-6`)
        else if (crvStages.has(input.stage)) errors.push(`${at}: stage ${input.stage} is used twice`)
        else crvStages.add(input.stage)
        if (!Array.isArray(input.fields) || !input.fields.length) {
          errors.push(`${at}: fields must be a non-empty array`)
          break
        }
        const fieldKeys = new Set()
        input.fields.forEach((f, j) => {
          const w = `${at}.fields[${j}]`
          if (!isObj(f)) return errors.push(`${w} must be an object`)
          unknownKeys(f, ['key', 'label', 'kind'], w, errors)
          if (!(typeof f.key === 'string' && KEY.test(f.key))) errors.push(`${w}: key must be lowercase letters, digits, "-" or "_"`)
          else if (fieldKeys.has(f.key)) errors.push(`${w}: key "${f.key}" is used twice`)
          fieldKeys.add(f.key)
          if (!isStr(f.label)) errors.push(`${w}: label is required`)
          if (!CRV_FIELD_KINDS.includes(f.kind)) errors.push(`${w}: kind must be one of ${CRV_FIELD_KINDS.join(', ')}`)
        })
        break
      }
      case 'trial': {
        const a = input.action
        if (!TRIAL_ACTIONS.includes(a)) {
          errors.push(`${at}: action must be one of ${TRIAL_ACTIONS.join(', ')}`)
          break
        }
        if (a !== 'create' && (input.mode !== undefined || input.arv !== undefined)) errors.push(`${at}: mode and arv belong to the create action`)
        if (input.mode !== undefined && !['rv', 'telepathy'].includes(input.mode)) errors.push(`${at}: mode must be rv or telepathy`)
        if (input.arv !== undefined && typeof input.arv !== 'boolean') errors.push(`${at}: arv must be true or false`)
        const expected = NEXT_TRIAL_ACTION[trialPhase]
        const continues = trialPhase === 'none' && a !== 'create'
        if (a !== expected && !continues) errors.push(`${at}: trial "${a}" out of order (expected "${expected}")`)
        if (outcomeOpen && a !== 'reveal') errors.push(`${at}: the outcome step must be followed by the reveal of its trial`)
        if (a === 'reveal') outcomeOpen = false
        hasTrial = true
        if (continues) {
          continued = true
          trialCount++
        }
        if (a === 'create') {
          trialCount++
          arvTrial = input.arv === true
          if (arvTrial) arvCount++
        }
        trialPhase = a
        break
      }
      case 'outcome': {
        addKey(input.key, at)
        prompt(input, at)
        options(input, at, 2)
        // TrialStep reads the first outcome step of the guide for every trial.
        if (++outcomeCount > 1) errors.push(`${at}: only one outcome step per guide`)
        const fits = trialPhase === 'judge' ? arvTrial || continued : trialPhase === 'none'
        if (!fits) errors.push(`${at}: an outcome belongs between the judge and reveal steps of an ARV trial`)
        outcomeOpen = true
        break
      }
      case 'rng':
        addKey(input.key, at)
        prompt(input, at)
        if (!(isInt(input.trials) && input.trials >= 1 && input.trials <= 1000)) errors.push(`${at}: trials must be an integer 1-1000`)
        if (!(isInt(input.bits) && input.bits >= MIN_RNG_BITS && input.bits <= MAX_RNG_BITS)) errors.push(`${at}: bits must be an integer ${MIN_RNG_BITS}-${MAX_RNG_BITS}`)
        if (!RNG_AIMS.includes(input.aim)) errors.push(`${at}: aim must be one of ${RNG_AIMS.join(', ')}`)
        break
    }
  })
  const mayStop = ['none', 'reveal', 'create'].includes(trialPhase) || (trialPhase === 'judge' && arvTrial)
  if (!mayStop) errors.push(`the trial ends at "${trialPhase}": add the remaining lock/judge/reveal steps (a guide may stop right after create, for another guide to continue, or an ARV trial after judge, for the run summary)`)
  if (outcomeOpen) errors.push('the outcome step needs the reveal of its trial after it')
  if (arvCount > 1) errors.push('only one ARV trial per guide (the outcome step belongs to it)')
  if (outcomeCount && trialCount > 1) errors.push('a guide with an outcome step can run only one trial (every 2-picture trial would be scored against that outcome)')
  if (hasTrial && isObj(req) && req.pool !== true) errors.push('requires.pool must be true for a guide with a trial')
  if (beats && isObj(req) && req.headphones !== true) errors.push('requires.headphones must be true when a layer has a beat (only then does the runner ask for headphones and fall back to isochronic mode on speakers)')

  if (doc.helmetArm !== undefined) {
    const arm = doc.helmetArm
    if (!isObj(arm)) errors.push('helmetArm must be {preset, blind, steps}')
    else {
      unknownKeys(arm, ['preset', 'blind', 'steps'], 'helmetArm', errors)
      if (!isStr(arm.preset)) errors.push('helmetArm.preset is required')
      else if (presets && !presets.has(arm.preset)) errors.push(`helmetArm.preset "${arm.preset}" does not exist`)
      if (typeof arm.blind !== 'boolean') errors.push('helmetArm.blind must be true or false')
      if (!Array.isArray(arm.steps) || !arm.steps.length) errors.push('helmetArm.steps must list at least one step id')
      else {
        const idx = arm.steps.map((id) => steps.findIndex((s) => s?.id === id))
        arm.steps.forEach((id, j) => {
          if (idx[j] < 0) errors.push(`helmetArm.steps: no step "${id}"`)
        })
        if (idx.every((x) => x >= 0) && idx.some((x, j) => j > 0 && x !== idx[j - 1] + 1)) errors.push('helmetArm.steps must be consecutive steps in order')
      }
      if (isObj(req) && req.helmet === 'none') errors.push('helmetArm needs requires.helmet optional or required')
    }
  }

  if (isNum(doc.minutes) && steps.length) {
    const sum = timedMinutes(doc)
    const allTimed = steps.every((s) => stepSeconds(s) !== null)
    if (allTimed && Math.abs(doc.minutes - sum) > 0.5) errors.push(`minutes (${doc.minutes}) does not match the steps (${+sum.toFixed(2)} min)`)
    if (!allTimed && doc.minutes < sum - 0.5) errors.push(`minutes (${doc.minutes}) is less than the timed steps (${+sum.toFixed(2)} min)`)
  }
  return errors
}

// Version of a guide for run records.
export async function guideHash(doc) {
  return sha256Hex(JSON.stringify(doc))
}

// Rules across the library, for [{file, doc}] (file: path or name of the JSON
// file). Returns one error list per entry: duplicate ids, file name vs id, and
// split trials that no other guide continues (an ARV trial stopped after judge
// is finished from the run summary instead).
export function libraryErrors(entries) {
  const out = entries.map(() => [])
  const ids = new Map()
  entries.forEach(({ file, doc }, i) => {
    if (!isObj(doc)) return
    const name = String(file ?? '').split('/').pop()
    if (typeof doc.id !== 'string') return
    if (name && name !== `${doc.id}.json`) out[i].push(`file name ${name} must be ${doc.id}.json`)
    if (ids.has(doc.id)) {
      out[i].push(`id "${doc.id}" is also used by ${entries[ids.get(doc.id)].file}`)
      out[ids.get(doc.id)].push(`id "${doc.id}" is also used by ${file}`)
    } else ids.set(doc.id, i)
  })
  const splits = entries.map(({ doc }) => (isObj(doc) ? trialSplit(doc) : {}))
  splits.forEach((s, i) => {
    if (!s.stops || (s.stops === 'judge' && s.arv)) return
    const want = NEXT_TRIAL_ACTION[s.stops]
    if (!splits.some((o, j) => j !== i && o.starts === want)) out[i].push(`the trial stops at "${s.stops}", but no guide continues it with a "${want}" step`)
  })
  return out
}

// [{doc, errors}] from {path: parsed JSON}, sorted by category order, then name.
// Files that are not JSON objects are skipped (with a console warning).
export function buildLibrary(fileMap, opts = {}) {
  const entries = Object.entries(fileMap)
    .filter(([file, doc]) => {
      if (isObj(doc)) return true
      console.warn(`${file}: a guide must be a JSON object; skipped`)
      return false
    })
    .map(([file, doc]) => ({ file, doc }))
  const shared = libraryErrors(entries)
  return entries
    .map(({ doc }, i) => ({ doc, errors: [...validateGuide(doc, opts), ...shared[i]] }))
    .sort((a, b) => {
      const ca = CATEGORY_ORDER.indexOf(a.doc.category)
      const cb = CATEGORY_ORDER.indexOf(b.doc.category)
      return ca - cb || String(a.doc.name).localeCompare(String(b.doc.name), undefined, { numeric: true })
    })
}

const presetIds = Object.values(presetFiles).map((d) => d?.id).filter(Boolean)
const instrumentModule = Object.values(instrumentModules)[0]
const instrumentIds = instrumentModule?.INSTRUMENTS ? Object.keys(instrumentModule.INSTRUMENTS) : undefined

export const guides = buildLibrary(files, { presetIds: presetIds.length ? presetIds : undefined, instrumentIds })

export const guideById = (id) => guides.find((g) => g.doc.id === id)

export function groupedGuides() {
  const groups = []
  for (const g of guides) {
    const key = g.doc.category || 'other'
    let group = groups.find((x) => x.key === key)
    if (!group) groups.push((group = { key, label: CATEGORY_LABELS[key] ?? key, items: [] }))
    group.items.push(g)
  }
  return groups
}
