<script setup lang="ts">
// The public site: landing page, articles and docs.
import type { ContentSearchFile } from '@nuxt/ui'
import { DOCS, PROGRAM_REFERENCE, pathFor } from '~~/shared/content-meta'

// The search index is one static file, fetched when the search first opens.
const { open } = useContentSearch()
const files = ref<ContentSearchFile[]>([])
// Every program, by name and summary; each leads to its entry in the program reference.
const programs = ref<{ label: string, suffix: string, to: string, icon: string }[]>([])
const groups = computed(() => (programs.value.length ? [{ id: 'programs', label: 'Programs', items: programs.value }] : []))
const loading = ref(false)
watch(open, async (isOpen) => {
  if (!isOpen || files.value.length || loading.value) return
  loading.value = true
  try {
    const [sections, index] = await Promise.all([
      $fetch<ContentSearchFile[]>('/search.json'),
      $fetch<{ id: string, name: string, summary: string }[]>('/program-index.json'),
    ])
    files.value = sections
    programs.value = index.map((p) => ({ label: p.name, suffix: p.summary, to: `${pathFor(PROGRAM_REFERENCE)}#${p.id}`, icon: 'i-lucide-audio-waveform' }))
  } finally {
    loading.value = false
  }
})
// The pages, by section: the search lists a page's sections under its name.
const section = (name: 'articles' | 'docs') => DOCS.filter((d) => d.section === name).map((d) => ({ title: d.label, path: pathFor(d) }))
const navigation = [
  { title: 'Articles', path: '/articles', children: section('articles') },
  { title: 'Docs', path: '/docs', children: [...section('docs'), { title: PROGRAM_REFERENCE.label, path: pathFor(PROGRAM_REFERENCE) }] },
]
const searchLinks = [
  { label: 'Articles', to: '/articles', icon: 'i-lucide-book-open' },
  { label: 'Docs', to: '/docs', icon: 'i-lucide-file-text' },
  { label: 'Program reference', to: '/docs/programs', icon: 'i-lucide-list' },
  { label: 'Open the app', to: '/app/programs', icon: 'i-lucide-play' },
]
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <a href="#content" class="skip">Skip to the content</a>
    <SiteHeader />
    <UMain id="content" class="flex-1">
      <slot />
    </UMain>
    <SiteFooter />
    <ClientOnly>
      <LazyUContentSearch :files="files" :navigation="navigation" :groups="groups" :links="searchLinks" :loading="loading" :color-mode="false" placeholder="Search articles, docs and programs…" />
    </ClientOnly>
  </div>
</template>
