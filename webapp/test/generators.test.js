// Timing checks for the published pulse-protocol tables.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { GENERATORS, cnpTable, CNP_ONSETS_MS, BHFS_STAGES, bhfs, itbs, ctbs, lfms, tpemf, cnpThomas, thomasLaurentian, primedBurst } from '../src/engine/generators.js'
import { parseSession } from '../src/engine/session.js'
import { patternValue } from '../src/engine/patterns.js'

const session = (pattern) => ({ id: 't', name: 't', layout: 'ring', phases: [{ name: 'p', minutes: 1, pattern, spatial: { mode: 'bilateral' } }] })
// Rising edges (zero -> non-zero) of the parsed table, sampled at the 2 kHz tick.
function onsets(pattern, ms) {
  const p = parseSession(session(pattern)).phases[0].pattern
  const out = []
  let prev = 0
  for (let t = 0; t < ms; t += 0.5) {
    const v = patternValue(p, t)
    if (v !== 0 && prev === 0) out.push(t)
    prev = v
  }
  return out
}

test('every generator yields a table the engine accepts', () => {
  for (const [name, gen] of Object.entries(GENERATORS)) {
    const { pattern, meta } = gen()
    assert.ok(pattern.data.length <= 8192, `${name}: ${pattern.data.length} points`)
    assert.ok(pattern.data.every((v) => Number.isInteger(v) && v >= 0 && v <= 255), `${name}: values`)
    assert.ok(pattern.gapMs >= 0, `${name}: gap`)
    assert.ok(meta.source && meta.periodMs > 0, `${name}: meta`)
    assert.doesNotThrow(() => parseSession(session(pattern)), name)
  }
})

test('iTBS: 30 pulses in 2 s, then 8 s silence, 50 Hz triplets at 5 Hz', () => {
  const { pattern, meta } = itbs()
  const t = onsets(pattern, 20000)
  assert.equal(meta.periodMs, 10000)
  assert.equal(t.filter((x) => x < 10000).length, 30)
  assert.deepEqual(t.slice(0, 4), [0, 20, 40, 200])
  assert.equal(t[30], 10000)
  assert.equal(meta.suggestedPhaseS, 192)
})

test('cTBS: 600 pulses in 40 s', () => {
  assert.equal(onsets(ctbs().pattern, 40000).length, 600)
})

test('LFMS: 500 Hz for 0.5 s every 2 s', () => {
  const { pattern } = lfms()
  const p = parseSession(session(pattern)).phases[0].pattern
  assert.equal(patternValue(p, 0), 1)
  assert.equal(patternValue(p, 1), -1)
  assert.equal(patternValue(p, 2), 1)
  assert.equal(patternValue(p, 499.5), -1)
  assert.equal(patternValue(p, 500), 0)
  assert.equal(patternValue(p, 2000), 1)
})

test('T-PEMF: 3 ms +, 3 ms -, 12 ms pause (18 ms period)', () => {
  const p = parseSession(session(tpemf().pattern)).phases[0].pattern
  assert.equal(patternValue(p, 2.5), 1)
  assert.equal(patternValue(p, 3), -1)
  assert.equal(patternValue(p, 5.5), -1)
  assert.equal(patternValue(p, 6), 0)
  assert.equal(patternValue(p, 18), 1)
  assert.equal(tpemf({ variant: 'tang' }).meta.periodMs, 20)
})

test('Cnp: the patent table decodes to 18 pulses ending at 847 ms', () => {
  const t = cnpTable()
  assert.equal(t.length, 900)
  const nz = t.map((v, i) => (v !== 0 ? i : -1)).filter((i) => i >= 0)
  assert.equal(nz[nz.length - 1], 847)
  const starts = t.map((v, i) => (v !== 0 && (i === 0 || t[i - 1] === 0) && t[i + 1] !== undefined ? i : -1)).filter((i) => i >= 0)
  // Each pulse has an interior zero (index 17), so pulse starts are every other rising edge.
  assert.deepEqual(starts.filter((_, k) => k % 2 === 0), CNP_ONSETS_MS)
  const { meta } = cnpThomas()
  assert.equal(meta.periodMs, 4 * 849 + 1860)
  assert.equal(cnpThomas({ burstMs: 838 }).meta.periodMs, 5212)
})

test('BHFS: 20 pulses per 62.6-ms train at the stage rates', () => {
  for (const { hz } of BHFS_STAGES) {
    const { pattern, meta } = bhfs({ hz })
    assert.ok(Math.abs(meta.periodMs - 1000 / hz) < 1e-9)
    const t = onsets(pattern, 1000)
    const perTrain = t.filter((x) => x < meta.periodMs).length
    assert.equal(perTrain, 20, `${hz} Hz`)
    assert.ok(t[19] <= 62.6)
  }
})

test('Thomas pulse at 3 ms: 849 points, 2.547 s per burst', () => {
  const { pattern, meta } = thomasLaurentian()
  assert.equal(pattern.data.length, 849)
  assert.equal(pattern.pointMs, 3)
  assert.equal(meta.periodMs, 2547)
  assert.equal(pattern.data[1], 12 + 128)
})

test('primed burst: primer, then 4 pulses at 100 Hz 150 ms later, 5 trains per second', () => {
  const { pattern, meta } = primedBurst()
  const t = onsets(pattern, 1000)
  assert.deepEqual(t.slice(0, 5), [0, 150, 160, 170, 180])
  assert.equal(t.length, 25)
  assert.equal(meta.periodMs, 1000)
  assert.ok(pattern.data.every((v) => v >= 128), 'positive only')
})
