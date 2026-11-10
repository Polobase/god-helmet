// Every program by name, for the site search: the program reference is
// generated from these files, not from Markdown, so the search index of the
// documents does not hold it.
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export default defineEventHandler(async () => {
  const dir = resolve(process.cwd(), '../presets')
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'))
  const docs = await Promise.all(files.map(async (f) => JSON.parse(await readFile(resolve(dir, f), 'utf8'))))
  return docs
    .map((d) => ({ id: String(d.id), name: String(d.name ?? d.id), summary: String(d.summary ?? '') }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
