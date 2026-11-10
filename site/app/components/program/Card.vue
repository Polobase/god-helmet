<script setup lang="ts">
import { categoryLabel, layoutInfo, sessionSites, type Preset } from '~/lib/programs'
// One program in the library: name, its coils on a small head, a line of the
// summary, length, evidence and layout.

const props = defineProps<{
  p: Preset
  current?: boolean
  showCategory?: boolean
}>()
const doc = computed(() => props.p.doc)
const minutes = computed(() => Math.round((props.p.session?.totalMs ?? 0) / 60000))
const layout = computed(() => (props.p.session ? layoutInfo(props.p.session.layout) : null))
</script>

<template>
  <NuxtLink :to="programPath(doc.id)" class="panel group flex min-w-0 flex-col gap-2.5 p-4 transition-colors hover:border-accented hover:bg-elevated/40"
    :class="{ 'border-primary! ring-1 ring-primary': current }" :aria-current="current ? 'true' : undefined">
    <span class="grid grid-cols-[minmax(0,1fr)_2.75rem] items-start gap-3">
      <span class="grid min-w-0 gap-0.5">
        <span v-if="showCategory" class="text-xs font-semibold text-muted">{{ categoryLabel(doc.category) }}</span>
        <span class="font-display text-[1.15rem] font-[620] leading-tight text-highlighted [overflow-wrap:anywhere]">{{ doc.name }}</span>
      </span>
      <CoilGlyph v-if="p.session" class="w-11" :sites="sessionSites(p.session)" />
    </span>
    <span v-if="doc.summary" class="line-clamp-2 text-sm text-muted max-sm:line-clamp-1">{{ doc.summary }}</span>
    <span v-if="p.session" class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-muted">
      <span><b class="num font-display text-base font-[620] text-highlighted">{{ minutes }}</b> min</span>
      <EvidenceBadge :level="doc.evidence" />
      <span v-if="layout && layout.key !== 'custom'" :title="layout.title">{{ layout.name }}</span>
    </span>
    <span v-else class="text-sm text-error">Invalid program file: {{ p.error }}</span>
  </NuxtLink>
</template>
