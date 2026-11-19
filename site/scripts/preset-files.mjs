// The program files and the tables the checker needs, read from disk
// (plain Node: for the command-line tools and the tests).
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const repo = join(here, '..', '..')
export const presetsDir = join(repo, 'presets')
/** Programs taken out of the library: kept, checked for syntax, loaded by nothing. */
export const archiveDir = join(presetsDir, 'archive')

const brain = join(here, '..', 'core', 'assets', 'brain')
export const siteKeys = new Set(Object.keys(JSON.parse(readFileSync(join(brain, 'sites.json'), 'utf8')).sites))
export const regionIds = new Set(JSON.parse(readFileSync(join(brain, 'regions.json'), 'utf8')).regions.map((r) => r.id))

const jsonIn = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => join(dir, f)) : [])
/** Every program file: [{ file, id, archived }]. */
export const presetFiles = () => [
  ...jsonIn(presetsDir).map((file) => ({ file, archived: false })),
  ...jsonIn(archiveDir).map((file) => ({ file, archived: true })),
].map((e) => ({ ...e, id: e.file.split('/').pop().replace(/\.json$/, '') }))
