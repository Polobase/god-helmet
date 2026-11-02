// Builds the SD-card folder for the standalone display board.
//   npm run sd-pack -- <out dir>          -> <out dir>/godhelmet/...
//   npm run sd-pack -- --fixture          -> also refreshes firmware/test/tape/tape-reference.json
// Copy <out dir>/godhelmet to the root of a FAT32 card (docs/STANDALONE.md).
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPack, tapeFixture } from '../src/lib/sdpack.js'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const args = process.argv.slice(2)
const fixture = args.includes('--fixture')
const out = args.find((a) => !a.startsWith('--'))

const sites = JSON.parse(readFileSync(join(here, '..', 'src', 'assets', 'brain', 'sites.json'), 'utf8')).sites
if (fixture) {
  const path = join(repo, 'firmware', 'test', 'tape', 'tape-reference.json')
  writeFileSync(path, `${JSON.stringify(tapeFixture(sites), null, 1)}\n`)
  console.log(`wrote ${path}`)
}
if (!out) {
  if (!fixture) console.error('usage: npm run sd-pack -- <out dir> [--fixture]')
  process.exit(out || fixture ? 0 : 1)
}

const presetDir = join(repo, 'presets')
const docs = readdirSync(presetDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(presetDir, f), 'utf8')))
const { files, report } = buildPack(docs, sites, { date: new Date().toISOString().slice(0, 10) })

const root = join(out, 'godhelmet')
rmSync(root, { recursive: true, force: true })
let bytes = 0
for (const [path, text] of files) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), text)
  bytes += Buffer.byteLength(text)
}
console.log(`${report.programs} programs, ${report.placements} placements, ${files.size} files, ${(bytes / 1024).toFixed(0)} KB -> ${root}`)
console.log(`largest program file: ${report.largest.id} (${(report.largest.bytes / 1024).toFixed(1)} KB)`)
