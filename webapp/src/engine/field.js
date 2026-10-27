// Magnetic field of the helmet coils at points in the head (MNI mm).
//
// Coil model (project research, coil-model track): 495 turns spread over
// r 4.1-9.5 mm and 11 mm length, plus the ferrite/iron core as a uniformly
// magnetised cylinder (r 4 mm, 12 mm, flush with the face) represented by its
// surface current: about 1630 ampere-turns per ampere of winding current
// (apparent susceptibility ~5.2, limited by demagnetisation, so the exact core
// material hardly matters). This gives about 1.76 µT/mA at 20 mm on the axis,
// 2.4x the air-core value; tools/coil_field.py is the air-core estimate.
// Loops use the exact off-axis field (complete elliptic integrals via the AGM);
// beyond 40 mm a point dipole is used (they agree within 1 %).
//
// Fields are normalised the way the firmware calibrates intensity: the value a
// preset asks for (µT) is the peak on the coil axis 20 mm in front of the face
// (docs/CALIBRATION.md). The core changes the shape only near the coil
// (+46 % at 3 mm), and by 3-4 % at 30-50 mm, so normalised maps are robust.
import { patternValue } from './patterns.js'
import { spatialGains } from './spatial.js'

export const COIL = { turns: 495, rIn: 4.1, rOut: 9.5, length: 11, standoffMm: 3, core: { r: 4.0, length: 12, ampereTurns: 1630 } }
// The same winding without a core (matches tools/coil_field.py).
export const AIR_COIL = { turns: 495, rIn: 3.0, rOut: 9.5, length: 12, standoffMm: 3, core: null }
const MU0 = 4e-7 * Math.PI
const RINGS = 4
const SLICES = 4

// Complete elliptic integrals K(m), E(m) with parameter m = k².
function ellipticKE(m) {
  let a = 1
  let b = Math.sqrt(1 - m)
  let c = Math.sqrt(m)
  let sum = 0.5 * c * c
  let pow = 0.5
  for (let i = 0; i < 12 && Math.abs(c) > 1e-12; i++) {
    const an = (a + b) / 2
    c = (a - b) / 2
    b = Math.sqrt(a * b)
    a = an
    pow *= 2
    sum += pow * c * c
  }
  const K = Math.PI / (2 * a)
  return [K, K * (1 - sum)]
}

// Field of a circular loop (radius a, current 1 A) at cylindrical (rho, z), metres.
// Returns [B_rho, B_z] in tesla.
export function loopField(a, rho, z) {
  const q = (a + rho) ** 2 + z * z
  const m = (4 * a * rho) / q
  const [K, E] = ellipticKE(Math.min(m, 1 - 1e-12))
  const d = (a - rho) ** 2 + z * z
  const f = MU0 / (2 * Math.PI * Math.sqrt(q))
  const bz = f * (K + ((a * a - rho * rho - z * z) / d) * E)
  const br = rho < 1e-9 ? 0 : (f * z / rho) * (-K + ((a * a + rho * rho + z * z) / d) * E)
  return [br, bz]
}

// Loops of the winding (and the core's equivalent surface current) in coil
// coordinates: z = distance in front of the face (m). Cached per coil object.
const loopCache = new WeakMap()
function loops(coil = COIL) {
  if (loopCache.has(coil)) return loopCache.get(coil)
  const out = []
  for (let r = 0; r < RINGS; r++) {
    for (let s = 0; s < SLICES; s++) {
      out.push({
        a: (coil.rIn + ((r + 0.5) * (coil.rOut - coil.rIn)) / RINGS) / 1000,
        z0: -((s + 0.5) * coil.length) / SLICES / 1000,
        n: coil.turns / (RINGS * SLICES),
      })
    }
  }
  if (coil.core) {
    const CORE_SLICES = 8
    for (let s = 0; s < CORE_SLICES; s++) {
      out.push({ a: coil.core.r / 1000, z0: -((s + 0.5) * coil.core.length) / CORE_SLICES / 1000, n: coil.core.ampereTurns / CORE_SLICES })
    }
  }
  // dipole moment per ampere and its position (moment-weighted centre)
  let m = 0
  let zm = 0
  for (const l of out) {
    const w = l.n * Math.PI * l.a * l.a
    m += w
    zm += w * l.z0
  }
  out.m = m
  out.zc = zm / m
  loopCache.set(coil, out)
  return out
}

// Field per ampere at (rho, z) mm in front of the coil face: [B_rho, B_z] T/A.
export function coilFieldLocal(rhoMm, zMm, coil = COIL) {
  const rho = rhoMm / 1000
  const z = zMm / 1000
  const ls = loops(coil)
  const zc = z - ls.zc
  const dist = Math.hypot(rho, zc)
  if (dist > 0.04) {
    // point dipole at the moment-weighted centre
    const r = dist
    const k = (MU0 * ls.m) / (4 * Math.PI * r ** 5)
    return [k * 3 * rho * zc, k * (3 * zc * zc - r * r)]
  }
  let br = 0
  let bz = 0
  for (const l of ls) {
    const [r1, z1] = loopField(l.a, rho, z - l.z0)
    br += l.n * r1
    bz += l.n * z1
  }
  return [br, bz]
}

// On-axis field per mA at `mm` in front of the face, µT (AIR_COIL matches tools/coil_field.py).
export const onAxisUtPerMa = (mm, coil = COIL) => coilFieldLocal(0, mm, coil)[1] * 1e3

// ---------------------------------------------------------------- head geometry
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

// Approximate head centre in MNI mm (the 10-05 sites lie on a near-sphere about it).
export const HEAD_CENTRE = [0, -18, 8]

// Coil pose for a scalp site: face `standoffMm` outside the scalp, axis pointing
// inward along the local normal (radial from the head centre).
export function coilPose(sitePos, coil = COIL) {
  const axis = norm(sub(HEAD_CENTRE, sitePos))
  const face = sitePos.map((v, i) => v - axis[i] * coil.standoffMm)
  return { face, axis }
}

// Field vector (µT at the 20-mm calibration point = 1) of one coil at point p.
export function coilFieldAt(pose, p, coil = COIL, norm20 = onAxisUtPerMa(20, coil)) {
  const d = sub(p, pose.face)
  const z = dot(d, pose.axis)
  const radial = sub(d, pose.axis.map((v) => v * z))
  const rho = Math.hypot(radial[0], radial[1], radial[2])
  const [br, bz] = coilFieldLocal(rho, z, coil)
  const s = 1e3 / norm20 // T/A -> "calibrated units" (1 = preset µT)
  const u = rho > 1e-9 ? radial.map((v) => v / rho) : [0, 0, 0]
  return [0, 1, 2].map((i) => s * (bz * pose.axis[i] + br * u[i]))
}

// Field of every coil at many points: Float32Array per channel, xyz interleaved.
export function coilFields(sites, positions, coil = COIL) {
  const norm20 = onAxisUtPerMa(20, coil)
  return sites.map((sitePos) => {
    if (!sitePos) return null
    const pose = coilPose(sitePos, coil)
    const out = new Float32Array(positions.length)
    for (let v = 0; v < positions.length; v += 3) {
      const b = coilFieldAt(pose, [positions[v], positions[v + 1], positions[v + 2]], coil, norm20)
      out[v] = b[0]
      out[v + 1] = b[1]
      out[v + 2] = b[2]
    }
    return out
  })
}

// ---------------------------------------------------------------- exposure
// Peak and RMS of a pattern over `windowMs` (sampled at 0.5 ms).
export function patternStats(pattern, windowMs = 12000) {
  let peak = 0
  let sq = 0
  let n = 0
  for (let t = 0; t < windowMs; t += 0.5) {
    const v = patternValue(pattern, t)
    peak = Math.max(peak, Math.abs(v))
    sq += v * v
    n++
  }
  return { peak, rms: Math.sqrt(sq / n) }
}

// Distinct coil-gain vectors of a spatial mode over `windowMs`, with weights.
export function gainStates(spatial, geometry, windowMs = 12000, stepMs = 1) {
  const map = new Map()
  let n = 0
  for (let t = 0; t < windowMs; t += stepMs) {
    const g = spatialGains(spatial, geometry, t).map((x) => Math.round(x * 20) / 20)
    const key = g.join(',')
    const e = map.get(key)
    if (e) e.w++
    else map.set(key, { g, w: 1 })
    n++
  }
  return [...map.values()].map((e) => ({ g: e.g, w: e.w / n }))
}

// Exposure of each point for one phase: { peak, rms } Float32Arrays in µT.
// `fields` from coilFields(); uT = the program intensity; level per track.
export function phaseExposure(phase, geometry, fields, uT, count) {
  const peak = new Float32Array(count)
  const ms = new Float32Array(count)
  const tracks = [{ pattern: phase.pattern, spatial: phase.spatial, level: phase.level }]
  if (phase.track2) tracks.push(phase.track2)
  for (const tr of tracks) {
    const ps = patternStats(tr.pattern)
    if (ps.peak === 0 || tr.level === 0) continue
    const states = gainStates(tr.spatial, geometry)
    for (let v = 0; v < count; v++) {
      let pk = 0
      let m2 = 0
      for (const { g, w } of states) {
        let x = 0, y = 0, z = 0
        for (let ch = 0; ch < 8; ch++) {
          if (!g[ch] || !fields[ch]) continue
          x += g[ch] * fields[ch][3 * v]
          y += g[ch] * fields[ch][3 * v + 1]
          z += g[ch] * fields[ch][3 * v + 2]
        }
        const b2 = x * x + y * y + z * z
        if (b2 > pk) pk = b2
        m2 += w * b2
      }
      peak[v] += Math.sqrt(pk) * ps.peak * tr.level * uT
      ms[v] += m2 * (ps.rms * tr.level * uT) ** 2
    }
  }
  const rms = ms.map(Math.sqrt)
  return { peak, rms }
}
