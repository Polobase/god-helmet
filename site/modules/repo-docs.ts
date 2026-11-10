// Turns the repository's Markdown into site pages: gives each file its place
// (shared/content-meta.ts), rewrites links written for GitHub and the old app,
// and marks evidence words.
import { defineNuxtModule } from '@nuxt/kit'
import { DOCS, HIDDEN_FIGURES, pathFor } from '../shared/content-meta'
import { resolveDocHref } from '../shared/links'

type Node = string | [string, Record<string, unknown>, ...Node[]]

const EVIDENCE_WORDS = new Set(['established', 'single-lab', 'claim', 'anecdote', 'unverified'])

const textOf = (node: Node): string => (typeof node === 'string' ? node : node.slice(2).map((c) => textOf(c as Node)).join(''))

function walk(nodes: Node[], file: string): Node[] {
  // (flatMap: a figure of an unpublished page leaves nothing behind.)
  return nodes.flatMap((node): Node[] => {
    if (typeof node === 'string') return [node]
    const [tag, props, ...children] = node
    if (tag === 'a' && typeof props.href === 'string') {
      const r = resolveDocHref(props.href, file)
      // A page that is not published: its name stays, as plain words.
      if (r.hidden) return [['span', {}, ...walk(children as Node[], file)]]
      const next: Record<string, unknown> = { ...props, href: r.href }
      if (r.external) Object.assign(next, { target: '_blank', rel: 'noopener' })
      return [[tag, next, ...walk(children as Node[], file)]]
    }
    if (tag === 'img' && typeof props.src === 'string' && !/^(https?:)?\/\//.test(props.src)) {
      const name = props.src.split('/').pop() ?? ''
      if (HIDDEN_FIGURES.includes(name)) return []
      // The file name is enough: ProseImg serves the figure from the bundle.
      return [[tag, { ...props, src: name }]]
    }
    // A picture on its own line: Markdown wraps it in a paragraph, but it is
    // drawn as a figure, which may not sit inside one.
    if (tag === 'p' && children.length === 1 && typeof children[0] !== 'string' && children[0]![0] === 'img') {
      return walk(children as Node[], file)
    }
    // **claim** -> an evidence badge (the five words of the evidence scale only).
    if (tag === 'strong' && children.length === 1 && typeof children[0] === 'string' && EVIDENCE_WORDS.has(children[0])) {
      return [['evidence-word', { level: children[0] }]]
    }
    return [[tag, props, ...walk(children as Node[], file)]]
  })
}

export default defineNuxtModule({
  meta: { name: 'repo-docs' },
  setup(_options, nuxt) {
    nuxt.hook('content:file:afterParse', (ctx) => {
      const abs = ctx.file.path.replace(/\\/g, '/')
      const order = DOCS.findIndex((m) => abs === m.file || abs.endsWith(`/${m.file}`))
      const meta = DOCS[order]
      if (!meta) throw new Error(`${abs}: not listed in shared/content-meta.ts.`)
      const c = ctx.content as Record<string, unknown>
      const body = c.body as { type: string, value: Node[], toc?: unknown }
      // The page draws its own title; the first heading leaves the body.
      const first = body.value.findIndex((n) => typeof n !== 'string' && n[0] === 'h1')
      if (first >= 0) {
        c.title = textOf(body.value[first]!)
        body.value.splice(first, 1)
      }
      body.value = walk(body.value, meta.file)

      const words = ctx.file.body.split(/\s+/).length
      Object.assign(c, {
        path: pathFor(meta),
        section: meta.section,
        slug: meta.slug,
        label: meta.label,
        group: meta.group,
        description: meta.description,
        updated: meta.updated,
        file: meta.file,
        order,
        minutes: Math.max(1, Math.round(words / 230)),
      })
    })
  },
})
