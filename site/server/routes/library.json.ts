// What the landing page says about the library, counted from the files
// themselves at build time, so the numbers cannot go stale.
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export default defineEventHandler(async () => {
  const root = resolve(process.cwd(), '..')
  const json = async (dir: string) => (await readdir(resolve(root, dir))).filter((f) => f.endsWith('.json')).map((f) => resolve(root, dir, f))
  const presets = await json('presets')
  const names = await Promise.all(presets.map(async (f) => String(JSON.parse(await readFile(f, 'utf8')).name ?? '')))
  return { programs: presets.length, guides: (await json('guides')).length, names: names.filter(Boolean) }
})
