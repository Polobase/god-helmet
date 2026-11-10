// The illustrations: nothing the app groups by may go without a drawing, and
// every drawing that is named exists as a file (and the other way round).
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GUIDE_MARKS, GUIDE_SCENES, MARKS, PAGE_SCENES, PROGRAM_MARKS, PROGRAM_SCENES, SCENES, SCENE_LABELS, TRIAL_MARKS, guideMark, guideScene, pageScene, programMark, programScene, ringPoint } from '../app/lib/art'
import { DOCS, pathFor } from '../shared/content-meta'

const repo = new URL('../../', import.meta.url)
const docs = (dir: string) => readdirSync(new URL(dir, repo)).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(dir + f, repo), 'utf8')) as { id: string, category?: string })
const programs = docs('presets/')
const guides = docs('guides/')
const drawn = (dir: string) => readdirSync(new URL(`../app/components/art/${dir}/`, import.meta.url)).filter((f) => f.endsWith('.vue')).map((f) => f.replace(/\.vue$/, '')).sort()

describe('illustrations', () => {
  it('has a drawing file for every scene and every mark, and no drawing without a name', () => {
    expect(drawn('scenes')).toEqual([...SCENES].sort())
    expect(drawn('marks')).toEqual([...MARKS].sort())
    expect(Object.keys(SCENE_LABELS).sort()).toEqual([...SCENES].sort())
  })

  it('has a mark for every program category in presets/*.json', () => {
    const categories = [...new Set(programs.map((p) => p.category))]
    expect(categories.length).toBeGreaterThan(10)
    for (const c of categories) expect(programMark(c), `program category "${c}"`).not.toBeNull()
    for (const m of Object.values(PROGRAM_MARKS)) expect(MARKS).toContain(m)
  })

  it('has a mark for every guide category in guides/*.json', () => {
    const categories = [...new Set(guides.map((g) => g.category))]
    expect(categories.length).toBeGreaterThan(4)
    for (const c of categories) expect(guideMark(c), `guide category "${c}"`).not.toBeNull()
    for (const m of [...Object.values(GUIDE_MARKS), ...Object.values(TRIAL_MARKS)]) expect(MARKS).toContain(m)
  })

  it('names only pages, guides and programs that exist', () => {
    const pages = new Set(DOCS.map(pathFor))
    for (const [path, scene] of Object.entries(PAGE_SCENES)) {
      expect(pages, path).toContain(path)
      expect(SCENES).toContain(scene)
    }
    // Every article opens with a scene.
    for (const d of DOCS.filter((d) => d.section === 'articles')) expect(pageScene(pathFor(d)), d.slug).not.toBeNull()
    const guideIds = new Set(guides.map((g) => g.id))
    for (const [id, scene] of Object.entries(GUIDE_SCENES)) {
      expect(guideIds, id).toContain(id)
      expect(SCENES).toContain(scene)
    }
    expect(guideScene('rng-pk', 'self-test')).toBe('micro-pk')
    expect(guideScene('gateway-prep', 'gateway')).toBe('meditation')
    expect(guideScene('enrollment-battery', 'questionnaire')).toBeNull()
    // A program's own mark wins over its category's.
    const ids = new Set(programs.map((p) => p.id))
    for (const id of ['remote-viewing', 'telepathy-sender', 'frontal', 'love-agape']) expect(ids, id).toContain(id)
    for (const [id, scene] of Object.entries(PROGRAM_SCENES)) {
      expect(ids, id).toContain(id)
      expect(SCENES).toContain(scene)
    }
    expect(programScene('psi', 'telepathy-sender', true)).toBe('telepathy')
    expect(programScene('presence', 'presence-right')).toBe('presence')
    expect(programScene('research', 'circumcerebral-gamma', true)).toBe('ring')
    expect(programScene('mood', 'some-mood-program')).toBeNull()
    expect(programMark('psi', 'telepathy-sender')).toBe('telepathy')
    expect(programMark('psi', 'some-other-program')).toBe('psi')
    expect(programMark(undefined)).toBeNull()
  })

  it('puts coil 1 over the left front and counts counter-clockwise', () => {
    // Seen from above, nose up: x grows to the right, y grows towards the back of the head.
    const [x0, y0] = ringPoint(0, 10)
    expect(x0).toBeLessThan(0)
    expect(y0).toBeLessThan(0)
    expect(ringPoint(2, 10)[1]).toBeGreaterThan(0) // third coil: left, behind the ear
    const [x7, y7] = ringPoint(7, 10)
    expect(x7).toBeCloseTo(-x0)
    expect(y7).toBeCloseTo(y0)
  })
})
