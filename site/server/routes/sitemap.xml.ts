// The public pages, for search engines. Built only when the site's address
// is known (NUXT_PUBLIC_SITE_URL): a sitemap needs absolute addresses.
import { DOCS, PROGRAM_REFERENCE, pathFor } from '../../shared/content-meta'

export default defineEventHandler((event) => {
  const base = String(useRuntimeConfig(event).public.siteUrl ?? '').replace(/\/$/, '')
  const paths = ['/', '/articles', '/docs', pathFor(PROGRAM_REFERENCE), ...DOCS.map(pathFor)]
  setHeader(event, 'content-type', 'application/xml')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${base}${p === '/' ? '/' : p}</loc></url>`).join('\n')}\n</urlset>\n`
})
