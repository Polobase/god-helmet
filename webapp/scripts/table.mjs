#!/usr/bin/env node
// Print a protocol pulse table as a preset "pattern" object (JSON).
//   node scripts/table.mjs list
//   node scripts/table.mjs itbs
//   node scripts/table.mjs bhfs '{"hz": 6.55}'
//   node scripts/table.mjs cnp '{"burstMs": 838}' --meta
import { GENERATORS } from '../src/engine/generators.js'

const [name, opts, ...flags] = process.argv.slice(2)
if (!name || name === 'list' || !GENERATORS[name]) {
  for (const [key, gen] of Object.entries(GENERATORS)) {
    const { pattern, meta } = gen()
    console.log(`${key.padEnd(10)} ${meta.name} · ${pattern.data.length} points × ${pattern.pointMs} ms + ${pattern.gapMs} ms gap · ${meta.source}`)
  }
  process.exit(name && name !== 'list' ? 1 : 0)
}
const args = opts && !opts.startsWith('--') ? JSON.parse(opts) : {}
const { pattern, meta } = GENERATORS[name](args)
const withMeta = flags.includes('--meta') || opts === '--meta'
process.stdout.write(JSON.stringify(withMeta ? { pattern, meta } : pattern) + '\n')
