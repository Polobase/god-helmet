// Parity between the JavaScript engine and the firmware's C++ engine.
// Regenerate the references after engine changes:
//   (cd firmware && ./test/run_host_tests.sh && ./.pio/host/engine_tests --dump ../presets ../webapp/test/engine-reference.json
//    && ./.pio/host/engine_tests --dump test/fixtures ../webapp/test/engine-fixtures-reference.json)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseSession, SessionRunner, render } from '../src/engine/session.js'
import { patternDefaults, patternValue } from '../src/engine/patterns.js'
import { spatialGains, dwellPosition, sideFromSite } from '../src/engine/spatial.js'
import { split, Reassembler, FIRST, LAST } from '../src/ble/frame.js'

const here = dirname(fileURLToPath(import.meta.url))
const presetsDir = join(here, '..', '..', 'presets')
const reference = JSON.parse(readFileSync(join(here, 'engine-reference.json'), 'utf8'))
const TOL = 2e-3

function compareRows(id, session, rows, label) {
  const runner = new SessionRunner()
  runner.start(session)
  let t = 0
  for (const row of rows) {
    const [programMs, phase, envelope, ...v] = row
    const f = runner.advance(programMs - t)
    t = programMs
    assert.ok(f.running, `${id} ${label}: running at ${programMs}`)
    assert.equal(f.phase, phase, `${id} ${label}: phase at ${programMs}`)
    assert.ok(Math.abs(f.envelope - envelope) < TOL, `${id} ${label}: envelope at ${programMs}`)
    const js = render(session, f)
    for (let ch = 0; ch < 8; ch++) {
      assert.ok(Math.abs(js[ch] - v[ch]) < TOL, `${id} ${label}: CH${ch + 1} at ${programMs} ms: js ${js[ch]} vs c++ ${v[ch]}`)
    }
  }
}

test('JS engine matches the C++ engine for every preset', () => {
  const files = readdirSync(presetsDir).filter((f) => f.endsWith('.json'))
  assert.ok(files.length >= 10)
  for (const file of files) {
    const doc = JSON.parse(readFileSync(join(presetsDir, file), 'utf8'))
    const session = parseSession(doc)
    const ref = reference[session.id]
    assert.ok(ref, `reference for ${session.id}`)
    compareRows(session.id, session, ref.coarse, 'coarse')
    compareRows(session.id, session, ref.fine, 'fine')
  }
})

test('JS engine matches the C++ engine for the engine-v2 fixtures', () => {
  const fixtures = join(here, '..', '..', 'firmware', 'test', 'fixtures')
  const ref = JSON.parse(readFileSync(join(here, 'engine-fixtures-reference.json'), 'utf8'))
  const files = readdirSync(fixtures).filter((f) => f.endsWith('.json'))
  assert.ok(files.length >= 1)
  for (const file of files) {
    const session = parseSession(JSON.parse(readFileSync(join(fixtures, file), 'utf8')))
    assert.ok(ref[session.id], `reference for ${session.id}`)
    compareRows(session.id, session, ref[session.id].coarse, 'coarse')
    compareRows(session.id, session, ref[session.id].fine, 'fine')
  }
})

test('patterns and spatial basics', () => {
  const sine = { ...patternDefaults('sine'), pointMs: 0 }
  assert.ok(Math.abs(patternValue(sine, 1000 / 28) - 1) < 1e-9)
  const burst = patternDefaults('burst')
  assert.equal(patternValue(burst, burst.sweepMs + 100), 0)
  assert.equal(patternValue(burst, 123), patternValue(burst, 123 + burst.sweepMs + burst.gapMs))
  const rot = { mode: 'rotate', ccw: true, dwellStartMs: 20, dwellStepMs: 0, dwellEndMs: 20, crossfade: false, side: 'right', alternateMs: 2000, channel: 0, weights: [1, 1, 1, 1, 1, 1, 1, 1] }
  const order = [0, 1, 2, 3, 7, 6, 5, 4]
  order.forEach((ch, k) => assert.equal(spatialGains(rot, 'temporal', k * 20 + 1).indexOf(1), ch))
  const ramp = { ...rot, dwellStartMs: 10, dwellStepMs: 2, dwellEndMs: 20 }
  assert.equal(dwellPosition(ramp, 89.9).step, 5)
  assert.equal(dwellPosition(ramp, 90.1).step, 6)
})

test('parseSession rejects what the firmware rejects', () => {
  assert.throws(() => parseSession({ id: 'x', phases: [{ minutes: 90, pattern: { type: 'sine' } }] }), /60 min/)
  assert.throws(() => parseSession({ id: 'x', phases: [{ minutes: 1, pattern: { type: 'warp' } }] }), /warp/)
  assert.throws(() => parseSession({ id: 'x', phases: [{ minutes: 1, pattern: { type: 'table' } }] }), /tableData/)
})

test('custom placements (mirrors the C++ tests)', () => {
  assert.equal(sideFromSite('T7'), -1)
  assert.equal(sideFromSite('CP6'), 1)
  assert.equal(sideFromSite('Cz'), 0)
  assert.equal(sideFromSite('Fpz'), 0)
  assert.equal(sideFromSite('FTT8h'), 1)
  assert.equal(sideFromSite('T10'), 1)
  for (const bad of ['X', '', 'Tq', '99', 'T7x', '7T']) assert.equal(sideFromSite(bad), null, bad)
  const s = parseSession({ id: 'c', layout: 'custom', placement: { sites: ['T8', 'TP8', 'CP6', 'P8', 'C6', '', 'FT8', ''], order: [6, 0, 4, 2, 1, 3] },
    phases: [{ seconds: 10, pattern: { type: 'dc' }, spatial: { mode: 'rotate', dwellMs: 10 } }] })
  assert.deepEqual(s.geometry.order, [6, 0, 4, 2, 1, 3])
  ;[6, 0, 4, 2, 1, 3, 6].forEach((ch, k) => assert.equal(spatialGains(s.phases[0].spatial, s.geometry, k * 10 + 1).indexOf(1), ch))
  const right = spatialGains({ ...s.phases[0].spatial, mode: 'right' }, s.geometry, 0)
  assert.equal(right[0], 1)
  assert.equal(right[5], 0)
  assert.ok(spatialGains({ ...s.phases[0].spatial, mode: 'cycle', side: 'left' }, s.geometry, 0).every((x) => x === 0))
  const two = parseSession({ id: 'c', layout: 'custom', placement: { sites: ['F3', 'F4', '', '', '', '', '', ''] },
    phases: [{ seconds: 10, pattern: { type: 'dc' }, spatial: { mode: 'alternate', alternateMs: 100 } }] })
  assert.deepEqual(two.geometry.order, [0, 1])
  assert.deepEqual(spatialGains(two.phases[0].spatial, two.geometry, 150).slice(0, 2), [0, 1])
  assert.throws(() => parseSession({ id: 'c', layout: 'custom', phases: [{ seconds: 1, pattern: { type: 'dc' } }] }), /placement/)
  assert.throws(() => parseSession({ id: 'c', layout: 'custom', placement: { sites: ['Q9x', '', '', '', '', '', '', ''] }, phases: [{ seconds: 1, pattern: { type: 'dc' } }] }), /Q9x/)
  assert.throws(() => parseSession({ id: 'c', layout: 'custom', placement: { sites: ['T8', '', '', '', '', '', '', ''], order: [1] }, phases: [{ seconds: 1, pattern: { type: 'dc' } }] }))
  assert.throws(() => parseSession({ id: 'r', layout: 'ring', placement: { sites: ['T8', '', '', '', '', '', '', ''] }, phases: [{ seconds: 1, pattern: { type: 'dc' } }] }), /custom/)
  assert.deepEqual(parseSession({ id: 'r', layout: 'ring', phases: [{ seconds: 1, pattern: { type: 'dc' } }] }).sites[6], 'T8')
})

test('BLE framing round trip', () => {
  const msg = new TextEncoder().encode('x'.repeat(1000))
  const packets = split(msg, 7, 182)
  assert.equal(packets.length, 6)
  assert.equal(packets[0][1], FIRST)
  assert.equal(packets[5][1], LAST)
  const r = new Reassembler()
  let out = null
  for (const p of packets) out = r.push(p) ?? out
  assert.deepEqual(out, msg)
  const one = split(new TextEncoder().encode('{}'), 1, 182)
  assert.equal(one.length, 1)
  assert.equal(one[0][1], FIRST | LAST)
  assert.equal(r.push(packets[2]), null) // continuation without FIRST
})

test('negative weights reverse a coil and are limited to -1..1', () => {
  const doc = (w) => ({ id: 'w', name: 'w', fadeInS: 0, fadeOutS: 0, phases: [{ name: 'p', minutes: 1, pattern: { type: 'dc' }, spatial: { mode: 'bilateral', weights: w } }] })
  const s = parseSession(doc([1, -1, 0.5, -0.5, 0, 0, 0, 0]))
  const runner = new SessionRunner()
  const f = runner.start(s)
  const v = render(s, runner.advance(100))
  assert.deepEqual(v.slice(0, 4), [1, -1, 0.5, -0.5])
  assert.equal(f.running, true)
  assert.throws(() => parseSession(doc([1, -1.5, 0, 0, 0, 0, 0, 0])), /-1\.\.1/)
})
