// Pure helpers of the guide runner (lib/runs.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  runId, stepDurationMs, plannedMs, armRange, hasAudio, sealInput, binomialTail, choiceSummary, choicePreimage,
  hexToBits, alternatingHits, bitZ, rngSummary, arvPrediction, arvPictureFor, inputSummary, exportDoc,
  inputPending, redactRun, isHex, uniformFromHex, rngRate, lstHours, parseTrialPreimage, preimageMatches, trialChecks,
  trialStepIndex, arvPassStep, ratingsPass, arvPass, arvOutcomeStep, pendingArv,
} from '../src/lib/runs.js'
import { sha256Hex } from '../src/lib/crypto.js'
import { poissonBinomialTail } from '../src/lib/stats.js'

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`)

test('run ids and step durations', () => {
  assert.equal(runId(new Date('2026-01-02T03:04:05.000Z')), 'run-2026-01-02T03:04:05.000Z')
  assert.equal(stepDurationMs({ minutes: 1.5 }), 90000)
  assert.equal(stepDurationMs({ seconds: 20 }), 20000)
  assert.equal(stepDurationMs({ minutes: 1, seconds: 5 }), 65000)
  assert.equal(stepDurationMs({}), null)
  assert.equal(plannedMs({ steps: [{ minutes: 2 }, {}, { seconds: 30 }] }), 150000)
})

test('helmet arm range and audio detection', () => {
  const guide = { helmetArm: { steps: ['c', 'b', 'x'] }, steps: [{ id: 'a' }, { id: 'b', audio: null }, { id: 'c', audio: { layers: [{ carrier: 200, beat: 4 }] } }] }
  assert.deepEqual(armRange(guide), { first: 1, last: 2 })
  assert.equal(armRange({ steps: [] }), null)
  assert.equal(hasAudio(guide), true)
  assert.equal(hasAudio({ steps: [{ audio: null }, {}] }), false)
  assert.equal(hasAudio({ steps: [{ audio: { layers: [], noise: { levelDb: -15 } } }] }), true)
})

test('exact binomial tail matches the Poisson-binomial reference', () => {
  for (const [k, n, p] of [[0, 10, 0.5], [3, 10, 0.1], [7, 7, 0.5], [11, 30, 0.2], [40, 100, 0.25], [101, 100, 0.5]]) {
    close(binomialTail(k, n, p), k > n ? 0 : poissonBinomialTail(new Array(n).fill(p), k), 1e-9)
  }
  close(binomialTail(7, 7, 0.5), 0.0078125)
  assert.ok(binomialTail(600, 1000, 0.5) < 1e-9)
})

test('forced-choice summary ignores passes', () => {
  const trials = [{ hit: true }, { hit: false }, { pass: true }, { hit: true }, { hit: false }]
  const s = choiceSummary(trials, 4)
  assert.equal(s.n, 4)
  assert.equal(s.hits, 2)
  assert.equal(s.passes, 1)
  close(s.expected, 1)
  close(s.p, binomialTail(2, 4, 0.25))
  assert.equal(choicePreimage({ trial: 3, target: 1, nonce: 'ab' }), 'godhelmet-choice|trial=3|target=1|nonce=ab')
})

test('bits, alternating-target hits and z', () => {
  assert.deepEqual(hexToBits('a5'), [1, 0, 1, 0, 0, 1, 0, 1])
  assert.deepEqual(hexToBits('f0', 6), [1, 1, 1, 1, 0, 0])
  assert.equal(alternatingHits([1, 0, 1, 0]), 4)
  assert.equal(alternatingHits([1, 1, 1, 1]), 2) // constant bias cancels
  assert.equal(bitZ(50, 100), 0)
  close(bitZ(60, 100), 2)
})

test('micro-PK summary scores low-aim misses as successes', () => {
  const s = rngSummary([{ aim: 'high', bits: 100, hits: 60 }, { aim: 'low', bits: 100, hits: 40 }])
  assert.equal(s.n, 200)
  assert.equal(s.aimed, 120)
  close(s.z, bitZ(120, 200))
  assert.ok(s.p < 0.01)
  close(s.diffZ, 0.2 / Math.sqrt(0.0025 + 0.0025))
  assert.equal(rngSummary([{ aim: 'high', bits: 8, hits: 4 }]).diffZ, null)
  assert.equal(rngSummary([]).p, 1)
})

test('ARV mapping: rank 1 on the target predicts A', () => {
  assert.equal(arvPrediction({ targetRank: 1 }), 0)
  assert.equal(arvPrediction({ targetRank: 2 }), 1)
  assert.equal(arvPictureFor({ target: 1 }, 0), 1)
  assert.equal(arvPictureFor({ target: 1 }, 1), 0)
  assert.equal(arvPictureFor({ target: 0 }, 1), 1)
})

test('sealing and summarising inputs', () => {
  const choice = { type: 'choice', key: 'colours' }
  const sealed = sealInput(choice, { colours: { trials: [], pending: { target: 2 }, summary: { n: 10, hits: 4, expected: 2.5, p: 0.24 } } })
  assert.equal(sealed.colours.pending, undefined)
  assert.equal(inputSummary(choice, sealed), '4/10 hits (chance 2.5), p = 0.240')
  assert.equal(inputSummary({ type: 'text', key: 'intent' }, { intent: '  calm\n and  safe ' }), 'calm and safe')
  assert.equal(inputSummary({ type: 'rating', items: [{ key: 'calm', label: 'Calm' }, { key: 'x' }] }, { calm: 7 }), 'Calm 7')
  assert.equal(inputSummary({ type: 'outcome', key: 'o' }, { o: null }), 'not known yet')
  assert.equal(inputSummary({ type: 'crv', stage: 2 }, { stage: 2, fields: { s2: [{ text: 'cold' }, { text: 'grey' }], note: 'x' }, breaks: [{ kind: 'AOL' }] }), 'Stage 2: 3 entries, 1 breaks')
  assert.equal(inputSummary({ type: 'crv', stage: 1 }, { stage: 1, iterations: [{ at: 1, a: 'down', b: 'water', ideogram: 'data:x' }, { at: 2, a: '', b: '' }], breaks: [] }), 'Stage 1: 2 iteration(s), 3 entries, 0 breaks')
  assert.equal(inputSummary({ type: 'trial' }, { action: 'reveal', trialId: 4, targetRank: 1, setSize: 4 }), 'trial #4: hit')
  assert.equal(sealInput(choice, null), null)
})

test('export document format', () => {
  const doc = exportDoc([{ id: 'run-1' }])
  assert.equal(doc.format, 'godhelmet-guide-runs')
  assert.equal(doc.version, 1)
  assert.deepEqual(doc.runs, [{ id: 'run-1' }])
})

test('binomial tail far below the mean is about 1, not 0', () => {
  close(binomialTail(1, 1200, 0.5), 1, 1e-12)
  close(binomialTail(3, 10, 0.5), poissonBinomialTail(new Array(10).fill(0.5), 3), 1e-12)
  close(binomialTail(25, 100, 0.25), poissonBinomialTail(new Array(100).fill(0.25), 25), 1e-9)
  close(binomialTail(2, 4, 0.25), poissonBinomialTail(new Array(4).fill(0.25), 2), 1e-12)
})

test('unfinished inputs are named before leaving a step', () => {
  assert.equal(inputPending({ type: 'none' }, null), '')
  assert.equal(inputPending({ type: 'text', key: 't' }, null), '')
  assert.match(inputPending({ type: 'rating', items: [{ key: 'a' }, { key: 'b' }] }, { a: 3, b: null }), /1 rating is not given/)
  assert.equal(inputPending({ type: 'rating', items: [{ key: 'a' }] }, { a: 0 }), '')
  assert.match(inputPending({ type: 'questionnaire' }, { complete: false }), /not complete/)
  assert.equal(inputPending({ type: 'questionnaire' }, { complete: true }), '')
  assert.match(inputPending({ type: 'choice', key: 'c', trials: 25 }, { c: { summary: { n: 10 } } }), /10 of 25/)
  assert.equal(inputPending({ type: 'choice', key: 'c', trials: 2 }, { c: { summary: { n: 2 } } }), '')
  assert.match(inputPending({ type: 'rng', key: 'r', trials: 2 }, { r: { trials: [{ complete: true }, { complete: false }] } }), /still collecting/)
  assert.equal(inputPending({ type: 'rng', key: 'r', trials: 2 }, { r: { trials: [{ complete: true }, { complete: false, interrupted: true }] } }), '')
  assert.match(inputPending({ type: 'outcome', key: 'o' }, null), /No outcome/)
  assert.equal(inputPending({ type: 'outcome', key: 'o' }, { o: null }), '')
  assert.match(inputPending({ type: 'trial', action: 'lock' }, { action: 'lock', trialId: 3 }), /not locked/)
  assert.equal(inputPending({ type: 'trial', action: 'judge' }, { ranks: [1, 2] }), '')
  assert.equal(inputPending({ type: 'trial', action: 'reveal' }, { deferred: true }), '')
  assert.match(inputPending({ type: 'trial', action: 'reveal' }, { trialId: 3 }), /not revealed/)
})

test('export hides the sham flag of unrevealed blind runs', () => {
  const blind = { id: 'a', audio: { blind: true, sham: true }, reveal: null }
  assert.equal(redactRun(blind).audio.sham, undefined)
  assert.equal(redactRun(blind).audio.shamHidden, true)
  assert.equal(blind.audio.sham, true) // the stored run is untouched
  assert.equal(redactRun({ id: 'b', audio: { blind: true, sham: false }, reveal: { audio: 'real' } }).audio.sham, false)
  assert.equal(redactRun({ id: 'c', audio: { blind: false, sham: false } }).audio.sham, false)
  assert.equal(exportDoc([blind]).runs[0].audio.sham, undefined)
})

test('random hex helpers and RNG rate', () => {
  assert.ok(isHex('00ff'))
  assert.ok(!isHex('0g'))
  assert.ok(!isHex('abc'))
  assert.ok(!isHex(null))
  assert.equal(uniformFromHex('0003', 10), 3)
  assert.equal(uniformFromHex('fffa0007', 10), 7) // 0xfffa = 65530 >= 65530 is rejected
  assert.equal(uniformFromHex('fffa', 10), null)
  assert.equal(uniformFromHex('zz00', 10), null)
  assert.equal(uniformFromHex('1234', 1), 0)
  assert.equal(rngRate(100), 10)
  assert.equal(rngRate(1000), 50)
  const lst = lstHours(new Date('2026-03-20T12:00:00Z'), 15)
  assert.ok(lst >= 0 && lst < 24)
  close((lstHours(new Date('2026-03-20T12:00:00Z'), 30) - lst + 24) % 24, 1, 1e-9)
})

test('trial preimage fields must match the revealed trial', async () => {
  const t = { id: 7, manifestHash: 'm1', set: 'beach', target: 1, condition: 'none', nonce: 'ab12' }
  t.preimage = `godhelmet-trial|id=7|manifest=m1|set=beach|target=1|condition=none|nonce=ab12`
  t.commitment = await sha256Hex(t.preimage)
  assert.deepEqual(parseTrialPreimage(t.preimage), { id: '7', manifest: 'm1', set: 'beach', target: '1', condition: 'none', nonce: 'ab12' })
  assert.equal(parseTrialPreimage('other|id=1'), null)
  assert.ok(preimageMatches(t))
  assert.ok(!preimageMatches({ ...t, target: 0 }))
  assert.ok(!preimageMatches({ ...t, set: 'desert' }))
  const response = { text: 'cold water', sketch: 'data:image/png;base64,AA' }
  t.responseHash = await sha256Hex(JSON.stringify({ trialId: 7, text: response.text, sketch: response.sketch }))
  assert.deepEqual(await trialChecks(t, { manifest: 'm1', response }), { commitment: true, pool: true, response: true })
  // same commitment, but the revealed target differs from the preimage
  assert.equal((await trialChecks({ ...t, target: 0 }, { manifest: 'm1', response })).commitment, false)
  assert.equal((await trialChecks(t, { manifest: 'm2', response: null })).pool, false)
  // extra sketches must appear by hash in the text
  const s1 = 'data:image/png;base64,AA'
  const s2 = 'data:image/png;base64,BB'
  const text = `cold water\n\nSketches (SHA-256, in order):\n1. ${await sha256Hex(s1)}\n2. ${await sha256Hex(s2)}`
  const multi = { text, sketch: s2, sketches: [s1, s2] }
  const t2 = { ...t, responseHash: await sha256Hex(JSON.stringify({ trialId: 7, text, sketch: s2 })) }
  assert.equal((await trialChecks(t2, { manifest: 'm1', response: multi })).response, true)
  assert.equal((await trialChecks(t2, { manifest: 'm1', response: { ...multi, sketches: [s1, 'data:x'] } })).response, false)
})

const ARV = {
  steps: [
    { id: 'q', input: { type: 'text', key: 'question' } },
    { id: 'task', input: { type: 'trial', action: 'create', arv: true } },
    { id: 'lock', input: { type: 'trial', action: 'lock' } },
    { id: 'judge', input: { type: 'trial', action: 'judge' } },
    { id: 'fit', input: { type: 'rating', items: [{ key: 'fit-first', min: 0, max: 7 }, { key: 'fit-second', min: 0, max: 7 }] } },
    { id: 'outcome', input: { type: 'outcome', key: 'outcome', options: ['A', 'B'] } },
    { id: 'reveal', input: { type: 'trial', action: 'reveal' } },
    { id: 'task2', input: { type: 'trial', action: 'create' } },
    { id: 'judge2', input: { type: 'trial', action: 'judge' } },
  ],
}

test('ARV steps, pass check and outcome step', () => {
  assert.equal(trialStepIndex(ARV, 6, 'judge'), 3)
  assert.equal(trialStepIndex(ARV, 1, 'reveal'), 6)
  assert.equal(trialStepIndex(ARV, 7, 'judge'), 8)
  assert.equal(trialStepIndex(ARV, 0, 'judge'), -1) // before any trial
  assert.equal(arvPassStep(ARV, 3).id, 'fit')
  assert.equal(arvPassStep(ARV, 8), null)
  assert.equal(arvOutcomeStep(ARV, 3).id, 'outcome')
  assert.equal(ratingsPass(4, 4), true)
  assert.equal(ratingsPass(5, 4), true)
  assert.equal(ratingsPass(6, 4), false)
  assert.equal(ratingsPass(null, 4), null)
  const values = { fit: { 'fit-first': 6, 'fit-second': 2 }, judge: { pass: true } }
  assert.equal(arvPass(ARV, 3, (id) => values[id]), false) // the guide's own pass check wins
  const noFit = { steps: ARV.steps.filter((s) => s.id !== 'fit') }
  assert.equal(arvPass(noFit, 3, (id) => values[id]), true)
  assert.equal(arvPass(noFit, 3, () => null), null)
})

test('ARV trials waiting for their outcome', () => {
  const record = {
    steps: [
      { id: 'task', input: { action: 'create', trialId: 5, arv: true, commitment: 'c5', device: { kind: 'demo', name: 'Demo helmet' } } },
      { id: 'judge', input: { action: 'judge', trialId: 5, ranks: [2, 1] } },
      { id: 'fit', input: { 'fit-first': 5, 'fit-second': 4 } },
      { id: 'outcome', input: { outcome: null } },
      { id: 'reveal', input: { action: 'reveal', trialId: 5, arv: true, deferred: true, hit: null } },
    ],
  }
  const [p] = pendingArv(record, ARV)
  assert.deepEqual({ ...p, device: undefined }, { trialId: 5, commitment: 'c5', device: undefined, options: ['A', 'B'], key: 'outcome', outcomeIdx: 3, revealIdx: 4, outcome: null, pass: true })
  assert.equal(pendingArv({ ...record, arvReveals: { 5: { hit: false } } }, ARV).length, 0)
  const revealed = { steps: record.steps.map((s) => (s.id === 'reveal' ? { ...s, input: { ...s.input, hit: true } } : s)) }
  assert.equal(pendingArv(revealed, ARV).length, 0)
  assert.equal(pendingArv({ steps: [{ id: 'task', input: { action: 'create', trialId: 5 } }] }, ARV).length, 0) // not ARV
  assert.equal(inputSummary({ type: 'trial' }, record.steps[4].input), 'trial #5: ARV outcome pending')
  assert.equal(inputSummary({ type: 'trial' }, { action: 'reveal', trialId: 5, arv: true, hit: true, pass: true }), 'trial #5: ARV pass (not scored)')
  assert.equal(inputSummary({ type: 'trial' }, { action: 'reveal', trialId: 5, arv: true, hit: false, pass: false }), 'trial #5: ARV miss')
})
