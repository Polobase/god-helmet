import type { PagesCollectionItem } from '@nuxt/content'
import { DOCS, DOC_GROUPS, PROGRAM_REFERENCE, pathFor } from '~~/shared/content-meta'

export type PageSummary = Pick<PagesCollectionItem, 'path' | 'title' | 'description' | 'section' | 'slug' | 'label' | 'group' | 'order' | 'minutes' | 'updated' | 'file'>

const FIELDS = ['path', 'title', 'description', 'section', 'slug', 'label', 'group', 'order', 'minutes', 'updated', 'file'] as const

/** Every article or doc, in reading order, without its body. */
export function usePageList(section: 'articles' | 'docs') {
  return useAsyncData(`list-${section}`, () =>
    queryCollection('pages').where('section', '=', section).select(...FIELDS).order('order', 'ASC').all() as Promise<PageSummary[]>)
}

export interface DocLink { label: string, to: string, description: string }

/** An icon for each group of the docs (lucide; named here so they are bundled). */
const GROUP_ICONS: Record<string, string> = {
  'Start here': 'i-lucide-compass',
  'Build it': 'i-lucide-wrench',
  'Use it': 'i-lucide-play',
  'Reference': 'i-lucide-book-open',
  'Audit': 'i-lucide-clipboard-check',
  'Library notes': 'i-lucide-library',
}

export interface DocGroup { title: string, icon: string, links: DocLink[] }

/**
 * The docs by group, from the list in shared/content-meta.ts alone: the
 * header's menu and the sidebar need it on every page, without a query.
 */
export function docIndex(): DocGroup[] {
  return DOC_GROUPS.map((title) => {
    const links: DocLink[] = DOCS.filter((d) => d.section === 'docs' && d.group === title).map((d) => ({ label: d.label, to: pathFor(d), description: d.description }))
    // After "Signals": what the coils play, then every program that plays it.
    if (PROGRAM_REFERENCE.group === title) links.splice(1, 0, { label: PROGRAM_REFERENCE.label, to: pathFor(PROGRAM_REFERENCE), description: PROGRAM_REFERENCE.description })
    return { title, icon: GROUP_ICONS[title] ?? 'i-lucide-file-text', links }
  }).filter((g) => g.links.length > 0)
}

/** The same as a tree for UContentNavigation: each group folds, as in Nuxt UI's Docs template. */
export function docNavigation() {
  return docIndex().map((g) => ({ title: g.title, icon: g.icon, path: g.links[0]!.to, children: g.links.map((l) => ({ title: l.label, path: l.to })) }))
}

/** Every docs page in reading order, for the links to the page before and after. */
export function docOrder(): DocLink[] {
  return docIndex().flatMap((g) => g.links)
}

/** Which group a docs page belongs to: the line above its title. */
export function docGroupOf(path: string): string {
  return docIndex().find((g) => g.links.some((l) => l.to === path))?.title ?? ''
}
