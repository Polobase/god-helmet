<script setup lang="ts">
// One document as a docs page, in the structure of Nuxt UI's Docs template:
// header (group, title, lede, "Copy page"), body, the pages before and after,
// and "on this page" on the right with the page's own links under it.
import type { PagesCollectionItem } from '@nuxt/content'
import { repoUrl } from '~~/shared/links'
import { pageScene, SCENE_LABELS } from '~/lib/art'

const props = defineProps<{ page: PagesCollectionItem }>()

const order = docOrder()
const index = computed(() => order.findIndex((l) => l.to === props.page.path))
const surround = computed(() => [order[index.value - 1], order[index.value + 1]].map((s) => (s ? { title: s.label, description: s.description, path: s.to } : undefined)))
const updated = computed(() => (props.page.updated ? new Date(props.page.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''))
const toc = computed(() => props.page.body?.toc?.links ?? [])
// The drawing the page opens with, where one fits what it is about.
const scene = computed(() => pageScene(props.page.path))
const links = computed(() => [
  { icon: 'i-lucide-external-link', label: 'Source on GitHub', to: repoUrl(props.page.file), target: '_blank' },
  { icon: 'i-lucide-file-text', label: 'As Markdown', to: `/raw/docs/${props.page.slug}.md`, target: '_blank', external: true },
  { icon: 'i-lucide-list', label: 'All programs', to: '/docs/programs' },
  { icon: 'i-lucide-play', label: 'Open the app', to: '/app/programs' },
])
</script>

<template>
  <UPage>
    <!-- How far through the page you are (browsers with scroll-driven animations). -->
    <div class="read-bar" aria-hidden="true" />

    <UPageHeader :title="page.title" :description="page.description" :headline="docGroupOf(page.path)">
      <template #links>
        <DocsPageLinks :slug="page.slug" />
      </template>
      <p class="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span>{{ page.minutes }} min read</span>
        <span v-if="updated">Updated {{ updated }}</span>
        <a :href="repoUrl(page.file)" target="_blank" rel="noopener" class="underline underline-offset-4 hover:text-highlighted">Source on GitHub</a>
      </p>
      <ArtScene v-if="scene" :name="scene" :label="SCENE_LABELS[scene]" class="mt-6 max-w-80 text-highlighted" />
    </UPageHeader>

    <UPageBody>
      <ContentRenderer :value="page" class="doc-body" />

      <USeparator v-if="surround.some(Boolean)" />

      <UContentSurround :surround="surround as any" />
    </UPageBody>

    <template v-if="toc.length" #right>
      <UContentToc title="On this page" :links="toc" highlight>
        <template #bottom>
          <div class="hidden lg:block space-y-6 mt-6!">
            <USeparator type="dashed" />
            <UPageLinks title="This page" :links="links" />
          </div>
        </template>
      </UContentToc>
    </template>
  </UPage>
</template>

<style>
.read-bar { position: fixed; z-index: 45; left: 0; top: var(--ui-header-height); width: 100%; height: 2px; background: var(--ui-primary); transform-origin: 0 50%; transform: scaleX(0); box-shadow: 0 0 12px var(--glow); }
@supports (animation-timeline: scroll()) {
  @media (prefers-reduced-motion: no-preference) { .read-bar { animation: read-bar linear both; animation-timeline: scroll(root); } }
}
@keyframes read-bar { to { transform: scaleX(1); } }

.doc-body { overflow-wrap: break-word; }
.doc-body table { font-size: 0.875rem; line-height: 1.5; }
/* Code keeps its lines (there are drawings made of characters) and scrolls sideways. */
.doc-body pre { white-space: pre !important; overflow-wrap: normal !important; word-break: normal !important; overflow-x: auto; }
.doc-body :where(h2, h3, h4) { scroll-margin-top: calc(var(--ui-header-height) + 1.25rem); }
</style>
