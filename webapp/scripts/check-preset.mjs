#!/usr/bin/env node
// Validate preset files the way the app and the firmware will load them.
//   node scripts/check-preset.mjs ../presets/obe.json [more.json ...]
//   node scripts/check-preset.mjs --all
// Exit code 1 if any file has an error. Warnings do not fail.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSession, MAX_PHASES, MAX_TABLE_POOL } from '../src/engine/session.js'
import { coilsUsed } from '../src/engine/spatial.js'

const here = dirname(fileURLToPath(import.meta.url))
const presetsDir = join(here, '..', '..', 'presets')
const sites = JSON.parse(readFileSync(join(here, '..', 'src', 'assets', 'brain', 'sites.json'), 'utf8')).sites
const regions = JSON.parse(readFileSync(join(here, '..', 'src', 'assets', 'brain', 'regions.json'), 'utf8')).regions
const SITE_KEYS = new Set(Object.keys(sites))
const REGION_IDS = new Set(regions.map((r) => r.id))
// Keep in sync with webapp/src/lib/presets.js CATEGORY_LABELS.
const CATEGORIES = ['spiritual', 'presence', 'obe', 'psi', 'meditation', 'mood', 'dreams', 'body', 'signals', 'courses', 'lowfield', 'persinger', 'replication', 'research', 'control']
const EVIDENCE = ['established', 'single-lab', 'claim', 'anecdote', 'unverified']
const MAX_BLE_BYTES = 96 * 1024
const FIRMWARE_SITE = /^[A-Za-z]+([0-9]+|z)h?$/

function check(file) {
  const errors = []
  const warnings = []
  const text = readFileSync(file, 'utf8')
  let doc
  try {
    doc = JSON.parse(text)
  } catch (e) {
    return { errors: [`invalid JSON: ${e.message}`], warnings }
  }
  if (/\/Users\/|\\Users\\|file:\/\/|Torrent/i.test(text)) errors.push('contains a local file path or local source reference')
  if (Buffer.byteLength(JSON.stringify(doc)) > MAX_BLE_BYTES) errors.push('larger than the 96 KB BLE request limit')
  if (doc.id !== basename(file, '.json')) errors.push(`id "${doc.id}" must match the file name`)
  // firmware buffers (lib/engine/src/session.h): id 63, name 95, phase name 63 characters
  if (String(doc.id).length > 63) errors.push('id longer than 63 characters')
  if (String(doc.name ?? '').length > 95) warnings.push('name longer than 95 characters (cut short in the helmet log)')
  for (const ph of doc.phases ?? []) if (String(ph.name ?? '').length > 63) warnings.push(`phase name "${ph.name}" longer than 63 characters (cut short on the helmet)`)
  for (const k of ['id', 'name', 'category', 'summary', 'source']) if (!doc[k]) errors.push(`missing "${k}"`)
  if (doc.category && !CATEGORIES.includes(doc.category)) errors.push(`unknown category "${doc.category}" (${CATEGORIES.join(', ')})`)
  if (doc.evidence && !EVIDENCE.includes(doc.evidence)) errors.push(`unknown evidence "${doc.evidence}" (${EVIDENCE.join(', ')})`)
  if (!doc.evidence && doc.category !== 'control') warnings.push('no "evidence" level')
  if (!doc.origin && doc.category !== 'control') warnings.push('no "origin"')
  if (doc.uT !== undefined && !(doc.uT > 0 && doc.uT <= 5)) errors.push('"uT" must be in (0, 5]')
  for (const t of doc.targets ?? []) if (!REGION_IDS.has(t)) errors.push(`unknown target region "${t}"`)
  let session
  try {
    session = parseSession(doc)
  } catch (e) {
    errors.push(`engine: ${e.message}`)
    return { errors, warnings }
  }
  if (session.phases.length > MAX_PHASES) errors.push(`more than ${MAX_PHASES} phases`)
  if (doc.layout === 'custom') {
    doc.placement.sites.forEach((s, i) => {
      if (!s) return
      if (!SITE_KEYS.has(s)) errors.push(`CH${i + 1}: "${s}" is not a 10-05 site name (case matters: FT7, Cz, TP8, T10, FTT7h ...)`)
      if (!FIRMWARE_SITE.test(s)) errors.push(`CH${i + 1}: "${s}" is not accepted by the firmware`)
    })
  }
  const tables = session.phases.flatMap((p) => [p.pattern, p.track2?.pattern]).filter((p) => p?.type === 'table')
  const pool = new Set(tables.map((p) => p.table)).size && [...new Set(tables.map((p) => p.table))].reduce((a, t) => a + t.length, 0)
  if (pool > MAX_TABLE_POOL) errors.push('table data over 16384 points')
  session.phases.forEach((p, i) => {
    const used = coilsUsed(p.spatial, session.geometry)
    if (p.pattern.type !== 'off' && used.every((u) => !u)) warnings.push(`phase ${i + 1}: no coil is active`)
    if (p.track2 && p.track2.pattern.type !== 'off' && coilsUsed(p.track2.spatial, session.geometry).every((u) => !u)) warnings.push(`phase ${i + 1} track 2: no coil is active`)
  })
  return { errors, warnings, session }
}

const args = process.argv.slice(2)
const files = args.includes('--all') ? readdirSync(presetsDir).filter((f) => f.endsWith('.json')).map((f) => join(presetsDir, f)) : args
if (!files.length) {
  console.error('usage: check-preset.mjs <preset.json ...> | --all')
  process.exit(2)
}
let failed = 0
const ids = new Map()
for (const f of files) {
  const { errors, warnings, session } = check(f)
  const id = basename(f, '.json')
  if (ids.has(id)) errors.push(`duplicate id (also ${ids.get(id)})`)
  ids.set(id, f)
  if (errors.length) failed++
  const status = errors.length ? 'FAIL' : 'ok  '
  const info = session ? `${session.phases.length} phases, ${Math.round(session.totalMs / 60000)} min, ${session.layout}` : ''
  console.log(`${status} ${id} ${info}`)
  for (const e of errors) console.log(`     error: ${e}`)
  for (const w of warnings) console.log(`     warning: ${w}`)
}
console.log(`${files.length - failed}/${files.length} valid`)
process.exit(failed ? 1 : 0)
