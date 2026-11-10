<script setup lang="ts">
// One Markdown document of the repository as a page: title, lede, body,
// "on this page", and the neighbours in reading order.
import type { PagesCollectionItem } from '@nuxt/content'
import type { PageSummary } from '~/composables/usePages'
import { repoUrl } from '~~/shared/links'

const props = defineProps<{ page: PagesCollectionItem, siblings: PageSummary[] }>()

const index = computed(() => props.siblings.findIndex((s) => s.path === props.page.path))
const surround = computed(() => [props.siblings[index.value - 1], props.siblings[index.value + 1]].map((s) => (s ? { title: s.label, description: s.description, path: s.path } : undefined)))
const updated = computed(() => (props.page.updated ? new Date(props.page.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''))
const toc = computed(() => props.page.body?.toc?.links ?? [])
// Sub-headings count: a page with two sections of three parts each has plenty to list.
const tocSize = computed(() => toc.value.reduce((n, l) => n + 1 + (l.children?.length ?? 0), 0))
</script>

<template>
  <article>
    <!-- How far through the page you are (browsers with scroll-driven animations). -->
    <div class="read-bar" aria-hidden="true" />
    <header class="pb-8 border-b border-(--hairline)">
      <slot name="kicker" />
      <h1 class="max-w-[20ch] text-[clamp(2.4rem,5.4vw,4.2rem)] font-[650] leading-[1.02] tracking-[-0.028em] [font-stretch:80%]">{{ page.title }}</h1>
      <p class="mt-5 text-lg text-toned measure">{{ page.description }}</p>
      <p class="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span>{{ page.minutes }} min read</span>
        <span v-if="updated">Updated {{ updated }}</span>
        <a :href="repoUrl(page.file)" target="_blank" rel="noopener" class="underline underline-offset-4 hover:text-highlighted">Source on GitHub</a>
      </p>
    </header>

    <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
      <div class="min-w-0 py-8">
        <UContentToc v-if="tocSize > 3" :links="toc" title="On this page" class="lg:hidden mb-6" />
        <ContentRenderer :value="page" class="doc-body" />
        <USeparator class="my-10" />
        <UContentSurround :surround="surround as any" />
      </div>
      <aside v-if="tocSize > 3" class="max-lg:hidden">
        <div class="sticky top-(--ui-header-height) max-h-[calc(100dvh-var(--ui-header-height))] overflow-y-auto py-8">
          <UContentToc :links="toc" title="On this page" highlight />
        </div>
      </aside>
    </div>
  </article>
</template>

<style>
.read-bar { position: fixed; z-index: 45; left: 0; top: var(--ui-header-height); width: 100%; height: 2px; background: var(--ui-primary); transform-origin: 0 50%; transform: scaleX(0); box-shadow: 0 0 12px var(--glow); }
@supports (animation-timeline: scroll()) {
  @media (prefers-reduced-motion: no-preference) { .read-bar { animation: read-bar linear both; animation-timeline: scroll(root); } }
}
@keyframes read-bar { to { transform: scaleX(1); } }

/* The body is long-form reading: one measure, tables may run wider and scroll. */
.doc-body > :where(p, ul, ol, blockquote, h2, h3, h4) { max-width: 70ch; }
.doc-body { font-size: 1.0625rem; line-height: 1.7; overflow-wrap: break-word; }
.doc-body table { font-size: 0.9rem; line-height: 1.5; }
/* Code keeps its lines (there are drawings made of characters) and scrolls sideways. */
.doc-body pre { white-space: pre !important; overflow-wrap: normal !important; word-break: normal !important; overflow-x: auto; }
.doc-body :where(h2, h3, h4) { scroll-margin-top: calc(var(--ui-header-height) + 1.25rem); }
</style>
