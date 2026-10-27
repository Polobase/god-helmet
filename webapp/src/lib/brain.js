// Brain-view data: meshes (loaded on demand), 10-05 site positions, curated
// target regions, and the estimated field exposure of a program phase.
import sitesAsset from '../assets/brain/sites.json'
import { coilFields, phaseExposure, coilPose, coilFieldAt } from '../engine/field.js'
import { geometryFor } from '../engine/spatial.js'
import { LAYOUTS } from './layouts.js'
import { decodeMesh } from './meshcodec.js'

export const SITES = sitesAsset.sites
const SITE_KEYS = Object.fromEntries(Object.keys(SITES).map((k) => [k.toLowerCase(), k]))

// Canonical 10-05 name ("fT7" -> "FT7"), or null if unknown.
export const siteName = (name) => (name ? SITE_KEYS[String(name).toLowerCase()] ?? null : null)
export const sitePos = (name) => SITES[siteName(name)] ?? null

// The eight coil sites of a parsed session ('' / null = unused channel).
export function sessionSites(session) {
  if (session.layout === 'custom') return session.sites.map((s) => s || null)
  return LAYOUTS[session.layout].channels.map((c) => c.site)
}

// ---------------------------------------------------------------- assets
let assets = null
export function loadBrain() {
  assets ??= Promise.all([import('../assets/brain/brain-mesh.json'), import('../assets/brain/regions.json')]).then(([m, r]) => {
    const meshes = Object.entries(m.default.meshes).map(([key, e]) => ({ key, name: e.name, centroid: e.centroid ?? null, ...decodeMesh(e) }))
    return { meshes, regions: r.default.regions, zones: r.default.zones ?? [], sources: { mesh: m.default.source, regions: r.default.source } }
  })
  return assets
}

// ---------------------------------------------------------------- exposure
// Field maps per site are cached: switching programs only recomputes the sum.
const fieldCache = new Map()
function fieldsFor(meshKey, positions, site) {
  const key = `${meshKey}|${site}`
  if (!fieldCache.has(key)) fieldCache.set(key, coilFields([SITES[site]], positions)[0])
  return fieldCache.get(key)
}

// Points of interest (regions with MNI coordinates) as one pseudo-mesh.
function regionPoints(regions) {
  const position = new Float32Array(regions.length * 3)
  regions.forEach((r, i) => position.set(r.mni, 3 * i))
  return position
}

// Exposure of one phase (or every phase: index 'all' = per-point maximum).
// Returns { meshes: {key: {peak, rms}}, regions: [{region, peak, rms}] }.
export function exposure(brain, session, phaseIndex, uT = 1) {
  const sites = sessionSites(session).map(siteName)
  const geometry = session.geometry ?? geometryFor(session.layout)
  const phases = phaseIndex === 'all' ? session.phases : [session.phases[phaseIndex]]
  const targets = [...brain.meshes.map((m) => ({ key: m.key, position: m.position })), { key: '_regions', position: regionPoints(brain.regions) }]
  const out = {}
  for (const t of targets) {
    const fields = sites.map((s) => (s ? fieldsFor(t.key, t.position, s) : null))
    const count = t.position.length / 3
    const peak = new Float32Array(count)
    const rms = new Float32Array(count)
    for (const ph of phases) {
      const e = phaseExposure(ph, geometry, fields, uT, count)
      for (let v = 0; v < count; v++) {
        peak[v] = Math.max(peak[v], e.peak[v])
        rms[v] = Math.max(rms[v], e.rms[v])
      }
    }
    out[t.key] = { peak, rms }
  }
  const r = out._regions
  delete out._regions
  return {
    meshes: out,
    regions: brain.regions.map((region, i) => ({ region, peak: r.peak[i], rms: r.rms[i] })),
  }
}

// Instantaneous |B| (µT) on every mesh for the coil drives of one frame
// (render() output, -1..1 per channel). Reuses `out` arrays when given.
export function liveField(brain, session, drives, uT, out = {}) {
  const sites = sessionSites(session).map(siteName)
  for (const m of brain.meshes) {
    const n = m.position.length / 3
    const arr = (out[m.key] ??= new Float32Array(n))
    const fs = sites.map((s, ch) => (s && drives[ch] ? [fieldsFor(m.key, m.position, s), drives[ch] * uT] : null)).filter(Boolean)
    for (let v = 0; v < n; v++) {
      let x = 0, y = 0, z = 0
      for (const [f, k] of fs) {
        x += k * f[3 * v]
        y += k * f[3 * v + 1]
        z += k * f[3 * v + 2]
      }
      arr[v] = Math.sqrt(x * x + y * y + z * z)
    }
  }
  return out
}

// Single-coil field at the cortex straight under each coil (published depth of the site).
export function underCoil(brain, session, uT) {
  const depth = Object.fromEntries(brain.regions.filter((r) => r.site).map((r) => [r.site, r.depthMm]))
  return coilPoses(session).map((pose) => {
    if (!pose) return null
    const d = depth[pose.site] ?? 15
    const p = pose.face.map((x, i) => x + pose.axis[i] * (d + 3))
    const b = coilFieldAt(pose, p)
    return { site: pose.site, depthMm: d, uT: Math.hypot(b[0], b[1], b[2]) * uT }
  })
}

// Coil poses (face centre, inward axis) for drawing.
export const coilPoses = (session) => sessionSites(session).map((s) => (sitePos(s) ? { site: siteName(s), ...coilPose(sitePos(s)) } : null))

// ---------------------------------------------------------------- colour
// Field colour scale: log10 from 0.05 µT (dark) to 10 µT (bright), "inferno"-like.
export const SCALE = { min: 0.05, max: 10 }
const STOPS = [
  [0.0, [0.12, 0.09, 0.2]],
  [0.2, [0.33, 0.06, 0.43]],
  [0.4, [0.62, 0.15, 0.4]],
  [0.6, [0.87, 0.32, 0.23]],
  [0.8, [0.98, 0.6, 0.1]],
  [1.0, [0.99, 0.96, 0.62]],
]
export function scalePos(uT) {
  if (!(uT > SCALE.min)) return 0
  return Math.min(1, Math.log10(uT / SCALE.min) / Math.log10(SCALE.max / SCALE.min))
}
export function fieldColor(uT) {
  const t = scalePos(uT)
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1]
      const [t1, c1] = STOPS[i]
      const f = (t - t0) / (t1 - t0)
      return c0.map((c, k) => c + f * (c1[k] - c))
    }
  }
  return STOPS[STOPS.length - 1][1]
}
export const cssColor = (uT) => `rgb(${fieldColor(uT).map((c) => Math.round(c * 255)).join(' ')})`

export const fmtUT = (v) => (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : '<0.01')
