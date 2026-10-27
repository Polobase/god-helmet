// Questionnaire instruments: structure, reverse keys, answer validation, alerts and published scoring examples.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  INSTRUMENTS, instrumentById, itemScale, itemInput, scaleAnchors, isAsked, checkAnswers, isComplete,
  sessionMinutes, bangIndex, SAFETY_HREF,
} from '../src/lib/instruments.js'

const IDS = ['tipi', 'ipip-imagination', 'sss', 'senpq', 'expectancy', 'blinding', 'state-post', 'gateway-report']
const KINDS = [undefined, 'choice', 'number']

// Every item at its lowest (or highest) allowed value.
const extreme = (inst, high) => Object.fromEntries(inst.items.map((item) => {
  const range = item.kind === 'number' ? item : itemScale(inst, item)
  return [item.id, high ? range.max : range.min]
}))

const allFinite = (scores) => Object.values(scores).every((v) => Number.isFinite(v))
const sha256 = (s) => createHash('sha256').update(s).digest('hex')
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`)

test('all fixed instrument ids exist and are well formed', () => {
  assert.deepEqual(Object.keys(INSTRUMENTS).sort(), [...IDS].sort())
  for (const id of IDS) {
    const inst = instrumentById(id)
    assert.equal(inst.id, id)
    for (const key of ['name', 'short', 'citation', 'url', 'license', 'instructions']) {
      assert.ok(typeof inst[key] === 'string' && inst[key].length > 0, `${id}.${key}`)
    }
    assert.ok(inst.scale.min < inst.scale.max, `${id} scale`)
    assert.equal(typeof inst.alerts, 'function', `${id} alerts`)
    assert.ok(inst.items.length > 0, `${id} items`)
    assert.equal(new Set(inst.items.map((i) => i.id)).size, inst.items.length, `${id} unique item ids`)
    for (const item of inst.items) assert.ok(item.text.length > 0, `${id}/${item.id} text`)
    for (const [name, ids] of Object.entries(inst.subscales ?? {})) {
      assert.ok(ids.length > 0 && ids.every((x) => inst.items.some((i) => i.id === x)), `${id} subscale ${name}`)
    }
  }
  assert.equal(instrumentById('nope'), null)
  assert.equal(instrumentById('constructor'), null)
  assert.ok(!/stays on this device/.test(INSTRUMENTS['ipip-imagination'].instructions))
})

test('every item resolves to the right control; number items never fall back to the instrument scale', () => {
  for (const inst of Object.values(INSTRUMENTS)) {
    for (const item of inst.items) {
      const at = `${inst.id}/${item.id}`
      assert.ok(KINDS.includes(item.kind), `${at} kind`)
      const s = itemScale(inst, item)
      const naive = item.scale ?? inst.scale // what a UI without itemScale() would use
      const input = itemInput(inst, item)
      if (item.kind === 'number') {
        assert.equal(s, null, `${at} itemScale`)
        assert.notEqual(naive, inst.scale, `${at} would show the instrument's rating row`)
        assert.ok(!naive, `${at} must not carry a button scale`)
        assert.ok(item.min < item.max && item.step > 0 && item.unit, `${at} min/max/step/unit`)
        assert.ok(Number.isInteger((item.max - item.min) / item.step), `${at} range is a whole number of steps`)
        assert.deepEqual(input, { kind: 'number', min: item.min, max: item.max, step: item.step, unit: item.unit })
        continue
      }
      assert.equal(s, naive, `${at} itemScale`)
      assert.ok(Number.isInteger(s.min) && Number.isInteger(s.max) && s.min < s.max, `${at} integer scale`)
      const n = s.max - s.min + 1
      assert.ok(s.labels.every((l) => typeof l === 'string' && l.length > 0), `${at} no empty labels`)
      if (item.kind === 'choice') {
        assert.equal(s.labels.length, n, `${at} choice: one label per point`)
        assert.deepEqual(input.options.map((o) => o.value), Array.from({ length: n }, (_, i) => s.min + i), `${at} options`)
      } else {
        assert.ok(s.labels.length === n || s.labels.length === 2, `${at} labels: every point or the two ends`)
        assert.equal(input.kind, 'scale')
        assert.equal(input.anchors.at(0).value, s.min)
        assert.equal(input.anchors.at(-1).value, s.max)
      }
    }
  }
})

test('categorical items show every label', () => {
  const b = INSTRUMENTS.blinding
  const guess = itemInput(b, b.items.find((i) => i.id === 'guess-audio'))
  assert.deepEqual(guess.options, [
    { value: -1, label: 'Sham (inactive)' }, { value: 0, label: 'Don\'t know' }, { value: 1, label: 'Real (active)' },
  ])
  const g = INSTRUMENTS['gateway-report']
  for (const id of ['hands', 'sleep', 'ae-headache']) assert.equal(g.items.find((i) => i.id === id).kind, 'choice', id)
  assert.equal(INSTRUMENTS.expectancy.items.find((i) => i.id === 'substances').kind, 'choice')
  assert.deepEqual(itemInput(g, g.items.find((i) => i.id === 'ae-nausea')).options.map((o) => o.label), ['None', 'Mild', 'Moderate', 'Severe'])
  // 0-10 rating rows carry end labels only, so no "1 = " legend entries
  assert.deepEqual(scaleAnchors(INSTRUMENTS['state-post'].scale), [{ value: 0, label: 'Not at all' }, { value: 10, label: 'Extremely' }])
  assert.equal(scaleAnchors(INSTRUMENTS.tipi.scale).length, 7)
})

test('score() returns finite numbers for all-min and all-max answers', () => {
  for (const inst of Object.values(INSTRUMENTS)) {
    for (const high of [false, true]) {
      const answers = extreme(inst, high)
      assert.ok(isComplete(inst, answers), `${inst.id} complete`)
      const scores = inst.score(answers)
      assert.ok(Object.keys(scores).length > 0, `${inst.id} has scores`)
      assert.ok(allFinite(scores), `${inst.id} ${high ? 'max' : 'min'}: ${JSON.stringify(scores)}`)
    }
  }
})

test('item counts match the published instruments', () => {
  assert.equal(INSTRUMENTS.tipi.items.length, 10)
  assert.equal(INSTRUMENTS['ipip-imagination'].items.length, 10)
  assert.equal(INSTRUMENTS.sss.items.length, 21)
  assert.equal(INSTRUMENTS.senpq.items.length, 16)
  assert.equal(INSTRUMENTS['gateway-report'].items.length, 19)
})

test('SSS and SenPQ text is unchanged (SSS licence forbids modification)', () => {
  const fingerprint = (i) => sha256(JSON.stringify({ instructions: i.instructions, copyright: i.copyright ?? null, labels: i.scale.labels, items: i.items.map((x) => x.text) }))
  assert.equal(fingerprint(INSTRUMENTS.sss), '94fe5f3cab906d21d8285408ad489963adc00c2ec7a6c3151a54a8da859ff1a2', 'SSS text changed')
  assert.equal(fingerprint(INSTRUMENTS.senpq), '2a000e514fc3e7f1908379b125bd0e9aa73a17071886ab92bfa5715b0691d144', 'SenPQ text changed')
  assert.ok(INSTRUMENTS.senpq.items.every((i) => !i.text.includes('\'')), 'SenPQ: one apostrophe style')
})

test('TIPI: published scoring example and reverse keys', () => {
  const tipi = INSTRUMENTS.tipi
  assert.deepEqual(tipi.items.filter((i) => i.reverse).map((i) => i.id), ['q2', 'q4', 'q6', 'q8', 'q10'])
  assert.equal(tipi.instructions.match(/I see myself as:/g).length, 1)
  assert.equal(tipi.stem, undefined)
  // Gosling's example: item 1 = 5, item 6 = 2 (recoded to 6) -> Extraversion (5 + 6) / 2 = 5.5
  const answers = { q1: 5, q2: 4, q3: 4, q4: 4, q5: 4, q6: 2, q7: 4, q8: 4, q9: 4, q10: 4 }
  assert.equal(tipi.score(answers).Extraversion, 5.5)
  const scores = tipi.score({ q1: 7, q2: 1, q3: 7, q4: 1, q5: 7, q6: 1, q7: 7, q8: 1, q9: 7, q10: 1 })
  assert.deepEqual(scores, {
    Extraversion: 7, Agreeableness: 7, Conscientiousness: 7, 'Emotional Stability': 7, 'Openness to Experiences': 7,
  })
  assert.ok(Object.values(tipi.score(extreme(tipi, false))).every((v) => v === 4))
  // array answers in item order work too
  assert.equal(tipi.score([5, 4, 4, 4, 4, 2, 4, 4, 4, 4]).Extraversion, 5.5)
})

test('IPIP Imagination (MPQ Absorption counterpart): 6 + keyed, 4 - keyed, sum 10-50', () => {
  const ipip = INSTRUMENTS['ipip-imagination']
  assert.deepEqual(ipip.items.filter((i) => i.reverse).map((i) => i.text).sort(), [
    'Do not like art.', 'Do not like poetry.', 'Rarely look for a deeper meaning in things.', 'Seldom get lost in thought.',
  ])
  assert.ok(ipip.items.some((i) => i.text === 'Enjoy wild flights of fantasy.' && !i.reverse))
  assert.equal(ipip.score(extreme(ipip, true)).total, 6 * 5 + 4 * 1)
  assert.equal(ipip.score(extreme(ipip, false)).total, 6 * 1 + 4 * 5)
  const keyed = Object.fromEntries(ipip.items.map((i) => [i.id, i.reverse ? 1 : 5]))
  assert.equal(ipip.score(keyed).total, 50)
  const anti = Object.fromEntries(ipip.items.map((i) => [i.id, i.reverse ? 5 : 1]))
  assert.equal(ipip.score(anti).total, 10)
})

test('SSS: sum of 21 items, no reverse keys, copyright shown', () => {
  const sss = INSTRUMENTS.sss
  assert.ok(sss.items.every((i) => !i.reverse))
  assert.equal(sss.score(extreme(sss, false)).total, 21)
  assert.equal(sss.score(extreme(sss, true)).total, 105)
  assert.match(sss.instructions, /Copyright © 2004 by R\. I\. Kotov/)
  assert.match(sss.url, /^https:\/\/renaissance\.stonybrookmedicine\.edu\//)
})

test('SenPQ: total, benign and malign sums (item 7 in both)', () => {
  const senpq = INSTRUMENTS.senpq
  assert.deepEqual(senpq.score(extreme(senpq, false)), { total: 16, Benign: 9, Malign: 8 })
  assert.deepEqual(senpq.score(extreme(senpq, true)), { total: 80, Benign: 45, Malign: 40 })
  const only7 = { ...extreme(senpq, false), q7: 5 }
  assert.deepEqual(senpq.score(only7), { total: 20, Benign: 13, Malign: 12 })
})

test('missing or invalid answers give null, not a wrong number', () => {
  const tipi = INSTRUMENTS.tipi
  const partial = { q1: 5, q6: 2 }
  const scores = tipi.score(partial)
  assert.equal(scores.Extraversion, 5.5)
  assert.equal(scores.Agreeableness, null)
  assert.equal(isComplete(tipi, partial), false)
  assert.equal(INSTRUMENTS.sss.score({ ...extreme(INSTRUMENTS.sss, true), q3: 9 }).total, null)

  const full = extreme(tipi, true)
  for (const bad of [2.5, true, false, [], {}, NaN, Infinity, 'abc', '0x5', '5a']) {
    const answers = { ...full, q1: bad }
    assert.equal(tipi.score(answers).Extraversion, null, `q1 = ${String(bad)}`)
    assert.deepEqual(checkAnswers(tipi, answers), { missing: [], invalid: ['q1'] }, `q1 = ${String(bad)}`)
    assert.equal(isComplete(tipi, answers), false)
  }
  for (const blank of ['', ' ', null, undefined]) {
    assert.deepEqual(checkAnswers(tipi, { ...full, q1: blank }), { missing: ['q1'], invalid: [] }, `q1 = ${JSON.stringify(blank)}`)
  }
  // 0-based scales: a blank or a boolean is not a 0 or a 1
  const ex = INSTRUMENTS.expectancy
  const exFull = extreme(ex, false)
  assert.equal(ex.score({ ...exFull, substances: ' ' }).Substances, null)
  assert.equal(ex.score({ ...exFull, substances: true }).Substances, null)
  assert.equal(ex.score({ ...exFull, relaxed: false }).Relaxed, null)
  // numeric strings (an <input> without .number) are fine
  assert.equal(tipi.score({ ...full, q1: ' 5 ', q6: '2' }).Extraversion, 5.5)
})

test('number items: range and step', () => {
  const ex = INSTRUMENTS.expectancy
  const base = extreme(ex, false)
  const sleep = (v) => ex.score({ ...base, 'sleep-hours': v })['Sleep (h)']
  assert.equal(sleep(7.5), 7.5)
  assert.equal(sleep('7.5'), 7.5)
  assert.equal(sleep(12), 12)
  assert.equal(sleep(24), 24)
  for (const bad of [7.3, -0.5, 24.5, 30]) assert.equal(sleep(bad), null, `sleep ${bad}`)
  const g = INSTRUMENTS['gateway-report']
  const gb = extreme(g, false)
  const est = (v) => g.score({ ...gb, 'time-estimate': v })['Time estimate (min)']
  assert.equal(est(36), 36)
  assert.equal(est(300), 300)
  for (const bad of [36.5, -1, 301]) assert.equal(est(bad), null, `estimate ${bad}`)
  assert.deepEqual(checkAnswers(g, { ...gb, 'time-estimate': 36.5 }).invalid, ['time-estimate'])
})

test('blinding: one guess per condition; confidence only after a real/sham guess', () => {
  const b = INSTRUMENTS.blinding
  const audioOnly = { blinded: { audio: true, helmet: false } }
  const item = (id) => b.items.find((i) => i.id === id)
  assert.equal(isAsked(b, item('guess-audio'), {}, audioOnly), true)
  assert.equal(isAsked(b, item('guess-helmet'), {}, audioOnly), false)
  assert.equal(isAsked(b, item('guess-helmet'), {}, {}), null) // unknown run: shown, not required

  assert.deepEqual(checkAnswers(b, {}, audioOnly).missing, ['guess-audio'])
  assert.equal(isComplete(b, { 'guess-audio': 0 }, audioOnly), true) // don't know: no confidence needed
  assert.deepEqual(checkAnswers(b, { 'guess-audio': 1 }, audioOnly).missing, ['confidence-audio'])
  assert.equal(isComplete(b, { 'guess-audio': -1, 'confidence-audio': 3 }, audioOnly), true)
  const both = { blinded: { audio: true, helmet: true } }
  assert.deepEqual(checkAnswers(b, { 'guess-audio': 0 }, both).missing, ['guess-helmet'])
  assert.equal(isComplete(b, {}, {}), true)

  assert.deepEqual(b.score({ 'guess-audio': -1, 'confidence-audio': 3, 'guess-helmet': 0 }), {
    'Guess: audio': -1, 'Confidence: audio': 3, 'Guess: helmet': 0, 'Confidence: helmet': null,
  })
})

test('Gateway time error, side effects and session minutes', () => {
  const g = INSTRUMENTS['gateway-report']
  const answers = { ...extreme(g, false), 'time-estimate': 20 }
  const s = g.score(answers, { actualMinutes: 30 })
  assert.equal(s['Time error (min)'], -10)
  assert.equal(s['Time error, absolute (min)'], 10)
  assert.equal(s['Side effects (sum)'], 0)
  assert.equal(g.score(extreme(g, true))['Side effects (sum)'], 21)
  assert.equal(g.score(answers, { actualMinutes: '30' })['Time error (min)'], -10)
  const bad = g.score(answers, { actualMinutes: 'soon' })
  assert.equal(bad['Time error (min)'], null)
  assert.ok('Time error, absolute (min)' in bad)
  assert.ok(!('Time error (min)' in g.score(answers)))
  assert.ok(!('Time error (min)' in g.score(answers, null)))

  const guide = {
    steps: [
      { id: 'intro' }, { id: 'f10', audio: { layers: [{ carrierHz: 200, beat: 4 }] } },
      { id: 'quiet', audio: { noise: { kind: 'pink' } } }, { id: 'field' }, { id: 'report' },
    ],
    helmetArm: { steps: ['field'] },
  }
  const steps = [
    { id: 'intro', activeMs: 60000 }, { id: 'f10', activeMs: 20 * 60000 }, { id: 'quiet', activeMs: 5 * 60000 },
    { id: 'field', activeMs: 3 * 60000 }, { id: 'report', activeMs: 120000 },
  ]
  assert.equal(sessionMinutes(guide, steps), 28)
  assert.equal(sessionMinutes({ steps: [{ id: 'a' }] }, [{ id: 'a', activeMs: 1000 }]), null)
  assert.equal(sessionMinutes(null, null), null)
})

test('state-post composite is the mean of the anomalous-experience items', () => {
  const sp = INSTRUMENTS['state-post']
  const answers = { ...extreme(sp, false), presence: 10, obe: 5 }
  assert.equal(sp.score(answers)['Anomalous experience'], 3)
  assert.match(sp.instructions, /5 = neutral/)
})

test('safety alerts', () => {
  const sp = INSTRUMENTS['state-post']
  const calm = { ...extreme(sp, false), valence: 6 }
  assert.deepEqual(sp.alerts(calm), [])
  assert.deepEqual(sp.alerts({}), []) // unanswered is not an alert
  const fear = sp.alerts({ ...calm, anxiety: 9 })
  assert.deepEqual(fear.map((a) => a.id), ['anxiety'])
  assert.equal(fear[0].href, SAFETY_HREF)
  assert.deepEqual(sp.alerts({ ...calm, presence: 6, anxiety: 5 }).map((a) => a.id), ['presence-fear'])
  assert.deepEqual(sp.alerts({ ...calm, presence: 6, anxiety: 4 }), [])
  assert.deepEqual(sp.alerts({ ...calm, valence: 1 }).map((a) => a.id), ['unpleasant'])

  const g = INSTRUMENTS['gateway-report']
  const fine = extreme(g, false)
  assert.deepEqual(g.alerts(fine), [])
  assert.deepEqual(g.alerts({ ...fine, 'ae-headache': 2 }), [])
  assert.deepEqual(g.alerts({ ...fine, 'ae-headache': 3, 'ae-low-mood': 2 }).map((a) => a.id), ['ae-headache', 'ae-low-mood'])
  assert.deepEqual(g.alerts({ ...fine, 'ae-anxiety': 2 }).map((a) => a.item), ['ae-anxiety'])

  const ex = INSTRUMENTS.expectancy
  assert.deepEqual(ex.alerts({ substances: 1 }).map((a) => a.id), ['substances'])
  assert.deepEqual(ex.alerts({ substances: 0 }), [])
  assert.deepEqual(INSTRUMENTS.senpq.alerts(extreme(INSTRUMENTS.senpq, true)), [])
})

test('instruments are frozen', () => {
  assert.ok(Object.isFrozen(INSTRUMENTS))
  assert.ok(Object.isFrozen(INSTRUMENTS.tipi.items[0]))
  assert.ok(Object.isFrozen(INSTRUMENTS['gateway-report'].items.at(-1).scale))
  assert.throws(() => { INSTRUMENTS.tipi.items[0].text = 'x' }, TypeError)
  assert.throws(() => { INSTRUMENTS.tipi.scale.labels.push('x') }, TypeError)
})

test('Bang blinding index per arm', () => {
  const rec = (arm, guess, n) => Array.from({ length: n }, () => ({ arm, guess }))
  const records = [
    ...rec('real', 'real', 6), ...rec('real', 'sham', 2), ...rec('real', 'dontknow', 2),
    ...rec('sham', 1, 3), ...rec('sham', -1, 3), ...rec('sham', 0, 4),
  ]
  const bi = bangIndex(records)
  assert.equal(bi.real.bi, (6 - 2) / 10)
  assert.equal(bi.sham.bi, 0)
  assert.equal(bi.real.dontKnow, 2)
  assert.equal(bi.excluded, 0)
  assert.ok(bi.real.se > 0)
  assert.equal(bangIndex([]).real.bi, null)
})

test('Bang index: SE reproduces a published 95% CI (Petroff et al. 2024, Table 4)', () => {
  // Group A: 36 guessed A, 12 guessed B, 19 don't know -> Bang 0.36 (0.17 to 0.54)
  // Group B: 18 guessed A, 6 guessed B, 9 don't know -> Bang -0.36 (-0.63 to -0.10)
  const rec = (arm, guess, n) => Array.from({ length: n }, () => ({ arm, guess }))
  const bi = bangIndex([
    ...rec('real', 'real', 36), ...rec('real', 'sham', 12), ...rec('real', 'dontknow', 19),
    ...rec('sham', 'real', 18), ...rec('sham', 'sham', 6), ...rec('sham', 'dontknow', 9),
  ])
  const z = 1.959964
  near(bi.real.bi, 0.36, 0.005, 'A estimate')
  near(bi.real.bi - z * bi.real.se, 0.17, 0.005, 'A lower')
  near(bi.real.bi + z * bi.real.se, 0.54, 0.005, 'A upper')
  near(bi.sham.bi, -0.36, 0.005, 'B estimate')
  near(bi.sham.bi - z * bi.sham.se, -0.63, 0.005, 'B lower')
  near(bi.sham.bi + z * bi.sham.se, -0.10, 0.005, 'B upper')
})

test('Bang index: string codes, app vocabulary and invalid records', () => {
  const two = bangIndex([{ arm: 'real', guess: '1' }, { arm: 'real', guess: '1' }])
  assert.equal(two.real.bi, 1)
  assert.equal(two.real.correct, 2)
  assert.equal(bangIndex([{ arm: 'sham', guess: '-1' }, { arm: 'sham', guess: ' +1 ' }]).sham.bi, 0)
  // helmet log ('active') and run summary ('unsure') words
  const app = bangIndex([{ arm: 'active', guess: 'active' }, { arm: 'active', guess: 'unsure' }, { arm: 'sham', guess: 'sham' }])
  assert.deepEqual([app.real.n, app.real.correct, app.real.dontKnow, app.sham.bi], [2, 1, 1, 1])
  // missing or unknown values are skipped, not counted as "don't know"
  const messy = bangIndex([
    { arm: 'real', guess: 'real' }, { arm: 'real', guess: null }, { arm: 'real' }, { arm: 'real', guess: '' },
    { arm: 'real', guess: true }, { arm: 'real', guess: 2 }, { arm: 'real', guess: 0.5 }, { arm: 'real', guess: 'maybe' },
    { arm: true, guess: 'real' }, { arm: 'placebo', guess: 'sham' }, null, { arm: 'constructor', guess: 'real' },
  ])
  assert.equal(messy.real.n, 1)
  assert.equal(messy.real.bi, 1)
  assert.equal(messy.real.dontKnow, 0)
  assert.equal(messy.excluded, 11)
  assert.equal(bangIndex(undefined).excluded, 0)
})
