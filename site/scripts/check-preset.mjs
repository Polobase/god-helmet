#!/usr/bin/env node
// Validate program files the way the app and the firmware will load them,
// and what they say about their sources (core/lib/presetCheck.js).
//   npm run check-presets                              every file in presets/ and presets/archive/
//   node scripts/check-preset.mjs ../presets/obe.json  one or more files
// Exit code 1 if any file has an error. Warnings do not fail.
import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { checkPreset, duplicateIds } from '../core/lib/presetCheck.js'
import { presetFiles, archiveDir, siteKeys, regionIds } from './preset-files.mjs'

const args = process.argv.slice(2)
const all = presetFiles()
const files = args.includes('--all')
  ? all
  : args.filter((a) => !a.startsWith('--')).map((a) => ({ file: resolve(a), id: basename(a, '.json'), archived: resolve(a).startsWith(archiveDir) }))
if (!files.length) {
  console.error('usage: check-preset.mjs <preset.json ...> | --all')
  process.exit(2)
}
// A single file is also compared with the ids of the whole library.
const known = new Map(all.map((e) => [e.file, e]))
for (const f of files) known.set(f.file, f)
const duplicates = duplicateIds([...known.values()])

let failed = 0
let warned = 0
for (const { file, id, archived } of files) {
  const { errors, warnings, session } = checkPreset(readFileSync(file, 'utf8'), { fileId: id, siteKeys, regionIds, archived })
  if (duplicates.has(file)) errors.push(duplicates.get(file))
  if (errors.length) failed++
  warned += warnings.length
  const info = session ? `${session.phases.length} phases, ${Math.round(session.totalMs / 60000)} min, ${session.layout}${archived ? ', archived' : ''}` : ''
  console.log(`${errors.length ? 'FAIL' : 'ok  '} ${id} ${info}`)
  for (const e of errors) console.log(`     error: ${e}`)
  for (const w of warnings) console.log(`     warning: ${w}`)
}
console.log(`${files.length - failed}/${files.length} valid${warned ? `, ${warned} warnings` : ''}`)
process.exit(failed ? 1 : 0)
