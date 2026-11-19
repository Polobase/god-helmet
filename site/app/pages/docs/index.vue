<script setup lang="ts">
// The docs' front page: every page by group, in the docs layout.
const groups = docIndex()
const slug = (title: string) => `group-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
const lede = 'Run blinded sessions, place the coils, look up every signal, program and protocol detail, and read what the sources say, page by page.'
const toc = groups.map((g) => ({ id: slug(g.title), depth: 2, text: g.title }))
const links = [
  { icon: 'i-lucide-list', label: 'All programs', to: '/docs/programs' },
  { icon: 'i-lucide-book-open', label: 'Articles', to: '/articles' },
  { icon: 'i-lucide-play', label: 'Open the app', to: '/app/programs' },
  { icon: 'i-lucide-external-link', label: 'Source on GitHub', to: 'https://github.com/Polobase/god-helmet', target: '_blank' },
]

useSeoMeta({ title: 'Docs', description: lede })
</script>

<template>
  <DocsShell>
    <UPage>
      <UPageHeader title="Docs" :description="lede" headline="God Helmet" />

      <UPageBody>
        <section v-for="g in groups" :key="g.title" :aria-labelledby="slug(g.title)">
          <h2 :id="slug(g.title)" class="flex items-center gap-2.5 text-2xl font-semibold text-highlighted scroll-mt-24">
            <UIcon :name="g.icon" class="size-5 text-primary" />{{ g.title }}
          </h2>
          <UPageGrid class="mt-5 sm:grid-cols-2 lg:grid-cols-2">
            <UPageCard v-for="l in g.links" :key="l.to" :to="l.to" :title="l.label" :description="l.description" variant="outline" />
          </UPageGrid>
        </section>
      </UPageBody>

      <template #right>
        <UContentToc title="Groups" :links="toc" highlight>
          <template #bottom>
            <div class="hidden lg:block space-y-6 mt-6!">
              <USeparator type="dashed" />
              <UPageLinks title="Elsewhere" :links="links" />
            </div>
          </template>
        </UContentToc>
      </template>
    </UPage>
  </DocsShell>
</template>
