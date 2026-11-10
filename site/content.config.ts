import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineCollection, defineCollectionSource, defineContentConfig, z } from '@nuxt/content'
import { DOCS } from './shared/content-meta'

const repo = fileURLToPath(new URL('..', import.meta.url))

// The repository's Markdown, read where it is: exactly the files listed in
// shared/content-meta.ts, which also gives each its section, slug and
// description (applied in modules/repo-docs.ts).
export default defineContentConfig({
  collections: {
    pages: defineCollection({
      type: 'page',
      source: defineCollectionSource({
        getKeys: async () => DOCS.map((d) => d.file),
        getItem: (key) => readFile(repo + key, 'utf8'),
      }),
      schema: z.object({
        section: z.enum(['articles', 'docs']),
        slug: z.string(),
        label: z.string(),
        group: z.string(),
        order: z.number(),
        file: z.string(),
        updated: z.string().optional(),
        minutes: z.number(),
      }),
    }),
  },
})
