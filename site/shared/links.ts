// Links written for GitHub and for the old hash-routed app, mapped to this site.
// Pure functions: used while the Markdown is parsed (build) and by the plugin
// that forwards old #hash links (browser).
import { resolveRoute, isAppHash } from '../../webapp/src/lib/routes.js'
import { docByFile, pathFor, pathForOldSlug } from './content-meta'

export const REPO = 'https://github.com/Polobase/god-helmet'

export interface HashContext {
  /** The program an old link without an id opens (#brain, #placement). */
  lastProgram?: () => string
}

const enc = encodeURIComponent

/**
 * The old app's hash routes as paths of the new app:
 *   #programs/<id>/brain  ->  /app/programs/<id>/brain
 *   #docs/wiring          ->  /docs/wiring
 * Returns null for anything that is not an app route (an in-page anchor).
 */
export function appPathFromHash(hash: string, ctx: HashContext = {}): string | null {
  if (!isAppHash(hash)) return null
  let r = resolveRoute(hash, ctx)
  if (r.redirect) r = resolveRoute(r.redirect, ctx)
  const { tab, arg, sub } = r as { tab: string, arg: string, sub: string }
  if (tab === 'docs') return (arg && pathForOldSlug(arg)) || '/docs'
  if (tab === 'safety') {
    const back = arg ? appPathFromHash(`#${arg}`, ctx) : null
    return back && back.startsWith('/app/') ? `/app/safety?back=${enc(back)}` : '/app/safety'
  }
  return `/app/${tab}${arg ? `/${enc(arg)}${sub ? `/${enc(sub)}` : ''}` : ''}`
}

/** Repository path of `href`, relative to the folder of the file it is written in. */
export function repoPath(href: string, fromFile: string): string {
  const parts = fromFile.split('/').slice(0, -1)
  for (const seg of href.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg && seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

export interface ResolvedLink {
  href: string
  external: boolean
  /** The target is a page the site does not publish: show the words, not a link. */
  hidden?: boolean
}

/** Where a Markdown link in `fromFile` (a repository path) leads on this site. */
export function resolveDocHref(href: string, fromFile: string): ResolvedLink {
  if (!href) return { href, external: false }
  if (/^(https?:)?\/\//.test(href)) return { href, external: true }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { href, external: false } // mailto:, tel:
  if (href.startsWith('#')) return { href: appPathFromHash(href) ?? href, external: false }
  if (href.startsWith('/')) return { href, external: false }

  const [target = '', frag] = href.split('#')
  const path = repoPath(target, fromFile)
  // The Markdown parser drops ".md" from relative links before we see them.
  const doc = docByFile(path) ?? docByFile(`${path}.md`)
  if (doc?.hidden) return { href: '', external: false, hidden: true }
  if (doc) return { href: pathFor(doc) + (frag ? `#${frag}` : ''), external: false }
  const kind = /\.[a-z0-9]+$/i.test(path) ? 'blob' : 'tree'
  return { href: `${REPO}/${kind}/main/${path}${frag ? `#${frag}` : ''}`, external: true }
}

/** GitHub link to a file or folder of the repository. */
export const repoUrl = (path: string) => `${REPO}/${/\.[a-z0-9]+$/i.test(path) ? 'blob' : 'tree'}/main/${path}`
