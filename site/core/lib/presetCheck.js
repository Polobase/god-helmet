// The rules a program file must meet: what the app and the firmware will
// load, and what the file must say about its source. One function, used by
// scripts/check-preset.mjs and by test/presets.test.ts. No file access here.
import { parseSession, MAX_PHASES, MAX_TABLE_POOL, maxCurrentMA } from '../engine/session.js'
import { coilsUsed } from '../engine/spatial.js'
import { CATEGORY_LABELS } from './categories.js'
import { EVIDENCE } from './evidence.js'
import { FIDELITY, FIDELITY_REQUIRED, FIDELITY_UNTESTED, DOSE_UNITS, DOSE_PLANES, UT_MAX, DEFAULT_UT_PER_MA, DAC_SWING, MIN_SWING, TOP_KEYS, PLACEMENT_KEYS } from './presetSchema.js'

export const MAX_BLE_BYTES = 96 * 1024
// Site names the firmware accepts (firmware/lib/engine/src/spatial.cpp, sideFromSite).
const FIRMWARE_SITE = /^[A-Za-z]+([0-9]+|z)h?$/
const LOCAL_PATH = /\/Users\/|\\Users\\|file:\/\/|Torrent/i
const CATEGORIES = Object.keys(CATEGORY_LABELS)
const EVIDENCE_KEYS = Object.keys(EVIDENCE)
const FIDELITY_KEYS = Object.keys(FIDELITY)
const DOSE_KEYS = ['value', 'unit', 'plane', 'cite']
const isNumber = (x) => typeof x === 'number' && Number.isFinite(x)

/** DAC code steps each side of zero that a program at `uT` uses (default calibration). */
export const dacSwing = (uT, level = 1) => (uT / DEFAULT_UT_PER_MA / maxCurrentMA()) * DAC_SWING * level

function checkDose(dose, doc, errors, warnings) {
  if (dose === null || typeof dose !== 'object' || Array.isArray(dose)) return errors.push('"dose" must be an object { value, unit, plane, cite }')
  for (const k of Object.keys(dose)) if (!DOSE_KEYS.includes(k)) errors.push(`dose: unknown key "${k}"`)
  const v = dose.value
  const range = Array.isArray(v) && v.length === 2 && v.every(isNumber) && v[0] > 0 && v[0] < v[1]
  if (!(isNumber(v) && v > 0) && !range) errors.push('dose.value must be a number above 0, or [low, high]')
  if (!(dose.unit in DOSE_UNITS)) errors.push(`dose.unit must be one of ${Object.keys(DOSE_UNITS).join(', ')}`)
  if (!(dose.plane in DOSE_PLANES)) errors.push(`dose.plane must be one of ${Object.keys(DOSE_PLANES).join(', ')}`)
  if (typeof dose.cite !== 'string' || !dose.cite.trim()) errors.push('dose.cite is missing (source and page)')
  else {
    // The first word of the citation is the author or the document: it must be one of the program's sources.
    const author = dose.cite.trim().split(/[\s,]/)[0]
    if (author.length > 2 && !String(doc.source ?? '').toLowerCase().includes(author.toLowerCase())) warnings.push(`dose.cite names "${author}", which "source" does not list`)
  }
}

/**
 * Checks one program file.
 * @param text the file's text
 * @param o.fileId the file name without ".json"
 * @param o.siteKeys Set of the 10-05 site names (assets/brain/sites.json)
 * @param o.regionIds Set of the region ids (assets/brain/regions.json)
 * @param o.archived the file is in presets/archive: it must still parse, nothing more
 */
export function checkPreset(text, { fileId, siteKeys, regionIds, archived = false }) {
  const errors = []
  const warnings = []
  let doc
  try {
    doc = JSON.parse(text)
  } catch (e) {
    return { errors: [`invalid JSON: ${e.message}`], warnings, doc: null, session: null }
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return { errors: ['a program file must be a JSON object'], warnings, doc: null, session: null }
  if (LOCAL_PATH.test(text)) errors.push('contains a local file path or local source reference')
  if (doc.id !== fileId) errors.push(`id "${doc.id}" must match the file name`)
  for (const k of Object.keys(doc)) if (!TOP_KEYS.includes(k)) errors.push(`unknown key "${k}"`)
  if (doc.placement && typeof doc.placement === 'object') for (const k of Object.keys(doc.placement)) if (!PLACEMENT_KEYS.includes(k)) errors.push(`placement: unknown key "${k}"`)

  let session = null
  if (doc.phases !== undefined && !Array.isArray(doc.phases)) errors.push('"phases" must be a list')
  else {
    try {
      session = parseSession(doc)
    } catch (e) {
      errors.push(`engine: ${e.message}`)
    }
  }
  if (archived || !session) return { errors, warnings, doc, session }

  if (new TextEncoder().encode(JSON.stringify(doc)).length > MAX_BLE_BYTES) errors.push('larger than the 96 KB BLE request limit')
  // firmware buffers (lib/engine/src/session.h): id 63, name 95, phase name 63 characters
  if (String(doc.id).length > 63) errors.push('id longer than 63 characters')
  if (String(doc.name ?? '').length > 95) warnings.push('name longer than 95 characters (cut short in the helmet log)')
  for (const ph of doc.phases) if (String(ph.name ?? '').length > 63) warnings.push(`phase name "${ph.name}" longer than 63 characters (cut short on the helmet)`)
  for (const k of ['id', 'name', 'category', 'summary', 'source']) if (!doc[k]) errors.push(`missing "${k}"`)
  if (doc.category && !CATEGORIES.includes(doc.category)) errors.push(`unknown category "${doc.category}" (${CATEGORIES.join(', ')})`)
  if (doc.evidence && !EVIDENCE_KEYS.includes(doc.evidence)) errors.push(`unknown evidence "${doc.evidence}" (${EVIDENCE_KEYS.join(', ')})`)
  const control = doc.category === 'control'
  if (!doc.evidence && !control) warnings.push('no "evidence" level')
  if (!doc.origin && !control) warnings.push('no "origin"')
  if (doc.uT !== undefined && !(isNumber(doc.uT) && doc.uT > 0 && doc.uT <= UT_MAX)) errors.push(`"uT" must be a number in (0, ${UT_MAX}]`)
  for (const t of doc.targets ?? []) if (!regionIds.has(t)) errors.push(`unknown target region "${t}"`)

  // What the file says about its source.
  if (doc.fidelity !== undefined && !FIDELITY_KEYS.includes(doc.fidelity)) errors.push(`unknown fidelity "${doc.fidelity}" (${FIDELITY_KEYS.join(', ')})`)
  else if (doc.fidelity === undefined && !control) (FIDELITY_REQUIRED ? errors : warnings).push('no "fidelity"')
  if (FIDELITY_UNTESTED.includes(doc.fidelity) && !control && doc.evidence && doc.evidence !== 'unverified') {
    errors.push(`fidelity "${doc.fidelity}" needs evidence "unverified": nobody has tested what this helmet delivers here`)
  }
  if (doc.dose !== undefined) checkDose(doc.dose, doc, errors, warnings)

  if (session.phases.length > MAX_PHASES) errors.push(`more than ${MAX_PHASES} phases`)
  if (doc.layout === 'custom') {
    doc.placement.sites.forEach((s, i) => {
      if (!s) return
      if (!siteKeys.has(s)) errors.push(`CH${i + 1}: "${s}" is not a 10-05 site name (case matters: FT7, Cz, TP8, T10, FTT7h ...)`)
      if (!FIRMWARE_SITE.test(s)) errors.push(`CH${i + 1}: "${s}" is not accepted by the firmware`)
    })
  }
  const tables = new Set(session.phases.flatMap((p) => [p.pattern, p.track2?.pattern]).filter((p) => p?.type === 'table').map((p) => p.table))
  if ([...tables].reduce((a, t) => a + t.length, 0) > MAX_TABLE_POOL) errors.push(`table data over ${MAX_TABLE_POOL} points`)

  const uT = doc.uT ?? 1
  let smallest = Infinity
  session.phases.forEach((p, i) => {
    for (const [k, t] of [p, p.track2].entries()) {
      if (!t || t.pattern.type === 'off') continue
      const where = `phase ${i + 1}${k ? ' track 2' : ''}`
      if (coilsUsed(t.spatial, session.geometry).every((u) => !u)) warnings.push(`${where}: no coil is active`)
      smallest = Math.min(smallest, dacSwing(uT, t.level))
    }
  })
  if (smallest < MIN_SWING) warnings.push(`only ${Math.round(smallest)} DAC steps of swing at ${uT} µT (under ${MIN_SWING}: a point table loses levels)`)
  return { errors, warnings, doc, session }
}

/**
 * Checks across files: ids must be unique, active and archived together.
 * @param entries [{ id, file }]
 * @returns Map from file to its error
 */
export function duplicateIds(entries) {
  const seen = new Map()
  const out = new Map()
  for (const { id, file } of entries) {
    if (seen.has(id)) out.set(file, `duplicate id (also ${seen.get(id)})`)
    else seen.set(id, file)
  }
  return out
}
