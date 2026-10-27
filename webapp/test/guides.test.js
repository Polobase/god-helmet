// Guide library: every guides/*.json passes validateGuide, plus the validator's own rules.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { validateGuide, guideHash, timedMinutes, stepSeconds, guides, CATEGORY_ORDER, libraryErrors, buildLibrary, trialSplit } from '../src/lib/guides.js'
import { parseSession } from '../src/engine/session.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const guidesDir = join(root, 'guides')
const presetsDir = join(root, 'presets')
const readJson = (dir, file) => JSON.parse(readFileSync(join(dir, file), 'utf8'))

const guideFiles = readdirSync(guidesDir).filter((f) => f.endsWith('.json'))
const presetIds = readdirSync(presetsDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
// Fixed instrument ids (contract with webapp/src/lib/instruments.js).
const instrumentIds = ['tipi', 'ipip-imagination', 'sss', 'senpq', 'expectancy', 'blinding', 'state-post', 'gateway-report']

const REQUIRED = [
  'gateway-prep', 'gateway-focus10', 'gateway-focus12', 'gateway-focus15', 'gateway-focus21', 'gateway-sleep',
  'gateway-sleep-morning',
  'crv-session', 'crv-curriculum', 'srv-basic', 'photo-target-trial', 'arv-binary', 'outbound-beacon', 'erv-extended',
  'mcmoneagle-practice', 'calibration-bracketing',
  'forced-choice-trainer', 'rng-pk', 'shapes-colors', 'psiball-detection', 'witness-well', 'psiwheel', 'pendulum-ideomotor',
  'obe-target-check', 'obe-target-record', 'helmet-factorial',
  'enrollment-battery', 'helmet-session-flow', 'psi-trial-flow',
]

test('every guide file is valid', () => {
  assert.ok(guideFiles.length >= REQUIRED.length)
  for (const file of guideFiles) {
    const errors = validateGuide(readJson(guidesDir, file), { presetIds, instrumentIds })
    assert.deepEqual(errors, [], `${file}:\n  ${errors.join('\n  ')}`)
  }
})

test('ids are unique, match the file names, and cover the library', () => {
  const ids = guideFiles.map((f) => readJson(guidesDir, f).id)
  assert.equal(new Set(ids).size, ids.length)
  guideFiles.forEach((f, i) => assert.equal(`${ids[i]}.json`, f))
  for (const id of REQUIRED) assert.ok(ids.includes(id), `missing guide ${id}`)
})

test('library rules hold for the guide files (split trials are continued)', () => {
  const entries = guideFiles.map((file) => ({ file, doc: readJson(guidesDir, file) }))
  libraryErrors(entries).forEach((errors, i) => assert.deepEqual(errors, [], `${entries[i].file}:\n  ${errors.join('\n  ')}`))
})

test('total minutes match the steps', () => {
  for (const file of guideFiles) {
    const doc = readJson(guidesDir, file)
    const sum = timedMinutes(doc)
    if (doc.steps.every((s) => stepSeconds(s) !== null)) assert.ok(Math.abs(doc.minutes - sum) <= 0.5, `${file}: ${doc.minutes} vs ${sum}`)
    else assert.ok(doc.minutes >= sum - 0.5, `${file}: ${doc.minutes} < ${sum}`)
  }
})

test('helmet arms fit their presets', () => {
  for (const file of guideFiles) {
    const doc = readJson(guidesDir, file)
    if (!doc.helmetArm) continue
    const session = parseSession(readJson(presetsDir, `${doc.helmetArm.preset}.json`))
    const armS = doc.helmetArm.steps.reduce((a, id) => a + (stepSeconds(doc.steps.find((s) => s.id === id)) ?? 0), 0)
    // The arm is stopped after its last step, so the program must last at least that long;
    // the guide's own presets add slack, as the helmet keeps running while the guide is paused.
    assert.ok(session.totalMs >= armS * 1000, `${file}: ${doc.helmetArm.preset} is shorter than its steps`)
    if (doc.helmetArm.preset.startsWith('guide-')) assert.ok(session.totalMs >= (armS + 300) * 1000, `${file}: ${doc.helmetArm.preset} has less than 5 min of slack`)
  }
})

test('helmet arms name their coil layout, and arms over a beat carry the Shakti caution', () => {
  const beat = (s) => (s.audio?.layers ?? []).some((l) => (typeof l.beat === 'object' ? l.beat.from > 0 || l.beat.to > 0 : l.beat > 0))
  for (const file of guideFiles) {
    const doc = readJson(guidesDir, file)
    if (!doc.helmetArm) continue
    const preset = readJson(presetsDir, `${doc.helmetArm.preset}.json`)
    if (preset.layout !== 'temporal') assert.match(doc.setting, new RegExp(`${preset.layout} layout`), `${file}: setting must ask for the ${preset.layout} layout`)
    const armSteps = doc.steps.filter((s) => doc.helmetArm.steps.includes(s.id))
    if (armSteps.some(beat)) assert.match(doc.cautions, /Shakti safety page/, `${file}: helmet arm over a beat without the Shakti caution`)
  }
})

test('no local paths in guides or guide presets', () => {
  const texts = [
    ...guideFiles.map((f) => readFileSync(join(guidesDir, f), 'utf8')),
    ...readdirSync(presetsDir).filter((f) => f.startsWith('guide-')).map((f) => readFileSync(join(presetsDir, f), 'utf8')),
  ]
  for (const t of texts) assert.doesNotMatch(t, /\/Users\/|file:\/\/|[A-Z]:\\\\/)
})

test('instrument ids exist in instruments.js when it is present', { skip: !existsSync(join(here, '..', 'src', 'lib', 'instruments.js')) }, async () => {
  const { INSTRUMENTS } = await import(pathToFileURL(join(here, '..', 'src', 'lib', 'instruments.js')).href)
  const known = Object.keys(INSTRUMENTS)
  for (const file of guideFiles) {
    const errors = validateGuide(readJson(guidesDir, file), { presetIds, instrumentIds: known })
    assert.deepEqual(errors, [], `${file}:\n  ${errors.join('\n  ')}`)
  }
})

test('loads in plain Node without Vite', () => {
  assert.ok(Array.isArray(guides))
  assert.equal(CATEGORY_ORDER[0], 'gateway')
})

test('guideHash is the SHA-256 of the JSON text', async () => {
  const h = await guideHash({ id: 'x' })
  assert.match(h, /^[0-9a-f]{64}$/)
  assert.equal(h, await guideHash({ id: 'x' }))
  assert.notEqual(h, await guideHash({ id: 'y' }))
})

// ---------------------------------------------------------------- validator rules

const base = () => ({
  id: 'test-guide',
  name: 'Test',
  category: 'gateway',
  summary: 'S',
  evidence: 'claim',
  minutes: 2,
  requires: { headphones: true, helmet: 'optional', pool: false },
  setting: 'Room',
  cautions: 'Careful',
  sources: [{ title: 'Source', url: 'https://example.org/' }],
  steps: [
    { id: 'one', title: 'One', minutes: 1, instructions: 'Do it.', audio: { layers: [{ carrier: 200, beat: 10 }], noise: { levelDb: -15 } }, advance: 'timer' },
    { id: 'two', title: 'Two', minutes: 1, instructions: 'Write.', input: { type: 'text', key: 'notes', prompt: 'Notes' }, advance: 'manual' },
  ],
})
const errs = (mutate, opts = { presetIds, instrumentIds }) => {
  const doc = base()
  mutate(doc)
  return validateGuide(doc, opts)
}
const has = (list, re) => assert.ok(list.some((e) => re.test(e)), `expected ${re} in:\n  ${list.join('\n  ')}`)

test('buildLibrary skips non-objects and flags duplicate ids and file names', () => {
  const doc = (id, category) => ({ ...base(), id, category })
  const warn = console.warn
  console.warn = () => {}
  try {
    const lib = buildLibrary({ '../guides/a.json': doc('a', 'sleep'), '../guides/null.json': null, '../guides/b.json': doc('a', 'gateway'), '../guides/c.json': doc('c', 'gateway') })
    assert.deepEqual(lib.map((g) => g.doc.category), ['gateway', 'gateway', 'sleep'])
    const byFile = (id, cat) => lib.find((g) => g.doc.id === id && g.doc.category === cat).errors
    has(byFile('a', 'sleep'), /also used by/)
    has(byFile('a', 'gateway'), /file name b\.json must be a\.json/)
    assert.deepEqual(byFile('c', 'gateway'), [])
  } finally {
    console.warn = warn
  }
})

test('the base document is valid', () => {
  assert.deepEqual(errs(() => {}), [])
})

test('top-level fields', () => {
  has(errs((d) => (d.id = 'Bad Id')), /^id /)
  has(errs((d) => (d.category = 'other')), /category/)
  has(errs((d) => (d.evidence = 'proven')), /evidence/)
  has(errs((d) => (d.requires.helmet = 'maybe')), /requires\.helmet/)
  has(errs((d) => delete d.cautions), /cautions/)
  has(errs((d) => (d.sources = [])), /sources/)
  has(errs((d) => (d.sources[0].url = '/local/file.pdf')), /url/)
  has(errs((d) => (d.extra = 1)), /unknown field "extra"/)
  has(errs((d) => (d.minutes = 5)), /does not match/)
})

test('durations and advance', () => {
  has(errs((d) => delete d.steps[0].minutes), /timer step needs/)
  has(errs((d) => (d.steps[0].seconds = 30)), /not both/)
  has(errs((d) => (d.steps[1].advance = 'timer')), /advance "manual"/)
  has(errs((d) => (d.steps[1].id = 'one')), /duplicate step id/)
  // Open-ended manual steps are allowed; minutes then only needs to cover the timed steps.
  assert.deepEqual(errs((d) => delete d.steps[1].minutes), [])
  has(errs((d) => { delete d.steps[1].minutes; d.minutes = 0.25 }), /less than the timed steps/)
})

test('audio ranges', () => {
  const layer = (patch) => (d) => Object.assign(d.steps[0].audio.layers[0], patch)
  has(errs(layer({ carrier: 10 })), /carrier/)
  has(errs(layer({ carrier: 2000 })), /carrier/)
  has(errs(layer({ beat: 41 })), /beat/)
  has(errs(layer({ beat: { from: 10, to: 50 } })), /glide/)
  assert.deepEqual(errs(layer({ beat: { from: 10, to: 7 }, rampS: 30 })), [])
  has(errs(layer({ gainDb: 3 })), /gainDb/)
  has(errs(layer({ startS: 50, rampS: 20 })), /exceed the step/)
  has(errs((d) => (d.steps[0].audio.noise.levelDb = -70)), /levelDb/)
  has(errs((d) => (d.steps[0].audio.crossfadeS = 90)), /crossfadeS exceeds/)
  has(errs((d) => (d.steps[0].audio = { layers: [] })), /at least one layer or noise/)
  assert.deepEqual(errs((d) => (d.steps[0].audio = null)), [])
  // Without rampS the fade-in lasts the crossfade (default 10 s).
  has(errs(layer({ startS: 55 })), /exceed the step/)
  assert.deepEqual(errs(layer({ startS: 45 })), [])
  has(errs((d) => { layer({ startS: 45 })(d); d.steps[0].audio.crossfadeS = 20 }), /exceed the step/)
  // Open-ended steps: a glide needs rampS, and fadeOutS cannot run.
  const open = (audio) => (d) => { delete d.steps[1].minutes; d.minutes = 1; d.steps[1].audio = audio }
  has(errs(open({ layers: [{ carrier: 200, beat: { from: 10, to: 7 } }] })), /open-ended step needs rampS/)
  assert.deepEqual(errs(open({ layers: [{ carrier: 200, beat: { from: 10, to: 7 }, rampS: 60 }] })), [])
  has(errs(open({ layers: [{ carrier: 200, beat: 7 }], fadeOutS: 20 })), /fadeOutS needs a step/)
})

test('a beat needs requires.headphones', () => {
  has(errs((d) => (d.requires.headphones = false)), /requires\.headphones must be true/)
  has(errs((d) => { d.requires.headphones = false; d.steps[0].audio.layers[0].beat = { from: 0, to: 4 } }), /requires\.headphones/)
  // Steady tones and noise play on speakers.
  assert.deepEqual(errs((d) => { d.requires.headphones = false; d.steps[0].audio.layers[0].beat = 0 }), [])
})

test('inputs', () => {
  const input = (value) => (d) => (d.steps[1].input = value)
  has(errs(input({ type: 'text', prompt: 'x' })), /key/)
  has(errs(input({ type: 'video' })), /input\.type/)
  has(errs(input({ type: 'rating', items: [{ key: 'a', label: 'A', min: 5, max: 1 }] })), /min < max/)
  has(errs(input({ type: 'questionnaire', instrument: 'nope' })), /unknown instrument/)
  assert.deepEqual(errs(input({ type: 'questionnaire', instrument: 'nope' }), { presetIds }), [])
  has(errs(input({ type: 'choice', key: 'c', prompt: 'p', options: ['a'], trials: 5, feedback: true })), /options/)
  has(errs(input({ type: 'choice', key: 'c', prompt: 'p', options: ['a', 'b'], trials: 0, feedback: true })), /trials/)
  has(errs(input({ type: 'crv', stage: 7, fields: [{ key: 'a', label: 'A', kind: 'words' }] })), /stage/)
  has(errs(input({ type: 'crv', stage: 1, fields: [{ key: 'a', label: 'A', kind: 'video' }] })), /kind/)
  has(errs(input({ type: 'rng', key: 'r', prompt: 'p', trials: 10, bits: 5000, aim: 'high' })), /bits/)
  has(errs(input({ type: 'rng', key: 'r', prompt: 'p', trials: 10, bits: 7, aim: 'high' })), /bits/)
  assert.deepEqual(errs(input({ type: 'rng', key: 'r', prompt: 'p', trials: 10, bits: 8, aim: 'high' })), [])
  has(errs(input({ type: 'rng', key: 'r', prompt: 'p', trials: 10, bits: 100, aim: 'up' })), /aim/)
  has(errs((d) => (d.steps[0] = { ...d.steps[0], advance: 'manual', input: { type: 'text', key: 'notes', prompt: 'p' } })), /used twice/)
})

test('trial order, pool and ARV outcome', () => {
  const t = (id, input) => ({ id, title: id, minutes: 1, instructions: 'x', input, advance: 'manual' })
  const cycle = [t('c', { type: 'trial', action: 'create', mode: 'rv', arv: true }), t('l', { type: 'trial', action: 'lock' }), t('j', { type: 'trial', action: 'judge' })]
  const outcome = { id: 'o', title: 'o', instructions: 'x', input: { type: 'outcome', key: 'out', prompt: 'p', options: ['A', 'B'] }, advance: 'manual' }
  const reveal = t('r', { type: 'trial', action: 'reveal' })
  const arv = (d) => { d.requires.pool = true; d.minutes = 6; d.steps.push(...cycle, outcome, reveal) }
  const push = (...steps) => (d) => { d.requires.pool = true; d.minutes = 2 + steps.reduce((a, s) => a + (s.minutes ?? 0), 0); d.steps.push(...steps) }
  const rv = t('c', { type: 'trial', action: 'create', mode: 'rv' })
  assert.deepEqual(errs(arv), [])
  has(errs((d) => { arv(d); d.requires.pool = false }), /requires\.pool/)
  has(errs(push(cycle[0], cycle[2], cycle[1], reveal)), /out of order/)
  has(errs(push(cycle[0], cycle[1], outcome, cycle[2], reveal)), /outcome belongs/)
  has(errs(push(t('l', { type: 'trial', action: 'lock', mode: 'rv' }))), /belong to the create action/)
  // A non-ARV trial must be finished; it may stop right after create (armed for another guide).
  has(errs(push(rv, cycle[1], cycle[2])), /ends at "judge"/)
  has(errs(push(rv, cycle[1])), /ends at "lock"/)
  assert.deepEqual(errs(push(rv)), [])
  // An ARV trial may stop after judge; the outcome and reveal follow in a resolve guide.
  assert.deepEqual(errs(push(...cycle)), [])
  assert.deepEqual(errs(push(outcome, reveal)), [])
  assert.deepEqual(errs(push(cycle[1], cycle[2], outcome, reveal)), [])
  has(errs((d) => { d.minutes = 3; d.steps.push(reveal) }), /requires\.pool/)
  has(errs(push(cycle[2], cycle[1])), /out of order/)
  // One outcome, followed by its reveal, and only one trial in a guide with an outcome.
  has(errs(push(outcome)), /needs the reveal/)
  has(errs(push(outcome, rv, reveal)), /followed by the reveal/)
  has(errs(push(...cycle, outcome, { ...outcome, id: 'o2', input: { ...outcome.input, key: 'out2' } }, reveal)), /only one outcome/)
  has(errs(push(...cycle, outcome, reveal, ...cycle.map((s) => ({ ...s, id: `${s.id}2` })), t('r2', { type: 'trial', action: 'reveal' }))), /only one ARV trial/)
  has(errs(push(rv, cycle[1], cycle[2], t('r0', { type: 'trial', action: 'reveal' }), ...cycle, outcome, reveal)), /only one trial/)
})

test('split trials are paired across the library', () => {
  const doc = (id, steps) => ({ ...base(), id, requires: { headphones: true, helmet: 'optional', pool: true }, steps })
  const t = (id, input) => ({ id, title: id, instructions: 'x', input, advance: 'manual' })
  const predict = doc('predict', [t('c', { type: 'trial', action: 'create', arv: true }), t('l', { type: 'trial', action: 'lock' }), t('j', { type: 'trial', action: 'judge' })])
  const resolve = doc('resolve', [t('o', { type: 'outcome', key: 'o', prompt: 'p', options: ['A', 'B'] }), t('r', { type: 'trial', action: 'reveal' })])
  const arm = doc('arm', [t('c', { type: 'trial', action: 'create' })])
  const record = doc('record', [t('l', { type: 'trial', action: 'lock' }), t('j', { type: 'trial', action: 'judge' }), t('r', { type: 'trial', action: 'reveal' })])
  assert.deepEqual(trialSplit(predict), { starts: null, stops: 'judge', arv: true })
  assert.deepEqual(trialSplit(resolve), { starts: 'reveal', stops: null, arv: false })
  const lib = (...docs) => libraryErrors(docs.map((d) => ({ file: `${d.id}.json`, doc: d })))
  // An ARV prediction is finished from its run summary; an armed target needs a guide that locks it.
  assert.deepEqual(lib(predict), [[]])
  assert.deepEqual(lib(arm, record), [[], []])
  has(lib(arm, resolve)[0], /no guide continues it with a "lock" step/)
})

test('helmet arm', () => {
  const arm = (a) => (d) => (d.helmetArm = a)
  assert.deepEqual(errs(arm({ preset: 'sham', blind: true, steps: ['one', 'two'] })), [])
  has(errs(arm({ preset: 'no-such-preset', blind: true, steps: ['one'] })), /does not exist/)
  assert.deepEqual(errs(arm({ preset: 'no-such-preset', blind: true, steps: ['one'] }), {}), [])
  has(errs(arm({ preset: 'sham', blind: true, steps: ['three'] })), /no step "three"/)
  has(errs(arm({ preset: 'sham', blind: true, steps: ['two', 'one'] })), /consecutive/)
  has(errs((d) => { arm({ preset: 'sham', blind: true, steps: ['one'] })(d); d.requires.helmet = 'none' }), /requires\.helmet/)
})
