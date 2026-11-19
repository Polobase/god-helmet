// llms.txt: what the site holds, for assistants, with every docs page as
// plain Markdown (as Nuxt UI's Docs template offers it).
import { DOCS, DOC_GROUPS, PROGRAM_REFERENCE, pathFor } from '../../shared/content-meta'

export default defineEventHandler((event) => {
  const base = String(useRuntimeConfig(event).public.siteUrl ?? '').replace(/\/$/, '')
  const docs = DOCS.filter((d) => d.section === 'docs')
  const lines = [
    '# God Helmet',
    '',
    '> An open eight-coil weak-field helmet, its programs and the evidence behind them: what the sources say, what the hardware can deliver, and how to test it blind against sham.',
    '',
    'Every figure about the helmet itself is calculated, not measured. Statements about effects carry an evidence grade: established, single-lab, claim, anecdote or unverified.',
  ]
  for (const group of DOC_GROUPS) {
    const pages = docs.filter((d) => d.group === group)
    if (!pages.length) continue
    lines.push('', `## ${group}`, '')
    for (const d of pages) lines.push(`- [${d.label}](${base}/raw/docs/${d.slug}.md): ${d.description}`)
  }
  lines.push('', '## Articles', '')
  for (const d of DOCS.filter((x) => x.section === 'articles')) lines.push(`- [${d.label}](${base}${pathFor(d)}): ${d.description}`)
  lines.push('', '## Programs', '', `- [${PROGRAM_REFERENCE.label}](${base}${pathFor(PROGRAM_REFERENCE)}): ${PROGRAM_REFERENCE.description}`, `- [Every program as JSON](${base}/library.json)`, '')
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return lines.join('\n')
})
