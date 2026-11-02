// SD-card program pack for the standalone display board (src/lib/sdpack.js):
// what the firmware's reader (firmware/src/ui/pack.cpp) relies on.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildPack, ascii, MAX_PROGRAM_BYTES, PACK_VERSION } from '../src/lib/sdpack.js'
import { parseSession } from '../src/engine/session.js'

const here = dirname(fileURLToPath(import.meta.url))
const presetsDir = join(here, '..', '..', 'presets')
const docs = readdirSync(presetsDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(presetsDir, f), 'utf8')))
const sites = JSON.parse(readFileSync(join(here, '..', 'src', 'assets', 'brain', 'sites.json'), 'utf8')).sites
const { files, report } = buildPack(docs, sites, { date: '2026-01-01' })

test('pack index: header, one line per program, nine columns', () => {
  const lines = files.get('index.tsv').trimEnd().split('\n')
  assert.deepEqual(lines[0].split('\t'), ['#godhelmet-pack', String(PACK_VERSION), String(docs.length), '2026-01-01'])
  assert.equal(lines.length, docs.length + 1)
  const categories = new Map(files.get('categories.tsv').trimEnd().split('\n').map((l) => l.split('\t')).map(([k, , n]) => [k, Number(n)]))
  const seen = new Map()
  for (const [i, line] of lines.slice(1).entries()) {
    const f = line.split('\t')
    assert.equal(f.length, 9, line)
    assert.equal(f[0], String(i).padStart(3, '0'))
    assert.ok(files.has(`p/${f[0]}.json`) && files.has(`t/${f[0]}.txt`), f[1])
    assert.ok(Number(f[4]) > 0, `${f[1]}: duration`)
    assert.ok(f[6].split(',').length <= 8, `${f[1]}: at most 8 channels`)
    seen.set(f[2], (seen.get(f[2]) ?? 0) + 1)
  }
  assert.deepEqual(seen, categories)
  assert.equal(report.programs, docs.length)
})

test('pack files are ASCII and program files fit the firmware limit', () => {
  for (const [path, text] of files) {
    assert.ok(/^[\x09\x0a\x20-\x7e]*$/.test(text), `${path}: 7-bit text only (the device fonts)`)
    if (path.startsWith('p/')) assert.ok(text.length <= MAX_PROGRAM_BYTES, `${path}: ${text.length} bytes`)
  }
  assert.equal(ascii('µT – 10 % → Fpz · Oz'), 'uT - 10 % -> Fpz - Oz')
})

test('program files parse to the same session as the presets', () => {
  const byId = new Map(docs.map((d) => [d.id, d]))
  for (const line of files.get('index.tsv').trimEnd().split('\n').slice(1)) {
    const [num, id] = line.split('\t')
    const compact = JSON.parse(files.get(`p/${num}.json`))
    const expected = parseSession(byId.get(id))
    expected.name = ascii(expected.name)  // names are folded for the device fonts
    for (const ph of expected.phases) ph.name = ascii(ph.name)
    assert.deepEqual(parseSession(compact), expected, id)
  }
})

test('coil map and tape template', () => {
  const rows = files.get('sites.tsv').trimEnd().split('\n').map((l) => l.split('\t'))
  const names = new Set(rows.map((r) => r[0]))
  for (const r of rows) {
    assert.equal(r.length, 4)
    assert.ok(Math.hypot(Number(r[1]), Number(r[2])) < 1.4, `${r[0]} inside the drawn head`)
  }
  assert.ok(['Fpz', 'T7', 'Cz', 'T8', 'Oz'].every((n) => names.has(n)))
  for (const line of files.get('index.tsv').trimEnd().split('\n').slice(1)) {
    for (const site of line.split('\t')[6].split(',').filter(Boolean)) assert.ok(names.has(site), `${site} on the map`)
  }
  const [fpz, t7] = ['Fpz', 'T7'].map((n) => rows.find((r) => r[0] === n))
  assert.ok(Number(fpz[2]) < -0.9 && Number(t7[1]) < -0.9, 'nose up, your left on the left')
  const tape = JSON.parse(files.get('tape.json'))
  assert.ok(tape.circumference > 40 && tape.nasionInion > 25 && tape.earEar > 25 && tape.rows.C > 0)
})
