// Every program file passes the checker (core/lib/presetCheck.js), the app's
// library is exactly the active files, and nothing points at an archived one.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkPreset, duplicateIds, dacSwing } from '../core/lib/presetCheck.js'
import { FIDELITY, DOSE_UNITS, DOSE_PLANES, doseText } from '../core/lib/presetSchema.js'
import { EVIDENCE } from '../core/lib/evidence.js'
import { CATEGORY_LABELS } from '../core/lib/categories.js'
import { PATTERN_TYPES } from '../core/engine/patterns.js'
import { SPATIAL_MODES } from '../core/engine/spatial.js'
import { STATE_MAP } from '../core/lib/layouts.js'
import { DEFAULT_PROGRAM } from '../core/lib/lastProgram.js'
import { presets } from '../core/lib/presets.js'
import { presetFiles, repo, siteKeys, regionIds } from '../scripts/preset-files.mjs'
import type { Category, DosePlane, DoseUnit, Evidence, Fidelity, PatternType, SpatialMode } from '../shared/program'

const files = presetFiles() as { file: string, id: string, archived: boolean }[]
const active = files.filter((f) => !f.archived).map((f) => f.id)
const check = (text: string, id = 'x', archived = false) => checkPreset(text, { fileId: id, siteKeys, regionIds, archived })
const minimal = (extra: object = {}) => JSON.stringify({
  id: 'x', name: 'X', category: 'research', evidence: 'unverified', fidelity: 'construct', origin: 'This project', summary: 's', source: 'Author 2000 https://example.org',
  phases: [{ name: 'a', minutes: 1, pattern: { type: 'sine', f0: 7 } }], ...extra,
})

describe('program files', () => {
  it('every file is valid', () => {
    const duplicates = duplicateIds(files)
    const failed: string[] = []
    for (const f of files) {
      const { errors } = check(readFileSync(f.file, 'utf8'), f.id, f.archived)
      if (duplicates.has(f.file)) errors.push(duplicates.get(f.file)!)
      if (errors.length) failed.push(`${f.id}: ${errors.join('; ')}`)
    }
    expect(failed).toEqual([])
  })

  it('the app library is the active files, without the archive', () => {
    expect(presets.map((p: { doc: { id: string } }) => p.doc.id).sort()).toEqual([...active].sort())
  })

  it('nothing refers to a program that is not in the library', () => {
    const refs = new Map<string, string>([[DEFAULT_PROGRAM, 'the default program']])
    for (const s of STATE_MAP as { preset: string }[]) refs.set(s.preset, 'core/lib/layouts.js STATE_MAP')
    const guides = join(repo, 'guides')
    for (const f of readdirSync(guides).filter((n) => n.endsWith('.json'))) {
      const id = JSON.parse(readFileSync(join(guides, f), 'utf8')).helmetArm?.preset
      if (id) refs.set(id, `guides/${f}`)
    }
    const docs = join(repo, 'docs')
    for (const f of [...readdirSync(docs).filter((n) => n.endsWith('.md')).map((n) => join(docs, n)), join(repo, 'README.md')]) {
      for (const m of readFileSync(f, 'utf8').matchAll(/#programs\/([a-z0-9-]+)/g)) refs.set(m[1]!, f.slice(repo.length + 1))
    }
    const missing = [...refs].filter(([id]) => !active.includes(id)).map(([id, where]) => `${id} (${where})`)
    expect(missing).toEqual([])
  })
})

describe('the checker', () => {
  it('accepts a minimal program', () => {
    expect(check(minimal())).toMatchObject({ errors: [], warnings: [] })
  })

  it('reports what the app or the firmware would refuse', () => {
    expect(check('{').errors[0]).toMatch(/invalid JSON/)
    expect(check('[]').errors).toEqual(['a program file must be a JSON object'])
    expect(check(minimal(), 'y').errors).toContain('id "x" must match the file name')
    expect(check(minimal({ phases: 'none' })).errors).toContain('"phases" must be a list')
    expect(check(minimal({ uT: 6 })).errors).toContain('"uT" must be a number in (0, 5]')
    expect(check(minimal({ uT: '1' })).errors).toContain('"uT" must be a number in (0, 5]')
    expect(check(minimal({ category: 'other' })).errors[0]).toMatch(/unknown category/)
    expect(check(minimal({ layout: 'custom', placement: { sites: ['T3', '', '', '', '', '', '', ''] } })).errors[0]).toMatch(/not a 10-05 site name/)
    expect(check(minimal({ notes: 'see /Users/me/file.pdf' })).errors).toContain('contains a local file path or local source reference')
  })

  it('checks fidelity and what it means for the evidence level', () => {
    expect(check(minimal({ fidelity: 'close' })).errors[0]).toMatch(/unknown fidelity/)
    expect(check(minimal({ fidelity: undefined })).errors).toContain('no "fidelity"')
    expect(check(minimal({ fidelity: 'timing', evidence: 'established' })).errors[0]).toMatch(/needs evidence "unverified"/)
    expect(check(minimal({ fidelity: 'exact', evidence: 'single-lab' })).errors).toEqual([])
    // A control (sham) needs neither.
    expect(check(minimal({ category: 'control', fidelity: undefined, evidence: undefined, phases: [{ name: 'a', minutes: 1, pattern: { type: 'off' } }] }))).toMatchObject({ errors: [], warnings: [] })
  })

  it('rejects a key the format does not have', () => {
    expect(check(minimal({ 'layout / placement': { layout: 'custom' } })).errors).toContain('unknown key "layout / placement"')
    expect(check(minimal({ layout: 'custom', placement: { sites: ['T7', '', '', '', 'T8', '', '', ''], rotation: [0] } })).errors).toContain('placement: unknown key "rotation"')
  })

  it('checks the dose record', () => {
    const dose = { value: [1, 5], unit: 'uT', plane: 'scalp', cite: 'Author 2000 p.2' }
    expect(check(minimal({ dose }))).toMatchObject({ errors: [], warnings: [] })
    expect(check(minimal({ dose: { ...dose, value: 0 } })).errors[0]).toMatch(/dose.value/)
    expect(check(minimal({ dose: { ...dose, value: [5, 1] } })).errors[0]).toMatch(/dose.value/)
    expect(check(minimal({ dose: { ...dose, unit: 'G' } })).errors[0]).toMatch(/dose.unit/)
    expect(check(minimal({ dose: { ...dose, plane: 'cortex' } })).errors[0]).toMatch(/dose.plane/)
    expect(check(minimal({ dose: { ...dose, cite: '' } })).errors[0]).toMatch(/dose.cite/)
    expect(check(minimal({ dose: { ...dose, where: 'x' } })).errors[0]).toMatch(/unknown key/)
    expect(check(minimal({ dose: { ...dose, cite: 'Other 1999 p.1' } })).warnings[0]).toMatch(/"source" does not list/)
    expect(doseText(dose)).toBe('1–5 µT at the scalp (Author 2000 p.2)')
  })

  it('warns when the field is too weak for the 12-bit DAC to keep a table’s levels', () => {
    // 1 µT at 20 mm: 1 / 1.8 µT per mA / 4.537 mA × 2047 steps.
    expect(Math.round(dacSwing(1))).toBe(251)
    expect(check(minimal({ uT: 0.1 })).warnings[0]).toMatch(/only 25 DAC steps/)
    expect(check(minimal({ uT: 0.3 })).warnings).toEqual([])
  })

  it('checks an archived file for syntax only', () => {
    expect(check(minimal({ fidelity: undefined, category: undefined }), 'x', true)).toMatchObject({ errors: [], warnings: [] })
    expect(check(minimal({ phases: [] }), 'x', true).errors[0]).toMatch(/engine/)
  })

  it('finds an id used twice', () => {
    expect([...duplicateIds([{ id: 'a', file: '1' }, { id: 'b', file: '2' }, { id: 'a', file: '3' }])]).toEqual([['3', 'duplicate id (also 1)']])
  })
})

describe('the types of shared/program.ts list what the core lists', () => {
  // A missing or extra name fails to compile here, or fails the comparison.
  const same = <T extends string>(names: Record<T, true>, keys: readonly string[]) => expect(Object.keys(names).sort()).toEqual([...keys].sort())
  it('categories, evidence, fidelity, dose', () => {
    same<Category>({ spiritual: true, presence: true, obe: true, psi: true, meditation: true, mood: true, dreams: true, body: true, signals: true, courses: true, lowfield: true, persinger: true, replication: true, research: true, control: true }, Object.keys(CATEGORY_LABELS))
    same<Evidence>({ 'established': true, 'single-lab': true, 'claim': true, 'anecdote': true, 'unverified': true }, Object.keys(EVIDENCE))
    same<Fidelity>({ exact: true, approximation: true, timing: true, construct: true }, Object.keys(FIDELITY))
    same<DoseUnit>({ nT: true, mG: true, uT: true, mT: true }, Object.keys(DOSE_UNITS))
    same<DosePlane>({ scalp: true, coil: true, intracranial: true, centre: true, unstated: true }, Object.keys(DOSE_PLANES))
  })
  it('signals and coil movements', () => {
    same<PatternType>({ off: true, dc: true, sine: true, chirp: true, burst: true, thomas: true, pulse: true, semirandom: true, table: true, pm: true, noise: true }, PATTERN_TYPES)
    same<SpatialMode>({ bilateral: true, left: true, right: true, rotate: true, cycle: true, alternate: true, single: true }, SPATIAL_MODES)
  })
})
