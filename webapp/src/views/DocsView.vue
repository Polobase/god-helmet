<script setup>
// Online documentation: renders the repository's Markdown (README + docs/*.md)
// and a program reference generated from presets/*.json.
import { computed, ref, watch, nextTick } from 'vue'
import { marked } from 'marked'
import { nav, go } from '../lib/nav.js'
import { presets, CATEGORY_LABELS, sourceEntries } from '../lib/presets.js'
import { LAYOUTS } from '../lib/layouts.js'
import { describePattern, describeSpatial, fmtMinutes } from '../lib/format.js'

const REPO = 'https://github.com/Polobase/god-helmet'

const files = {
  ...import.meta.glob('../../../docs/*.md', { eager: true, query: '?raw', import: 'default' }),
  '../../../README.md': import.meta.glob('../../../README.md', { eager: true, query: '?raw', import: 'default' })['../../../README.md'],
}
const images = import.meta.glob('../../../docs/*.svg', { eager: true, query: '?url', import: 'default' })

// Reading order; files not listed here appear at the end.
const ORDER = ['readme', 'research', 'history', 'signals', 'programs', 'preset_format', 'brain_view', 'placement', 'guides',
  'questionnaires', 'experiments', 'wiring', 'calibration', 'safety', 'ble_protocol']

const slugOf = (path) => path.split('/').pop().replace(/\.md$/i, '').toLowerCase()
const titleOf = (md, slug) => (md.match(/^#\s+(.+)$/m)?.[1] ?? slug).replace(/[*_`]/g, '')

const docs = computed(() => {
  const list = Object.entries(files)
    .filter(([, md]) => typeof md === 'string')
    .map(([path, md]) => ({ slug: slugOf(path), path: path.replace('../../../', ''), md, title: titleOf(md, slugOf(path)) }))
  list.push({ slug: 'programs', path: 'presets/', md: programsMarkdown(), title: 'Program reference', generated: true })
  const rank = (s) => (ORDER.includes(s) ? ORDER.indexOf(s) : 100)
  return list.sort((a, b) => rank(a.slug) - rank(b.slug) || a.title.localeCompare(b.title))
})

const current = computed(() => docs.value.find((d) => d.slug === (nav.arg || 'readme')) ?? docs.value[0])

// ---- program reference generated from the presets
function programsMarkdown() {
  const out = ['# Program reference', '',
    'Generated from `presets/*.json`, the same files the helmet runs. Evidence levels: **established** (independent replication), **single-lab**, **claim** (author/vendor statement), **anecdote**, **unverified**. Field values are peak µT at 20 mm depth (calibrate your coils).', '']
  let lastCat = ''
  for (const p of presets) {
    if (!p.session) continue
    const d = p.doc
    const s = p.session
    const cat = CATEGORY_LABELS[d.category] ?? d.category ?? 'Other'
    if (cat !== lastCat) {
      out.push(`## ${cat}`, '')
      lastCat = cat
    }
    out.push(`### ${d.name}`, '')
    out.push(`\`${d.id}\` · ${fmtMinutes(s.totalMs)} · ${d.uT ?? 1} µT · layout: ${s.layout === 'custom' ? 'custom' : LAYOUTS[s.layout].title}${d.evidence ? ` · evidence: **${d.evidence}**` : ''}${d.origin ? ` · ${d.origin}` : ''}`, '')
    if (d.summary) out.push(d.summary, '')
    if (d.setting) out.push(`**Setting:** ${d.setting}`, '')
    if (d.schedule) out.push(`**Schedule:** ${d.schedule}`, '')
    const sites = s.sites.map((site, i) => (site ? `CH${i + 1} ${site}` : null)).filter(Boolean).join(' · ')
    out.push(`**Coils:** ${sites}`, '')
    out.push('| # | Phase | Min | Signal | Coils |', '|---|---|---|---|---|')
    s.phases.forEach((ph, i) => out.push(`| ${i + 1} | ${ph.name.replace(/\|/g, '/')} | ${+(ph.durationMs / 60000).toFixed(2)} | ${describePattern(ph.pattern)}${ph.track2 ? ` + ${describePattern(ph.track2.pattern)}` : ''} | ${describeSpatial(ph.spatial)}${ph.track2 ? ` + ${describeSpatial(ph.track2.spatial)}` : ''}${ph.level < 1 ? ` · level ${ph.level}` : ''} |`))
    out.push('')
    if (d.notes) out.push(d.notes, '')
    if (d.targets?.length) out.push(`**Aims at:** ${d.targets.join(', ')} ([brain view](#brain/${d.id}))`, '')
    const src = sourceEntries(d.source).map((e) => (e.url ? `[${e.text || e.url}](${e.url})` : e.text))
    if (src.length) out.push(`**Sources:** ${src.join(' · ')}`, '')
  }
  return out.join('\n')
}

// ---- rendering: images from the bundle, links inside the app where possible
// Repository path of `href` relative to the current document's folder.
function repoPath(href) {
  const base = current.value.generated ? [] : current.value.path.split('/').slice(0, -1)
  const parts = [...base]
  for (const seg of href.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg && seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

function resolveHref(href) {
  if (!href || /^(https?:|mailto:|#)/.test(href)) return { href, external: /^https?:/.test(href ?? '') }
  const [target] = href.split('#')
  const path = repoPath(target)
  if (/\.md$/i.test(path)) {
    const slug = slugOf(path)
    if (docs.value.some((d) => d.slug === slug)) return { href: `#docs/${slug}` }
  }
  const kind = /\.[a-z0-9]+$/i.test(path) ? 'blob' : 'tree'
  return { href: `${REPO}/${kind}/main/${path}`, external: true }
}

const renderer = new marked.Renderer()
renderer.link = ({ href, title, tokens }) => {
  const text = marked.Parser.parseInline(tokens)
  const r = resolveHref(href)
  const t = title ? ` title="${title}"` : ''
  return r.external ? `<a href="${r.href}"${t} target="_blank" rel="noopener">${text}</a>` : `<a href="${r.href}"${t}>${text}</a>`
}
renderer.image = ({ href, title, text }) => {
  const key = `../../../docs/${href.replace(/^\.\//, '').replace(/^docs\//, '')}`
  const src = images[key] ?? href
  return `<figure class="doc-fig"><img src="${src}" alt="${text ?? ''}"${title ? ` title="${title}"` : ''} loading="lazy" /></figure>`
}
renderer.heading = ({ tokens, depth }) => {
  const text = marked.Parser.parseInline(tokens)
  const id = text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
  return `<h${depth} id="${id}">${text}</h${depth}>`
}
renderer.table = (token) => `<div class="table-wrap">${marked.Renderer.prototype.table.call(renderer, token)}</div>`

const html = computed(() => marked.parse(current.value.md, { renderer, gfm: true }))

const toc = computed(() => [...current.value.md.matchAll(/^(##|###)\s+(.+)$/gm)].map((m) => ({
  depth: m[1].length,
  text: m[2].replace(/[*_`]/g, ''),
  id: m[2].replace(/[*_`]/g, '').toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, ''),
})))

// ---- search across all docs
const query = ref('')
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (q.length < 3) return []
  const hits = []
  for (const d of docs.value) {
    const text = d.md
    const lower = text.toLowerCase()
    let i = lower.indexOf(q)
    let n = 0
    while (i >= 0 && n < 3) {
      const start = Math.max(0, i - 60)
      hits.push({ slug: d.slug, title: d.title, snippet: text.slice(start, i + q.length + 80).replace(/\s+/g, ' ') })
      i = lower.indexOf(q, i + q.length)
      n++
    }
  }
  return hits.slice(0, 40)
})

const article = ref(null)
watch(() => nav.arg, async () => {
  await nextTick()
  window.scrollTo({ top: 0 })
})
function jump(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="page docs">
    <aside class="side card" aria-label="Documentation">
      <input v-model="query" type="search" placeholder="Search all docs…" aria-label="Search documentation" />
      <ul v-if="results.length" class="results">
        <li v-for="(r, i) in results" :key="i">
          <a :href="`#docs/${r.slug}`" @click="query = ''"><b>{{ r.title }}</b><span class="muted small">…{{ r.snippet }}…</span></a>
        </li>
      </ul>
      <nav v-else class="doclist">
        <a v-for="d in docs" :key="d.slug" :href="`#docs/${d.slug}`" :class="{ active: d.slug === current.slug }">{{ d.title }}</a>
      </nav>
      <p class="muted small">Source: <a :href="`${REPO}/tree/main/${current.generated ? 'presets' : current.path}`" target="_blank" rel="noopener">{{ current.generated ? 'presets/*.json' : current.path }}</a></p>
    </aside>

    <article ref="article" class="card prose">
      <nav v-if="toc.length > 3" class="toc" aria-label="On this page">
        <span class="eyebrow">On this page</span>
        <a v-for="t in toc" :key="t.id" :class="'d' + t.depth" href="#" @click.prevent="jump(t.id)">{{ t.text }}</a>
      </nav>
      <div v-html="html"></div>
    </article>
  </div>
</template>

<style scoped>
.docs { display: grid; grid-template-columns: minmax(200px, 260px) minmax(0, 1fr); gap: 18px; align-items: start; max-width: 1200px; }
.side { position: sticky; top: 110px; max-height: calc(100vh - 130px); overflow: auto; gap: 10px; }
.doclist { display: grid; gap: 2px; }
.doclist a { color: var(--text); text-decoration: none; padding: 6px 8px; border-radius: 6px; font-size: 14px; }
.doclist a:hover { background: var(--surface-2); }
.doclist a.active { background: var(--accent-soft); color: var(--text); font-weight: 600; }
.results { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.results a { display: grid; gap: 2px; text-decoration: none; color: var(--text); font-size: 13px; }
.toc { display: grid; gap: 2px; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; font-size: 13px; }
.toc a { color: var(--muted); text-decoration: none; }
.toc a:hover { color: var(--accent); }
.toc a.d3 { padding-left: 14px; }
.prose { line-height: 1.65; font-size: 15.5px; min-width: 0; }
.prose :deep(h1) { font-size: 34px; margin: 4px 0 10px; }
.prose :deep(h2) { font-size: 25px; margin: 26px 0 8px; padding-top: 6px; border-top: 1px solid var(--line); }
.prose :deep(h3) { font-size: 19px; margin: 18px 0 6px; }
.prose :deep(p), .prose :deep(li) { max-width: 78ch; }
.prose :deep(p) { margin: 8px 0; }
.prose :deep(ul), .prose :deep(ol) { padding-left: 22px; margin: 8px 0; }
.prose :deep(code) { font-family: var(--font-mono); font-size: 13px; background: var(--surface-2); padding: 1px 5px; border-radius: 4px; }
.prose :deep(pre) { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 12px; overflow-x: auto; }
.prose :deep(pre code) { background: none; padding: 0; }
.prose :deep(blockquote) { margin: 10px 0; padding: 6px 14px; border-left: 3px solid var(--accent); background: var(--surface-2); border-radius: 0 8px 8px 0; }
.prose :deep(.table-wrap) { margin: 10px 0; }
.prose :deep(td), .prose :deep(th) { font-size: 13.5px; }
.prose :deep(.doc-fig) { margin: 12px 0; background: #f3f4f1; border-radius: 8px; padding: 8px; overflow-x: auto; }
.prose :deep(.doc-fig img) { min-width: 640px; width: 100%; display: block; }
.prose :deep(hr) { border: 0; border-top: 1px solid var(--line); margin: 20px 0; }
@media (max-width: 760px) {
  .docs { grid-template-columns: 1fr; }
  .side { position: static; max-height: none; }
}
</style>
