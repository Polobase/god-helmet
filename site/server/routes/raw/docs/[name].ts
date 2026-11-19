// A docs page as the Markdown it is written in: /raw/docs/<slug>.md. For
// "Copy page", for reading without the site around it, and for assistants
// (llms.txt lists these addresses). Built as static files with the site.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DOCS } from '../../../../shared/content-meta'

export default defineEventHandler(async (event) => {
  const slug = String(getRouterParam(event, 'name') ?? '').replace(/\.md$/, '')
  const meta = DOCS.find((d) => d.section === 'docs' && d.slug === slug)
  if (!meta) throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  setHeader(event, 'content-type', 'text/markdown; charset=utf-8')
  return readFile(resolve(process.cwd(), '..', meta.file), 'utf8')
})
