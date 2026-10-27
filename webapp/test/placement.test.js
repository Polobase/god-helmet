// Tape-measure recipes (lib/tape.js) and placement groups (lib/placements.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseSite, makeTape, cleanHead, describeSite, HEAD_DEFAULTS } from '../src/lib/tape.js'
import { placementGroups, placementKey, describeSites, siteLobe } from '../src/lib/placements.js'
import { parseSession } from '../src/engine/session.js'
import { LAYOUTS } from '../src/lib/layouts.js'

const here = dirname(fileURLToPath(import.meta.url))
const { sites } = JSON.parse(readFileSync(join(here, '../src/assets/brain/sites.json'), 'utf8'))
const tape = makeTape(sites)
const HEAD = { nasionInion: 36, earEar: 35, circumference: 56 }
const close = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`)

test('parseSite places 10-10 and 10-5 names on the grid', () => {
  assert.deepEqual([parseSite('Fpz').kind, parseSite('Fpz').k], ['ring', 0])
  assert.deepEqual([parseSite('Oz').kind, parseSite('Oz').k], ['ring', 10])
  assert.deepEqual([parseSite('Fp1').kind, parseSite('Fp1').k, parseSite('Fp1').side], ['ring', 1, 'left'])
  assert.deepEqual([parseSite('O2').kind, parseSite('O2').k, parseSite('O2').side], ['ring', 9, 'right'])
  for (const [n, k] of [['AF7', 2], ['F7', 3], ['FFT7', 3.5], ['FT7', 4], ['FTT7', 4.5], ['T7', 5], ['TTP7', 5.5], ['TP7', 6], ['TPP7', 6.5], ['P7', 7], ['PO7', 8], ['POO8', 8.5]]) {
    assert.equal(parseSite(n).kind, 'ring', n)
    assert.equal(parseSite(n).k, k, n)
  }
  // Rows: quarters between the midline (f = 0) and the band (f = 1); "h" halfway.
  for (const [n, f] of [['F1', 0.25], ['F3', 0.5], ['F5', 0.75], ['C5', 0.75], ['C5h', 0.625], ['FC5h', 0.625], ['FTT7h', 0.875], ['C1h', 0.125], ['C2h', 0.125], ['CP6', 0.75], ['AF3', 0.5], ['PO4', 0.5]]) {
    assert.equal(parseSite(n).kind, 'row', n)
    assert.equal(parseSite(n).f, f, n)
  }
  assert.equal(parseSite('FC5h').ring, 'FT7')
  assert.equal(parseSite('FC5h').mid, 'FCz')
  assert.equal(parseSite('CPP6h').ring, 'TPP8')
  // Below the band: 0 % line and halfway to it.
  assert.deepEqual([parseSite('T9').kind, parseSite('T9').drop], ['low', 1])
  assert.deepEqual([parseSite('T10h').kind, parseSite('T10h').drop], ['low', 0.5])
  assert.deepEqual([parseSite('TTP9h').kind, parseSite('TTP9h').drop], ['low', 0.5])
  assert.equal(parseSite('Iz').kind, 'back')
  assert.equal(parseSite('Cz').kind, 'mid')
  assert.equal(parseSite('LPA'), null)
  assert.equal(parseSite('Nz'), null)
})

test('every 10-5 site name in the app has a recipe', () => {
  const grid = Object.keys(sites).filter((n) => !['LPA', 'RPA', 'NAS', 'INI', 'Nz'].includes(n))
  for (const n of grid) {
    const r = tape.recipe(n, HEAD)
    assert.ok(r, n)
    assert.ok(r.text.length > 20, n)
    assert.ok(['on', 'above', 'below'].includes(r.band), n)
    assert.ok(r.bandCm >= 0 && r.bandCm < 20, `${n} ${r.bandCm}`)
    assert.ok(describeSite(n).length > 5, n)
  }
})

test('recipes follow the 10-10 rules for the measured head', () => {
  // T7: 10 % of ear-to-ear above the ear point, a quarter of the band from Fpz.
  const t7 = tape.recipe('T7', HEAD)
  assert.match(t7.text, /3\.5 cm above the ear point/)
  assert.match(t7.text, /14\.0 cm/)
  // FT7: one band step (5 % of 56 cm) in front of T7.
  assert.match(tape.recipe('FT7', HEAD).text, /2\.8 cm in front of T7/)
  assert.match(tape.recipe('TP8', HEAD).text, /2\.8 cm behind T8/)
  assert.match(tape.recipe('Fp1', HEAD).text, /2\.8 cm from Fpz/)
  assert.match(tape.recipe('O2', HEAD).text, /2\.8 cm from Oz/)
  // C5: 20 % of ear-to-ear from the ear point = 10 % above T7.
  const c5 = tape.recipe('C5', HEAD)
  assert.match(c5.text, /7\.0 cm up from the left ear point/)
  close(c5.bandCm, 3.5)
  assert.equal(c5.estimate, false)
  // T9 is the ear point, 10 % of ear-to-ear below T7.
  const t9 = tape.recipe('T9', HEAD)
  assert.equal(t9.band, 'below')
  close(t9.bandCm, 3.5)
  // Midline from the nasion / inion.
  assert.match(tape.recipe('Fz', HEAD).text, /10\.8 cm from the nasion/)
  assert.match(tape.recipe('Pz', HEAD).text, /10\.8 cm from the inion/)
  close(tape.recipe('Cz', HEAD).bandCm, 14.4)
  // Rows between band and midline are estimates scaled from the template.
  const f3 = tape.recipe('F3', HEAD)
  assert.equal(f3.estimate, true)
  assert.match(f3.text, /halfway from F7/)
  assert.ok(f3.bandCm > 3.5 && f3.bandCm < 7, `F3 ${f3.bandCm}`)
  // Near the midline the recipe starts from the midline site.
  assert.match(tape.recipe('CP1', HEAD).text, /from CPz \(midline\)/)
})

test('distances scale with the head and fall back to typical values', () => {
  assert.equal(cleanHead({}).typical, true)
  assert.deepEqual({ ...cleanHead({}), typical: undefined, defaulted: undefined }, { ...HEAD_DEFAULTS, typical: undefined, defaulted: undefined })
  const part = cleanHead({ nasionInion: 38, circumference: 60 })
  assert.deepEqual(part.defaulted, ['earEar'])
  assert.equal(part.nasionInion, 38)
  assert.equal(part.circumference, 60)
  assert.equal(cleanHead({ nasionInion: 120, earEar: 35, circumference: 56 }).nasionInion, HEAD_DEFAULTS.nasionInion)
  assert.equal(cleanHead(HEAD).typical, false)
  const small = tape.recipe('C5', { ...HEAD, earEar: 30 })
  const big = tape.recipe('C5', { ...HEAD, earEar: 40 })
  close(big.bandCm / small.bandCm, 40 / 30, 0.01)
  // Template arcs are plausible (cm).
  const t = tape.template
  assert.ok(t.circumference > 50 && t.circumference < 70)
  assert.ok(t.nasionInion > 30 && t.nasionInion < 45)
  close(t.rows.C / t.earEar, 0.4, 0.01) // Cz→T7 is 40 % of ear-to-ear on the template too
})

function loadPresets() {
  const dir = join(here, '../../presets')
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    const doc = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    return { doc, session: parseSession(doc) }
  })
}
const sitesOf = (s) => (s.layout === 'custom' ? s.sites.map((x) => x || null) : LAYOUTS[s.layout].channels.map((c) => c.site))

test('placement groups cover every program once and name the known families', () => {
  const presets = loadPresets()
  const groups = placementGroups(presets, sitesOf)
  assert.equal(groups.reduce((n, g) => n + g.programs.length, 0), presets.length)
  assert.equal(new Set(groups.map((g) => g.key)).size, groups.length)
  for (let i = 1; i < groups.length; i++) assert.ok(groups[i - 1].programs.length >= groups[i].programs.length)
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g]))
  assert.equal(byKey[placementKey(LAYOUTS.ring.channels.map((c) => c.site))].layout, 'A')
  assert.equal(byKey[placementKey(LAYOUTS.temporal.channels.map((c) => c.site))].layout, 'B')
  const classic = groups.find((g) => g.programs.some((p) => p.doc.id === 'god-helmet-classic'))
  assert.equal(classic.name, 'God Helmet / 8 Coil Shakti cross')
  // Every group has a name, coil count and at least one lobe; site names resolve.
  for (const g of groups) {
    assert.ok(g.name && g.basis, g.key)
    assert.equal(g.coils, g.sites.filter(Boolean).length)
    assert.ok(g.lobes.length >= 1, g.key)
    for (const s of g.sites.filter(Boolean)) assert.ok(sites[s], `${s} in ${g.key}`)
  }
})

test('unnamed site sets get readable names', () => {
  assert.equal(describeSites(['FT7', 'TP7', null, null, 'FT8', 'TP8', null, null]), 'Temporal: FT7, TP7 + mirror')
  assert.equal(describeSites(['F7', 'F3', null, null, null, null, null, null]), 'Left frontal: F7, F3')
  assert.equal(describeSites([null, null, null, null, 'Oz', null, null, null]), 'Midline occipital: Oz')
  assert.equal(siteLobe('T9'), 'temporal')
  assert.equal(siteLobe('Iz'), 'inion')
  assert.equal(siteLobe('CP1'), 'parietal')
  assert.equal(siteLobe('Fp1'), 'frontal')
})

test('plain-language positions match the site', () => {
  // Sites beside the midline are on top of the head, not above the ear.
  for (const n of ['C1', 'CP1', 'P1', 'C3', 'P3']) assert.doesNotMatch(describeSite(n), /ear/, n)
  for (const n of ['C5', 'CP5', 'FC5h']) assert.match(describeSite(n), /ear/, n)
  // Halfway down to the ear point is not in front of the ear canal.
  assert.doesNotMatch(describeSite('T9h'), /ear canal/)
  assert.match(describeSite('T9'), /ear point/)
  // Low frontal sites are by the eye.
  assert.match(describeSite('AF9'), /eye/)
  assert.match(tape.recipe('AF9', HEAD).detail, /eye/)
})
