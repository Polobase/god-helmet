// Guide runs: stored on this phone (IndexedDB store 'runs'), exported as JSON,
// plus the small statistics the guide tasks report. No DOM access at import.
import { idb } from './idb.js'
import { sha256Hex } from './crypto.js'
import { normalSf } from './stats.js'

export const EXPORT_FILENAME = 'godhelmet-guide-runs.json'

export const runId = (date = new Date()) => `run-${date.toISOString()}`

export async function listRuns() {
  const runs = await idb.getAll('runs')
  return runs.sort((a, b) => String(b.startedAt ?? '').localeCompare(String(a.startedAt ?? '')))
}

export const getRun = (id) => idb.get('runs', id)

// JSON round trip drops Vue proxies and anything not serialisable.
export const plain = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))

export async function saveRun(run) {
  await idb.put('runs', plain(run))
  return run
}

export const deleteRun = (id) => idb.delete('runs', id)

// A blind run whose audio is not revealed yet is exported without its sham flag.
export function redactRun(run) {
  const r = plain(run)
  if (r?.audio?.blind && !r.reveal?.audio) {
    delete r.audio.sham
    r.audio.shamHidden = true
  }
  return r
}

export function exportDoc(runs) {
  return { format: 'godhelmet-guide-runs', version: 1, exportedAt: new Date().toISOString(), runs: (runs ?? []).map(redactRun) }
}

export const exportBlob = (runs) => new Blob([JSON.stringify(exportDoc(runs), null, 2)], { type: 'application/json' })

// ---------------------------------------------------------------- steps

// Step length in ms from `minutes` / `seconds`; null for open-ended steps.
export function stepDurationMs(step) {
  const s = (Number(step?.minutes) || 0) * 60 + (Number(step?.seconds) || 0)
  return s > 0 ? Math.round(s * 1000) : null
}

export const plannedMs = (guide) => (guide?.steps ?? []).reduce((a, s) => a + (stepDurationMs(s) ?? 0), 0)

// First and last step index of the helmet arm, or null.
export function armRange(guide) {
  const idx = (guide?.helmetArm?.steps ?? []).map((id) => guide.steps.findIndex((s) => s.id === id)).filter((i) => i >= 0)
  return idx.length ? { first: Math.min(...idx), last: Math.max(...idx) } : null
}

export const stepHasAudio = (step) => !!(step?.audio && ((step.audio.layers ?? []).length || step.audio.noise))
export const hasAudio = (guide) => (guide?.steps ?? []).some(stepHasAudio)

// Drops in-progress state (e.g. an unanswered choice target) before a step is stored.
export function sealInput(input, value) {
  if (value == null) return null
  const v = plain(value)
  if (input?.type === 'choice') {
    const d = v[input.key || 'choice']
    if (d) delete d.pending
  }
  return v
}

const trialsOf = (input) => Math.max(1, Number(input?.trials) || 10)

// Why leaving this input now leaves it unfinished; '' when it is done (or has nothing to finish).
export function inputPending(input, value) {
  if (!input) return ''
  const key = input.key || input.type
  switch (input.type) {
    case 'rating': {
      const open = (input.items ?? []).filter((i) => value?.[i.key] == null).length
      return open ? `${open} rating${open > 1 ? 's are' : ' is'} not given.` : ''
    }
    case 'questionnaire': return value?.complete ? '' : 'The questionnaire is not complete.'
    case 'outcome': return value?.[key] === undefined ? 'No outcome is chosen.' : ''
    case 'choice': {
      const n = value?.[key]?.summary?.n ?? 0
      return n < trialsOf(input) ? `${n} of ${trialsOf(input)} trials done.` : ''
    }
    case 'rng': {
      const trials = value?.[key]?.trials ?? []
      if (trials.some((t) => t.complete === false && !t.interrupted)) return 'A trial is still collecting bits.'
      return trials.length < trialsOf(input) ? `${trials.length} of ${trialsOf(input)} trials done.` : ''
    }
    case 'trial': {
      const v = value ?? {}
      if (input.action === 'create') return v.trialId ? '' : 'No trial is created: the later trial steps need one.'
      if (input.action === 'lock') return v.responseHash ? '' : 'The response is not locked: judging and the reveal need it.'
      if (input.action === 'judge') return v.ranks ? '' : 'The pictures are not judged: the reveal needs it.'
      if (input.action === 'reveal') return v.revealed || v.deferred ? '' : 'The trial is not revealed yet.'
    }
  }
  return ''
}

// ---------------------------------------------------------------- statistics

// Exact P(X >= k) for X ~ Binomial(n, p). Sums the tail whose terms fall away
// from the mean, so a start term that underflows is negligible.
export function binomialTail(k, n, p) {
  if (k <= 0) return 1
  if (k > n) return 0
  if (p <= 0) return 0
  if (p >= 1) return 1
  const logPmf = (j) => {
    let l = j * Math.log(p) + (n - j) * Math.log1p(-p)
    for (let i = 1; i <= j; i++) l += Math.log((n - j + i) / i)
    return l
  }
  const r = p / (1 - p)
  let sum = 0
  if (k > n * p) {
    let pmf = Math.exp(logPmf(k))
    for (let i = k; i <= n && pmf > 0; i++) {
      sum += pmf
      pmf *= ((n - i) / (i + 1)) * r
    }
    return Math.min(1, sum)
  }
  // k at or below the mean: 1 - P(X <= k - 1)
  let pmf = Math.exp(logPmf(k - 1))
  for (let i = k - 1; i >= 0 && pmf > 0; i--) {
    sum += pmf
    pmf *= i / (n - i + 1) / r
  }
  return Math.min(1, Math.max(0, 1 - sum))
}

// Forced choice: passes are not scored (Tart's ten-choice trainer).
export function choiceSummary(trials, nOptions) {
  const scored = trials.filter((t) => !t.pass)
  const hits = scored.filter((t) => t.hit).length
  const p = 1 / Math.max(1, nOptions)
  return { n: scored.length, hits, passes: trials.length - scored.length, chance: p, expected: scored.length * p, p: binomialTail(hits, scored.length, p) }
}

export const choicePreimage = ({ trial, target, nonce }) => `godhelmet-choice|trial=${trial}|target=${target}|nonce=${nonce}`

export const isHex = (s) => typeof s === 'string' && /^(?:[0-9a-f]{2})+$/i.test(s)

// Uniform integer in [0, n) from random hex, by rejection sampling of 16-bit
// draws; null when every draw was rejected (ask for more bytes).
export function uniformFromHex(hex, n) {
  if (!isHex(hex) || !(n >= 1 && n <= 65536)) return null
  if (n === 1) return 0
  const limit = 65536 - (65536 % n)
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    const x = parseInt(hex.slice(i, i + 4), 16)
    if (x < limit) return x % n
  }
  return null
}

export function hexToBits(hex, nBits = hex.length * 4) {
  const bits = []
  for (let i = 0; i < nBits; i++) bits.push((parseInt(hex[i >> 2], 16) >> (3 - (i & 3))) & 1)
  return bits
}

// Hits against an alternating 1,0,1,0 target (May & Honorton): a constant
// generator bias towards 0 or 1 cancels out.
export const isHit = (bit, i) => bit === (i % 2 === 0 ? 1 : 0)
export const alternatingHits = (bits) => bits.reduce((a, b, i) => a + (isHit(b, i) ? 1 : 0), 0)

export const bitZ = (hits, n) => (n > 0 ? (hits - n / 2) / Math.sqrt(n / 4) : 0)

// Generation rate of the source protocol: 100-bit runs at 10 bits/s, 1,000-bit runs at 50 bits/s.
export const rngRate = (bits) => (bits > 100 ? 50 : 10)

// Micro-PK: success = hits on high-aim trials, misses on low-aim trials.
export function rngSummary(trials) {
  const side = (aim) => {
    const list = trials.filter((t) => t.aim === aim)
    const n = list.reduce((a, t) => a + t.bits, 0)
    const hits = list.reduce((a, t) => a + t.hits, 0)
    return { trials: list.length, n, hits, rate: n ? hits / n : null }
  }
  const high = side('high')
  const low = side('low')
  const none = side('none')
  // A control block (aim "none") is scored as hits against the target.
  const control = high.n + low.n === 0 && none.n > 0
  const n = control ? none.n : high.n + low.n
  const aimed = control ? none.hits : high.hits + (low.n - low.hits)
  const z = bitZ(aimed, n)
  const out = { n, aimed, rate: n ? aimed / n : null, z, p: n ? normalSf(z) : 1, high, low, none, control, diffZ: null }
  if (high.n && low.n) out.diffZ = (high.rate - low.rate) / Math.sqrt(0.25 / high.n + 0.25 / low.n)
  return out
}

// Local sidereal time in hours (same formula as the firmware and the demo).
export function lstHours(date, lonDeg) {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0
  const h = (18.697374558 + 24.06570982441908 * d + lonDeg / 15) % 24
  return h < 0 ? h + 24 : h
}

// ---------------------------------------------------------------- trials

// "godhelmet-trial|id=…|manifest=…|set=…|target=…|condition=…|nonce=…" (docs/BLE_PROTOCOL.md) -> fields, or null.
export function parseTrialPreimage(s) {
  const [tag, ...parts] = String(s ?? '').split('|')
  if (tag !== 'godhelmet-trial') return null
  const out = {}
  for (const p of parts) {
    const i = p.indexOf('=')
    if (i < 1) return null
    out[p.slice(0, i)] = p.slice(i + 1)
  }
  return out
}

// The preimage names exactly the revealed trial: id, pool, set, target, condition and nonce.
export function preimageMatches(t) {
  const f = parseTrialPreimage(t?.preimage)
  return !!f && f.id === String(t.id) && f.manifest === t.manifestHash && f.set === String(t.set) &&
    f.target === String(t.target) && f.condition === t.condition && f.nonce === t.nonce
}

// Text and sketch(es) of a response; extra sketches are covered by their hashes in the text.
export const responseHashOf = (trialId, r) => sha256Hex(JSON.stringify({ trialId, text: r.text, sketch: r.sketch }))
export const sketchDigests = (sketches) => Promise.all((sketches ?? []).map((s) => sha256Hex(s)))

// The three reveal checks: commitment (and preimage fields), pool manifest, stored response.
export async function trialChecks(t, { manifest, response }) {
  let resp = false
  if (response) {
    resp = (await responseHashOf(t.id, response)) === t.responseHash
    if (resp && response.sketches?.length > 1) resp = (await sketchDigests(response.sketches)).every((h) => response.text.includes(h))
  }
  return {
    commitment: (await sha256Hex(t.preimage ?? '')) === t.commitment && preimageMatches(t),
    pool: manifest === t.manifestHash,
    response: resp,
  }
}

// ARV: rank 1 on the helmet's target picture predicts the first option (A).
export const arvPrediction = (trial) => (trial.targetRank === 1 ? 0 : 1)

// Picture index (within the set) that belongs to outcome option 0 or 1.
export const arvPictureFor = (trial, option) => (option === 0 ? trial.target : trial.target === 0 ? 1 : 0)

// Index of the step with trial `action` in the same trial chain (create → lock → judge → reveal) as step `from`; -1 if none.
export function trialStepIndex(guide, from, action) {
  const steps = guide?.steps ?? []
  const isTrial = (i) => steps[i]?.input?.type === 'trial'
  let start = -1
  for (let i = Math.min(from, steps.length - 1); i >= 0; i--) {
    if (isTrial(i) && steps[i].input.action === 'create') {
      start = i
      break
    }
  }
  for (let i = Math.max(0, start); i < steps.length; i++) {
    if (!isTrial(i)) continue
    const a = steps[i].input.action
    if (a === 'create' && i !== start) break
    if (a === action) return i
  }
  return -1
}

// A guide may ask the ARV pass-check ratings in its own rating step after judging
// (two items of 0–7); then the judge step is a plain ranking.
export function arvPassStep(guide, judgeIdx) {
  const steps = guide?.steps ?? []
  if (judgeIdx < 0) return null
  for (let i = judgeIdx + 1; i < steps.length; i++) {
    const inp = steps[i].input
    if (inp?.type === 'trial') break
    if (inp?.type === 'rating' && inp.items?.length === 2 && inp.items.every((it) => (it.min ?? 0) === 0 && it.max === 7)) return steps[i]
  }
  return null
}

// Pass (not scored): the two 0–7 match ratings differ by less than 2 points, equal ratings included.
export const ratingsPass = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) < 2 : null)

// Pass flag of an ARV trial (null = unknown); valueOf(stepId) returns that step's input value.
export function arvPass(guide, judgeIdx, valueOf) {
  const ps = arvPassStep(guide, judgeIdx)
  if (ps) {
    const v = valueOf(ps.id)
    return ratingsPass(...ps.input.items.map((it) => v?.[it.key]))
  }
  const j = judgeIdx >= 0 ? valueOf(guide.steps[judgeIdx].id) : null
  return typeof j?.pass === 'boolean' ? j.pass : null
}

// Outcome step of an ARV trial (between its judge and reveal steps), or null.
export function arvOutcomeStep(guide, judgeIdx) {
  const steps = guide?.steps ?? []
  for (let i = Math.max(0, judgeIdx + 1); judgeIdx >= 0 && i < steps.length; i++) {
    if (steps[i].input?.type === 'trial') break
    if (steps[i].input?.type === 'outcome') return steps[i]
  }
  return null
}

// ARV trials of a stored run that still wait for their outcome and reveal (done later from the run summary).
export function pendingArv(record, guide) {
  const recs = record?.steps ?? []
  const gsteps = guide?.steps ?? []
  const recOf = (gi) => (gi < 0 ? -1 : recs.findIndex((r) => r.id === gsteps[gi].id))
  const valueOf = (id) => recs.find((r) => r.id === id)?.input
  const out = []
  for (const r of recs) {
    const v = r.input
    if (v?.action !== 'create' || !v.arv || !v.trialId) continue
    if (record.arvReveals?.[v.trialId]?.hit != null) continue
    const gi = gsteps.findIndex((s) => s.id === r.id)
    const judgeIdx = gi < 0 ? -1 : trialStepIndex(guide, gi, 'judge')
    const revealIdx = recOf(gi < 0 ? -1 : trialStepIndex(guide, gi, 'reveal'))
    if (revealIdx >= 0 && recs[revealIdx].input?.hit != null) continue
    const os = arvOutcomeStep(guide, judgeIdx)
    const key = os?.input.key || 'outcome'
    const outcomeIdx = os ? recs.findIndex((x) => x.id === os.id) : -1
    out.push({
      trialId: v.trialId, commitment: v.commitment ?? '', device: v.device ?? null,
      options: os?.input.options?.length ? os.input.options : ['A', 'B'], key, outcomeIdx, revealIdx,
      outcome: outcomeIdx >= 0 ? recs[outcomeIdx].input?.[key] ?? null : null,
      pass: gi < 0 ? null : arvPass(guide, judgeIdx, valueOf),
    })
  }
  return out
}

// ARV trials are 'rv' trials on the helmet, but their targetRank means "predicted A",
// not a hit: the Experiment statistics leave them out. Keyed by commitment (unique per trial).
const ARV_KEY = 'arv-trials'
export async function markArvTrial(t) {
  const list = (await idb.get('kv', ARV_KEY)) ?? []
  if (!list.some((x) => x.commitment === t.commitment)) {
    list.push({ id: t.id, commitment: t.commitment, at: new Date().toISOString() })
    await idb.put('kv', list, ARV_KEY)
  }
}
export const arvTrials = async () => (await idb.get('kv', ARV_KEY)) ?? []
export const isArvTrial = (list, t) => list.some((x) => x.commitment === t.commitment)

// ---------------------------------------------------------------- display

const short = (s, n = 80) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}
const fmtP = (p) => (p < 0.001 ? '< 0.001' : p.toFixed(3))

export function inputSummary(input, value) {
  if (!input || value == null) return ''
  const key = input.key || input.type
  switch (input.type) {
    case 'text': return short(value[key])
    case 'sketch': return value[key] ? 'sketch saved' : ''
    case 'outcome': return value[key] === undefined ? '' : value[key] === null ? 'not known yet' : `outcome ${value[key]}`
    case 'rating': return (input.items ?? []).filter((i) => value[i.key] != null).map((i) => `${i.label ?? i.key} ${value[i.key]}`).join(' · ')
    case 'questionnaire': return Object.entries(value.scores ?? {}).map(([k, v]) => `${k} ${typeof v === 'number' ? Math.round(v * 100) / 100 : v ?? '–'}`).join(' · ')
    case 'choice': {
      const s = value[key]?.summary
      return s ? `${s.hits}/${s.n} hits (chance ${s.expected.toFixed(1)}), p = ${fmtP(s.p)}` : ''
    }
    case 'rng': {
      const s = value[key]?.summary
      return s?.n ? `${s.aimed}/${s.n} bits in the aimed direction, z = ${s.z.toFixed(2)}` : ''
    }
    case 'crv': {
      const count = (vals) => Object.entries(vals ?? {}).reduce((a, [k, v]) => a + (k === 'at' ? 0 : Array.isArray(v) ? v.length : v ? 1 : 0), 0)
      const sets = value.iterations ?? [value.fields]
      const iter = value.iterations ? `${sets.length} iteration(s), ` : ''
      return `Stage ${value.stage ?? input.stage}: ${iter}${sets.reduce((a, v) => a + count(v), 0)} entries, ${(value.breaks ?? []).length} breaks`
    }
    case 'trial': {
      if (!value.trialId) return ''
      if (value.action === 'reveal' && value.arv) {
        if (value.hit == null) return `trial #${value.trialId}: ARV outcome pending`
        return `trial #${value.trialId}: ${value.pass ? 'ARV pass (not scored)' : value.hit ? 'ARV hit' : 'ARV miss'}`
      }
      if (value.action === 'reveal' && value.targetRank) return `trial #${value.trialId}: ${value.targetRank === 1 ? 'hit' : `rank ${value.targetRank}/${value.setSize}`}`
      return `trial #${value.trialId} ${value.action}`
    }
  }
  return ''
}
