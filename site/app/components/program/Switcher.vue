<script setup lang="ts">
// "Switch program" in the program header: a search over all programs that
// keeps the open sub-page (compare fields in Brain, placements in Placement).
import type { CommandPaletteItem } from '@nuxt/ui'
import { fmtMinutes } from '#core/lib/format.js'
import { queryWords, score } from '#core/lib/search.js'
import { presets, categoryLabel, program, type Preset } from '~/lib/programs'

const route = useRoute()
const open = ref(false)
const query = ref('')
const all = presets

const catLabel = (p: Preset) => categoryLabel(p.doc.category) || 'Other'
const item = (p: Preset) => ({
  id: p.doc.id,
  label: p.doc.name,
  description: `${catLabel(p)}${p.session ? `, ${fmtMinutes(p.session.totalMs)}` : ''}`,
  active: p.doc.id === program.id,
  runnable: !!p.session,
})
const MAX = 60
const results = computed(() => {
  const words = queryWords(query.value)
  if (!words.length) return all.map(item)
  return all
    .map((p) => ({ p, s: score(words, [[p.doc.name, 3], [p.doc.id, 3], [catLabel(p), 2], [(p.session?.sites ?? []).filter(Boolean).join(' '), 2], [(p.doc.targets ?? []).join(' '), 2], [p.doc.summary ?? '', 1]], p.doc.id) }))
    .filter((x) => x.s).sort((a, b) => b.s - a.s).slice(0, MAX)
    .map(({ p }) => item(p))
})
// Our own ranking (whole words above word starts above substrings), not the palette's.
const groups = computed(() => [{ id: 'programs', items: results.value, ignoreFilter: true }])
const hint = computed(() => (query.value.trim()
  ? (results.value.length ? `${results.value.length}${results.value.length === MAX ? '+' : ''} matches, best first` : '')
  : `All ${all.length} programs. Type to search.`))

function choose(r: CommandPaletteItem | undefined) {
  if (!r?.id) return
  open.value = false
  if (r.id !== program.id) navigateTo(programPath(r.id, r.runnable ? programSub(route.path) : ''))
}
// It opens with an empty search, at the program that is open.
watch(open, async (o) => {
  if (!o) return
  query.value = ''
  await nextTick()
  requestAnimationFrame(() => {
    const at = results.value.findIndex((r) => r.active)
    document.querySelectorAll('[data-program-switcher] [role="option"]')[at]?.scrollIntoView({ block: 'center' })
  })
})
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end' }">
    <UButton size="sm" variant="ghost" icon="i-lucide-search" aria-haspopup="dialog">Switch program</UButton>
    <template #content>
      <UCommandPalette v-model:search-term="query" data-program-switcher :groups="groups" :model-value="undefined" class="h-[min(28rem,60vh)] w-[min(28rem,calc(100vw-2rem))]"
        placeholder="Search programs, sites, regions, e.g. Shiva, obe, T7" :close="false" :fuse="{ resultLimit: 500 }" @update:model-value="choose">
        <template #empty>
          <p class="px-4 py-6 text-sm text-muted">Nothing matches. Try a site name (FT7) or a word from the program name.</p>
        </template>
        <template #footer>
          <p v-if="hint" class="px-3 py-2 text-xs text-muted" role="status">{{ hint }}</p>
        </template>
      </UCommandPalette>
    </template>
  </UPopover>
</template>
