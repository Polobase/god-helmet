#!/usr/bin/env node
// Build the web app's brain-view assets (webapp/src/assets/brain/*.json).
//
// Inputs (download them yourself; the script never fetches anything):
//   --bna    BNA-maxprob-thr25-1mm.nii.gz  Brainnetome atlas, MNI152, CC0
//            https://neurovault.org/media/images/1625/BNA-maxprob-thr25-1mm.nii.gz
//   --sites  fsaverage_1005.tsv            10-05 positions, metres, BSD-3 (MNE-Python)
//            https://raw.githubusercontent.com/mne-tools/mne-python/main/mne/channels/data/montages/fsaverage_1005.tsv
//   --regions regions.json (optional)      curated targets: [{name, mni_mm, depth_from_scalp_mm, ...}]
//                                          used only to check and fit the site alignment
//   --cerebra CerebrA.nii (optional)       CerebrA atlas (Manera et al. 2020), CC0: adds the
//            cerebellum and brainstem, which Brainnetome lacks (MNI ICBM2009c sym, a few mm off)
//            https://gin.g-node.org/anamanera/CerebrA/raw/master/CerebrA.nii
//
//   node tools/brain_assets.mjs --bna bna.nii.gz --sites fsaverage_1005.tsv --out webapp/src/assets/brain
//
// Output:
//   brain-mesh.json  hemisphere and deep-structure surfaces (surface nets on a
//                    2-mm grid, Taubin-smoothed), delta-varint encoded, base64
//   sites.json       10-05 positions in mm, translated onto the MNI152 brain
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []))
if (!args.bna || !args.sites || !args.out) {
  console.error('usage: brain_assets.mjs --bna <nii.gz> --sites <tsv> --out <dir> [--regions <json>] [--grid 2]')
  process.exit(1)
}
const GRID = Number(args.grid ?? 2)

// ---------------------------------------------------------------- NIfTI-1
function readNifti(path) {
  let buf = readFileSync(path)
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf)
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (dv.getInt32(0, true) !== 348) throw new Error('not a little-endian NIfTI-1 file')
  const dim = [1, 2, 3].map((i) => dv.getInt16(40 + 2 * i, true))
  const datatype = dv.getInt16(70, true)
  const voxOffset = dv.getFloat32(108, true)
  const slope = dv.getFloat32(112, true) || 1
  const inter = dv.getFloat32(116, true) || 0
  if (dv.getInt16(254, true) <= 0) throw new Error('sform missing')
  const srow = [280, 296, 312].map((o) => [0, 1, 2, 3].map((k) => dv.getFloat32(o + 4 * k, true)))
  const n = dim[0] * dim[1] * dim[2]
  const read = {
    2: (i) => dv.getUint8(voxOffset + i),
    4: (i) => dv.getInt16(voxOffset + 2 * i, true),
    8: (i) => dv.getInt32(voxOffset + 4 * i, true),
    16: (i) => dv.getFloat32(voxOffset + 4 * i, true),
    512: (i) => dv.getUint16(voxOffset + 2 * i, true),
  }[datatype]
  if (!read) throw new Error(`unsupported NIfTI datatype ${datatype}`)
  const data = new Int16Array(n)
  for (let i = 0; i < n; i++) data[i] = Math.round(read(i) * slope + inter)
  return { dim, srow, data }
}

const world = (srow, i, j, k) => srow.map((r) => r[0] * i + r[1] * j + r[2] * k + r[3])
const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])

// ---------------------------------------------------------------- grids
// Fraction of each GRID^3 block inside `pick(label)`, padded by one empty cell.
function coarseField(vol, pick) {
  const [X, Y, Z] = vol.dim
  const g = GRID
  const nx = Math.ceil(X / g) + 2, ny = Math.ceil(Y / g) + 2, nz = Math.ceil(Z / g) + 2
  const f = new Float32Array(nx * ny * nz)
  const w = 1 / (g * g * g)
  for (let k = 0; k < Z; k++) for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++) {
    if (pick(vol.data[i + X * (j + Y * k)])) f[(1 + Math.floor(i / g)) + nx * ((1 + Math.floor(j / g)) + ny * (1 + Math.floor(k / g)))] += w
  }
  return { f, nx, ny, nz }
}

// Fill cavities (ventricles, white matter gaps) not connected to the outside.
function fillHoles(grid, iso) {
  const { f, nx, ny, nz } = grid
  const seen = new Uint8Array(f.length)
  const stack = [0]
  seen[0] = 1
  while (stack.length) {
    const c = stack.pop()
    const i = c % nx, j = Math.floor(c / nx) % ny, k = Math.floor(c / (nx * ny))
    for (const [di, dj, dk] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const a = i + di, b = j + dj, d = k + dk
      if (a < 0 || b < 0 || d < 0 || a >= nx || b >= ny || d >= nz) continue
      const n = a + nx * (b + ny * d)
      if (!seen[n] && f[n] <= iso) {
        seen[n] = 1
        stack.push(n)
      }
    }
  }
  for (let c = 0; c < f.length; c++) if (!seen[c] && f[c] <= iso) f[c] = 1
}

// Naive surface nets: one vertex per sign-changing cell, one quad per crossing edge.
function surfaceNets({ f, nx, ny, nz }, iso, flip) {
  const cell = new Int32Array(nx * ny * nz).fill(-1)
  const pos = []
  const at = (i, j, k) => f[i + nx * (j + ny * k)]
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v = corners.map(([a, b, c]) => at(i + a, j + b, k + c) - iso)
    const inside = v.filter((x) => x > 0).length
    if (inside === 0 || inside === 8) continue
    let sx = 0, sy = 0, sz = 0, n = 0
    for (const [a, b] of edges) {
      if (v[a] > 0 === v[b] > 0) continue
      const t = v[a] / (v[a] - v[b])
      sx += corners[a][0] + t * (corners[b][0] - corners[a][0])
      sy += corners[a][1] + t * (corners[b][1] - corners[a][1])
      sz += corners[a][2] + t * (corners[b][2] - corners[a][2])
      n++
    }
    cell[i + nx * (j + ny * k)] = pos.length / 3
    pos.push(i + sx / n, j + sy / n, k + sz / n)
  }
  const tris = []
  const id = (i, j, k) => cell[i + nx * (j + ny * k)]
  const quad = (a, b, c, d, out) => {
    if (out !== flip) tris.push(a, b, c, a, c, d)
    else tris.push(a, d, c, a, c, b)
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = at(i, j, k) > iso
    if (v0 !== at(i + 1, j, k) > iso) quad(id(i, j - 1, k - 1), id(i, j, k - 1), id(i, j, k), id(i, j - 1, k), v0)
    if (v0 !== at(i, j + 1, k) > iso) quad(id(i - 1, j, k - 1), id(i - 1, j, k), id(i, j, k), id(i, j, k - 1), v0)
    if (v0 !== at(i, j, k + 1) > iso) quad(id(i - 1, j - 1, k), id(i, j - 1, k), id(i, j, k), id(i - 1, j, k), v0)
  }
  return { pos: Float64Array.from(pos), tris: Uint32Array.from(tris) }
}

// Taubin smoothing (shrink-free Laplacian).
function taubin(mesh, iterations = 12, lambda = 0.5, mu = -0.53) {
  const n = mesh.pos.length / 3
  const nb = Array.from({ length: n }, () => new Set())
  for (let t = 0; t < mesh.tris.length; t += 3) {
    const [a, b, c] = [mesh.tris[t], mesh.tris[t + 1], mesh.tris[t + 2]]
    nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b)
  }
  const step = (w) => {
    const next = Float64Array.from(mesh.pos)
    for (let v = 0; v < n; v++) {
      if (!nb[v].size) continue
      let x = 0, y = 0, z = 0
      for (const u of nb[v]) { x += mesh.pos[3 * u]; y += mesh.pos[3 * u + 1]; z += mesh.pos[3 * u + 2] }
      const s = nb[v].size
      next[3 * v] += w * (x / s - mesh.pos[3 * v])
      next[3 * v + 1] += w * (y / s - mesh.pos[3 * v + 1])
      next[3 * v + 2] += w * (z / s - mesh.pos[3 * v + 2])
    }
    mesh.pos = next
  }
  for (let i = 0; i < iterations; i++) { step(lambda); step(mu) }
}

function buildMesh(vol, pick, { fill = true, smooth = 12 } = {}) {
  const grid = coarseField(vol, pick)
  if (fill) fillHoles(grid, 0.5)
  const flip = det3(vol.srow.map((r) => r.slice(0, 3))) < 0
  const mesh = surfaceNets(grid, 0.5, flip)
  taubin(mesh, smooth)
  // coarse cell index -> fine voxel index -> MNI mm
  const g = GRID
  for (let v = 0; v < mesh.pos.length; v += 3) {
    const [x, y, z] = world(vol.srow, (mesh.pos[v] - 1) * g + (g - 1) / 2, (mesh.pos[v + 1] - 1) * g + (g - 1) / 2, (mesh.pos[v + 2] - 1) * g + (g - 1) / 2)
    mesh.pos[v] = x; mesh.pos[v + 1] = y; mesh.pos[v + 2] = z
  }
  return mesh
}

// Zigzag varints of successive differences: surface-net output is spatially
// ordered, so most deltas fit one byte (decoder: webapp/src/lib/brain.js).
function deltaVarint(values) {
  const out = []
  let prev = 0
  for (const v of values) {
    let d = v - prev
    prev = v
    d = d < 0 ? -2 * d - 1 : 2 * d
    while (d >= 0x80) {
      out.push((d & 0x7f) | 0x80)
      d = Math.floor(d / 128)
    }
    out.push(d)
  }
  return Buffer.from(out).toString('base64')
}

function encode(mesh) {
  const n = mesh.pos.length / 3
  const axis = (k) => Array.from({ length: n }, (_, v) => Math.round(mesh.pos[3 * v + k] * 10))
  return {
    vertices: n,
    triangles: mesh.tris.length / 3,
    x: deltaVarint(axis(0)),
    y: deltaVarint(axis(1)),
    z: deltaVarint(axis(2)),
    index: deltaVarint(mesh.tris),
  }
}

// ---------------------------------------------------------------- atlas
const vol = readNifti(args.bna)
console.error(`atlas ${vol.dim.join('×')}, labels up to ${vol.data.reduce((m, x) => Math.max(m, x), 0)}`)

function centroid(label) {
  const [X, Y] = vol.dim
  let sx = 0, sy = 0, sz = 0, n = 0
  for (let c = 0; c < vol.data.length; c++) {
    if (vol.data[c] !== label) continue
    const i = c % X, j = Math.floor(c / X) % Y, k = Math.floor(c / (X * Y))
    const [x, y, z] = world(vol.srow, i, j, k)
    sx += x; sy += y; sz += z; n++
  }
  return n ? [sx / n, sy / n, sz / n].map((v) => +v.toFixed(1)) : null
}

if (args.centroids) {
  for (let l = Number(args.centroids); l <= 246; l++) console.log(l, JSON.stringify(centroid(l)))
  process.exit(0)
}

// Brainnetome: odd labels left, even right; 211-214 amygdala, 215-218
// hippocampus, 219-230 basal ganglia, 231-246 thalamus (checked against the
// Harvard-Oxford centroids in docs/research).
const DEEP = [
  { key: 'amygdala-l', name: 'Left amygdala', labels: [211, 213] },
  { key: 'amygdala-r', name: 'Right amygdala', labels: [212, 214] },
  { key: 'hippocampus-l', name: 'Left hippocampus', labels: [215, 217] },
  { key: 'hippocampus-r', name: 'Right hippocampus', labels: [216, 218] },
  { key: 'basal-ganglia-l', name: 'Left basal ganglia', labels: [219, 221, 223, 225, 227, 229] },
  { key: 'basal-ganglia-r', name: 'Right basal ganglia', labels: [220, 222, 224, 226, 228, 230] },
  { key: 'thalamus-l', name: 'Left thalamus', labels: [231, 233, 235, 237, 239, 241, 243, 245] },
  { key: 'thalamus-r', name: 'Right thalamus', labels: [232, 234, 236, 238, 240, 242, 244, 246] },
]

const meshes = {}
const lh = buildMesh(vol, (l) => l > 0 && l % 2 === 1)
const rh = buildMesh(vol, (l) => l > 0 && l % 2 === 0)
meshes['cortex-l'] = { name: 'Left hemisphere', ...encode(lh) }
meshes['cortex-r'] = { name: 'Right hemisphere', ...encode(rh) }
for (const d of DEEP) {
  const set = new Set(d.labels)
  const m = buildMesh(vol, (l) => set.has(l), { smooth: 8 })
  const c = d.labels.map(centroid)
  meshes[d.key] = { name: d.name, centroid: c.reduce((a, b) => a.map((x, i) => x + b[i] / c.length), [0, 0, 0]).map((v) => +v.toFixed(1)), ...encode(m) }
}
// CerebrA labels (CerebrA_LabelDetails.csv): right hemisphere 1-51, left 52-102.
if (args.cerebra) {
  const cb = readNifti(args.cerebra)
  const HIND = [
    { key: 'cerebellum-l', name: 'Left cerebellum', labels: [97, 90, 101, 53, 71] },
    { key: 'cerebellum-r', name: 'Right cerebellum', labels: [46, 39, 50, 2, 20] },
    { key: 'brainstem', name: 'Brainstem', labels: [11, 62] },
  ]
  for (const h of HIND) {
    const set = new Set(h.labels)
    meshes[h.key] = { name: h.name, ...encode(buildMesh(cb, (l) => set.has(l), { smooth: 10 })) }
  }
}

for (const [k, m] of Object.entries(meshes)) console.error(`${k.padEnd(16)} ${m.vertices} vertices, ${m.triangles} triangles${m.centroid ? ' centroid ' + m.centroid.join(',') : ''}`)

// ---------------------------------------------------------------- sites
const rows = readFileSync(args.sites, 'utf8').trim().split(/\r?\n/).slice(1).map((l) => l.split('\t'))
let sites = Object.fromEntries(rows.map(([name, x, y, z]) => [name, [x, y, z].map((v) => Number(v) * 1000)]))

// Fit a translation so site-to-brain distances match published depths
// (fsaverage head vs MNI152 brain; the frames differ by several mm).
const brainPts = [lh.pos, rh.pos]
function depth(p) {
  let best = Infinity
  for (const pos of brainPts) for (let v = 0; v < pos.length; v += 3) {
    const d = (pos[v] - p[0]) ** 2 + (pos[v + 1] - p[1]) ** 2 + (pos[v + 2] - p[2]) ** 2
    if (d < best) best = d
  }
  return Math.sqrt(best)
}
let shift = [0, 0, 0]
if (args.regions) {
  const regions = JSON.parse(readFileSync(args.regions, 'utf8'))
  // Lateral and upper sites only: the atlas has no cerebellum, so occipital-inferior depths would mislead.
  const ref = regions.filter((r) => r.kind === 'scalp-position').map((r) => ({ site: r.nearest_10_10[0], depth: r.depth_from_scalp_mm }))
    .filter((r) => sites[r.site] && !/^(O|PO|TP9|TP10|FT9|FT10|I)/.test(r.site))
  const cost = (t) => ref.reduce((s, r) => s + (depth(sites[r.site].map((v, i) => v + t[i])) - r.depth) ** 2, 0) / ref.length
  let best = { t: [0, 0, 0], c: cost([0, 0, 0]) }
  console.error(`site alignment: ${ref.length} reference depths, rms error ${Math.sqrt(best.c).toFixed(1)} mm before`)
  for (const step of [4, 2, 1, 0.5]) {
    let improved = true
    while (improved) {
      improved = false
      for (let axis = 0; axis < 3; axis++) for (const s of [-step, step]) {
        const t = best.t.slice()
        t[axis] += s
        const c = cost(t)
        if (c < best.c - 1e-6) { best = { t, c }; improved = true }
      }
    }
  }
  shift = best.t
  console.error(`shift ${shift.join(', ')} mm, rms error ${Math.sqrt(best.c).toFixed(1)} mm after`)
  for (const r of ref) console.error(`  ${r.site.padEnd(5)} published ${r.depth} mm, here ${depth(sites[r.site].map((v, i) => v + shift[i])).toFixed(1)} mm`)
}
sites = Object.fromEntries(Object.entries(sites).map(([k, p]) => [k, p.map((v, i) => +(v + shift[i]).toFixed(1))]))

mkdirSync(args.out, { recursive: true })
writeFileSync(join(args.out, 'brain-mesh.json'), JSON.stringify({
  source: 'Brainnetome atlas BNA-maxprob-thr25-1mm (Fan et al. 2016, Cereb Cortex), NeuroVault collection 1625, CC0' +
    (args.cerebra ? '; cerebellum and brainstem: CerebrA (Manera et al. 2020, Sci Data), CC0' : '') +
    '. Surface nets on a ' + GRID + '-mm grid, Taubin smoothing. MNI152 mm; positions in 0.1 mm; x, y, z and index are delta-zigzag-varint, base64.',
  meshes,
}))
writeFileSync(join(args.out, 'sites.json'), JSON.stringify({
  source: 'MNE-Python fsaverage_1005.tsv (BSD-3-Clause; Oostenveld & Praamstra 2001 10-05 system), metres -> mm, translated by [' + shift.join(', ') + '] mm onto the MNI152 brain.',
  sites,
}))
console.error(`wrote ${args.out}/brain-mesh.json and sites.json`)
