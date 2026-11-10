import type { PagesCollectionItem } from '@nuxt/content'
import { DOC_GROUPS, PROGRAM_REFERENCE, pathFor } from '~~/shared/content-meta'

export type PageSummary = Pick<PagesCollectionItem, 'path' | 'title' | 'description' | 'section' | 'slug' | 'label' | 'group' | 'order' | 'minutes' | 'updated' | 'file'>

const FIELDS = ['path', 'title', 'description', 'section', 'slug', 'label', 'group', 'order', 'minutes', 'updated', 'file'] as const

/** Every article or doc, in reading order, without its body. */
export function usePageList(section: 'articles' | 'docs') {
  return useAsyncData(`list-${section}`, () =>
    queryCollection('pages').where('section', '=', section).select(...FIELDS).order('order', 'ASC').all() as Promise<PageSummary[]>)
}

export interface DocLink { label: string, to: string, description: string }

/** The docs sidebar: Markdown docs plus the generated program reference, by group. */
export function docGroups(pages: PageSummary[]): { title: string, links: DocLink[] }[] {
  return DOC_GROUPS.map((title) => {
    const links: DocLink[] = pages.filter((p) => p.group === title).map((p) => ({ label: p.label, to: p.path, description: p.description }))
    if (PROGRAM_REFERENCE.group === title) {
      // After "Signals": what the coils play, then every program that plays it.
      links.splice(1, 0, { label: PROGRAM_REFERENCE.label, to: pathFor(PROGRAM_REFERENCE), description: PROGRAM_REFERENCE.description })
    }
    return { title, links }
  })
}
