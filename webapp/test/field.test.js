// Coil field model, exposure maps and brain-mesh assets.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { onAxisUtPerMa, coilFieldLocal, coilPose, coilFieldAt, coilFields, phaseExposure, gainStates, loopField, AIR_COIL } from '../src/engine/field.js'
import { decodeMesh } from '../src/lib/meshcodec.js'
import { parseSession } from '../src/engine/session.js'
import { geometryFor } from '../src/engine/spatial.js'

const here = dirname(fileURLToPath(import.meta.url))
const asset = (f) => JSON.parse(readFileSync(join(here, '..', 'src', 'assets', 'brain', f), 'utf8'))

test('air-core field matches tools/coil_field.py (80 x 80 integration) within 2 %', () => {
  const python = { 0: 22.904, 5: 7.711, 10: 2.94, 20: 0.734, 30: 0.281, 50: 0.075 }
  for (const [mm, uT] of Object.entries(python)) {
    const js = onAxisUtPerMa(Number(mm), AIR_COIL)
    assert.ok(Math.abs(js - uT) / uT < 0.02, `${mm} mm: ${js} vs ${uT}`)
  }
})

test('cored coil matches the research model (uniformly magnetised core) within 10 %', () => {
  // coil-model track: per mA on axis 104 µT at the face, 25 at 5 mm, 8.1 at 10 mm, 1.76 at 20 mm, 0.229 at 45 mm
  const model = { 0: 104, 5: 25, 10: 8.1, 20: 1.76, 45: 0.229 }
  for (const [mm, uT] of Object.entries(model)) {
    const js = onAxisUtPerMa(Number(mm))
    assert.ok(Math.abs(js - uT) / uT < 0.1, `${mm} mm: ${js} vs ${uT}`)
  }
  // mid-plane, 20 mm from the coil's side: about -0.60 µT/mA (opposite sign, like a dipole)
  const side = coilFieldLocal(9.5 + 20, -5.5)[1] * 1e3
  assert.ok(side < 0 && Math.abs(side + 0.6) < 0.06, `side ${side}`)
})

test('loop field: centre value and symmetry', () => {
  // B at the centre of a 1 A loop of radius a is mu0/(2a)
  const a = 0.01
  const [, bz] = loopField(a, 0, 0)
  assert.ok(Math.abs(bz - (4e-7 * Math.PI) / (2 * a)) < 1e-12)
  const [br1] = loopField(a, 0.005, 0.004)
  const [br2] = loopField(a, 0.005, -0.004)
  assert.ok(Math.abs(br1 + br2) < 1e-15, 'radial field is odd in z')
})

test('dipole far field joins the loop model smoothly', () => {
  // just inside and outside the 40-mm switch radius (from the winding centre)
  const inner = coilFieldLocal(0, 33.9)[1]
  const outer = coilFieldLocal(0, 34.1)[1]
  assert.ok(Math.abs(inner - outer) / inner < 0.02, `${inner} vs ${outer}`)
})

test('calibration: 1 unit at 20 mm on the axis', () => {
  const pose = { face: [0, 0, 0], axis: [1, 0, 0] }
  const b = coilFieldAt(pose, [20, 0, 0])
  assert.ok(Math.abs(Math.hypot(...b) - 1) < 1e-9)
  assert.ok(b[0] > 0, 'field points along the axis')
})

test('coil pose: axis points inward from the site', () => {
  const pose = coilPose([-84, -16, -9])
  assert.ok(pose.axis[0] > 0.9, 'a left temporal coil points right')
  assert.ok(pose.face[0] < -84, 'face sits outside the scalp')
})

test('gain states and exposure follow the spatial mode', () => {
  const g = geometryFor('temporal')
  const rot = gainStates({ mode: 'rotate', ccw: true, dwellStartMs: 20, dwellStepMs: 0, dwellEndMs: 20, crossfade: false, weights: [1, 1, 1, 1, 1, 1, 1, 1] }, g)
  assert.equal(rot.length, 8)
  assert.ok(Math.abs(rot.reduce((a, s) => a + s.w, 0) - 1) < 1e-9)
  // CH1 (left) faces +x from x = -80, CH5 (right) faces -x from x = +80;
  // point 0 is 20 mm in front of CH1, point 1 is 20 mm in front of CH5.
  const pts = new Float32Array([-60, 0, 0, 60, 0, 0])
  const poseL = { face: [-80, 0, 0], axis: [1, 0, 0] }
  const poseR = { face: [80, 0, 0], axis: [-1, 0, 0] }
  const at = (pose) => new Float32Array([...coilFieldAt(pose, [-60, 0, 0]), ...coilFieldAt(pose, [60, 0, 0])])
  const fields = new Array(8).fill(null)
  fields[0] = at(poseL)
  fields[4] = at(poseR)
  const doc = { id: 't', name: 't', phases: [{ name: 'l', minutes: 1, pattern: { type: 'dc' }, spatial: { mode: 'left' } }] }
  const s = parseSession(doc)
  const e = phaseExposure(s.phases[0], s.geometry, fields, 2, 2)
  assert.ok(Math.abs(e.peak[0] - 2) < 1e-6, 'left coil gives 2 µT at its calibration point')
  assert.ok(e.peak[1] < 0.2, 'the far point gets little')
  assert.ok(Math.abs(e.rms[0] - 2) < 1e-6, 'DC: rms = peak')
  assert.equal(pts.length, 6)
})

test('brain assets decode to closed, MNI-sized meshes', () => {
  const { meshes } = asset('brain-mesh.json')
  for (const [key, e] of Object.entries(meshes)) {
    const m = decodeMesh(e)
    assert.equal(m.position.length, e.vertices * 3, key)
    assert.equal(m.index.length, e.triangles * 3, key)
    assert.ok(m.index.every((i) => i < e.vertices), `${key}: index range`)
    // every edge shared by exactly two triangles = closed surface
    const edges = new Map()
    for (let t = 0; t < m.index.length; t += 3) {
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const u = m.index[t + a], v = m.index[t + b]
        const k = u < v ? `${u},${v}` : `${v},${u}`
        edges.set(k, (edges.get(k) ?? 0) + 1)
      }
    }
    const open = [...edges.values()].filter((n) => n !== 2).length
    assert.ok(open / edges.size < 0.01, `${key}: ${open} of ${edges.size} edges not shared by two triangles`)
    let minX = Infinity, maxX = -Infinity
    for (let v = 0; v < m.position.length; v += 3) {
      minX = Math.min(minX, m.position[v])
      maxX = Math.max(maxX, m.position[v])
    }
    if (key === 'cortex-l') assert.ok(minX < -60 && maxX < 5, `${key}: x ${minX}..${maxX}`)
    if (key === 'cortex-r') assert.ok(maxX > 60 && minX > -5, `${key}: x ${minX}..${maxX}`)
  }
})

test('sites sit 10-25 mm outside the brain for lateral 10-10 positions', () => {
  const { sites } = asset('sites.json')
  const { meshes } = asset('brain-mesh.json')
  const pos = ['cortex-l', 'cortex-r'].map((k) => decodeMesh(meshes[k]).position)
  for (const name of ['T7', 'T8', 'C3', 'C4', 'FT7', 'CP6', 'F3']) {
    const p = sites[name]
    let best = Infinity
    for (const arr of pos) for (let v = 0; v < arr.length; v += 3) best = Math.min(best, Math.hypot(arr[v] - p[0], arr[v + 1] - p[1], arr[v + 2] - p[2]))
    assert.ok(best > 10 && best < 25, `${name}: ${best.toFixed(1)} mm`)
  }
})

test('coilFields gives one map per used channel', () => {
  const pts = new Float32Array([0, 0, 0, 10, 10, 10])
  const f = coilFields([[-84, -16, -9], null], pts)
  assert.equal(f.length, 2)
  assert.equal(f[1], null)
  assert.equal(f[0].length, 6)
})

test('regions: unique ids and MNI coordinates', () => {
  const { regions } = asset('regions.json')
  const ids = new Set(regions.map((r) => r.id))
  assert.equal(ids.size, regions.length)
  for (const r of regions) assert.ok(r.mni.length === 3 && r.mni.every(Number.isFinite), r.id)
})
