<script setup lang="ts">
// Program library: find a program by category, by placement, by scalp site
// or by the experience it aims at. A card opens the program.
import { EVIDENCE_KEYS, evidenceLabel } from '#core/lib/evidence.js'
import { queryWords, score } from '#core/lib/search.js'
import { presets, groupedPresets, categoryLabel, library, groups, program, type Preset } from '~/lib/programs'
import { LOBES, filterGroups } from '~/lib/placement'
import { programMark } from '~/lib/art'

// Back from a program, the library is where you left it: the router leaves the
// scroll position alone then, and it is put back below.
definePageMeta({ scrollToTop: (_to, from) => !from.path.startsWith('/app/programs/') })

const route = useRoute()
const router = useRouter()
const missing = computed(() => (typeof route.query.missing === 'string' ? route.query.missing : ''))

onBeforeRouteLeave((to) => {
  if (to.path.startsWith('/app/programs/')) library.y = window.scrollY
})
onMounted(() => {
  // The page you came from: "back" after a link, "forward" after the browser's Back button.
  const { back, forward } = router.options.history.state
  if ([back, forward].some((p) => String(p ?? '').startsWith('/app/programs/'))) nextTick(() => window.scrollTo({ top: library.y }))
})

const MODES = [
  { value: 'category', label: 'Category' },
  { value: 'placement', label: 'Placement' },
  { value: 'site', label: 'Site' },
  { value: 'experience', label: 'Experience' },
]
const PLACEHOLDER: Record<string, string> = {
  category: 'Search programs, sites, brain regions…',
  placement: 'Filter by name, site or program',
  experience: 'Filter experiences, regions or programs',
}
const words = computed(() => queryWords(library.query))
const all = presets

// ---------------------------------------------------------------- by category
const catKey = (p: Preset) => p.doc.category || 'other'
const catLabel = (p: Preset) => categoryLabel(catKey(p))
const fieldsOf = (p: Preset) => [
  [p.doc.name, 3], [p.doc.id, 3], [catLabel(p), 2], [catKey(p), 2],
  [(p.session?.sites ?? []).filter(Boolean).join(' '), 2], [(p.doc.targets ?? []).join(' '), 2],
  [p.doc.origin ?? '', 1], [p.doc.summary ?? '', 1],
]
const byEvidence = (p: Preset) => !library.evidence || p.doc.evidence === library.evidence
const inCategory = (p: Preset) => !library.category || catKey(p) === library.category
const evidenceItems = [
  { label: 'Any evidence', value: 'any' },
  ...EVIDENCE_KEYS.map((k: string) => ({ label: `${evidenceLabel(k)} (${all.filter((p) => p.doc.evidence === k).length})`, value: k })),
]
const evidence = computed({ get: () => library.evidence || 'any', set: (v: string) => (library.evidence = v === 'any' ? '' : v) })
// Category chips count what the evidence filter leaves.
const chips = computed(() => groupedPresets().map((g) => ({ key: g.key, label: g.label, n: g.items.filter(byEvidence).length })).filter((c) => c.n))
const ranked = computed(() => {
  if (!words.value.length) return null
  return all.filter((p) => byEvidence(p) && inCategory(p))
    .map((p) => ({ p, s: score(words.value, fieldsOf(p), p.doc.id) }))
    .filter((x) => x.s).sort((a, b) => b.s - a.s).map((x) => x.p)
})
const FIRST = 3
const sections = computed(() => groupedPresets()
  .map((g) => ({ ...g, items: g.items.filter((p) => byEvidence(p) && inCategory(p)) }))
  .filter((g) => g.items.length)
  .map((g) => ({ ...g, shown: library.more[g.key] || library.category ? g.items : g.items.slice(0, FIRST) })))
const matchCount = computed(() => (ranked.value ? ranked.value.length : sections.value.reduce((a, g) => a + g.items.length, 0)))
const anyFilter = computed(() => !!(library.query.trim() || library.evidence || library.category || library.lobe))
function clearFilters() {
  library.query = ''
  library.evidence = ''
  library.category = ''
  library.lobe = null
}
const pickCategory = (key: string) => (library.category = library.category === key ? '' : key)
const more = library.more

// ---------------------------------------------------------------- by placement
const shownGroups = computed(() => filterGroups(groups, library.lobe, library.query))
</script>

<template>
  <div class="grid gap-5">
    <AppLivePanel />

    <header class="grid gap-4">
      <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 class="text-4xl">Programs</h1>
        <p class="num text-sm text-muted">{{ all.length }} programs, {{ groups.length }} placements</p>
      </div>
      <p class="measure text-sm text-muted">Each program sets the coils' signals, timing and sites. Open one to see its phases, where the coils go and where the field reaches, and to start it.</p>
      <UAlert v-if="missing" color="warning" variant="subtle" icon="i-lucide-search-x" :title="`No program called “${missing}”.`" role="status" />

      <UTabs v-model="library.mode" :items="MODES" :content="false" size="sm" class="w-full sm:w-fit" aria-label="Browse by" />

      <div v-if="library.mode !== 'site'" class="flex flex-wrap gap-2">
        <UInput v-model="library.query" type="search" icon="i-lucide-search" size="lg" class="min-w-56 flex-1" :placeholder="PLACEHOLDER[library.mode]" :aria-label="PLACEHOLDER[library.mode]" />
        <USelect v-if="library.mode === 'category'" v-model="evidence" :items="evidenceItems" size="lg" class="w-48" aria-label="Evidence level" />
      </div>

      <div v-if="library.mode === 'category'" class="flex flex-wrap gap-1.5" role="group" aria-label="Category">
        <UButton size="xs" class="rounded-full" :variant="!library.category ? 'soft' : 'outline'" :color="!library.category ? 'primary' : 'neutral'" :aria-pressed="!library.category" @click="library.category = ''">All</UButton>
        <UButton v-for="c in chips" :key="c.key" size="xs" class="rounded-full" :variant="library.category === c.key ? 'soft' : 'outline'" :color="library.category === c.key ? 'primary' : 'neutral'" :aria-pressed="library.category === c.key" @click="pickCategory(c.key)">
          {{ c.label }} <span class="num opacity-60">{{ c.n }}</span>
        </UButton>
      </div>

      <div v-if="library.mode === 'placement'" class="flex flex-wrap gap-1.5" role="group" aria-label="Filter by region">
        <UButton size="xs" class="rounded-full" :variant="!library.lobe ? 'soft' : 'outline'" :color="!library.lobe ? 'primary' : 'neutral'" :aria-pressed="!library.lobe" @click="library.lobe = null">All</UButton>
        <UButton v-for="l in LOBES" :key="l" size="xs" class="rounded-full capitalize" :variant="library.lobe === l ? 'soft' : 'outline'" :color="library.lobe === l ? 'primary' : 'neutral'" :aria-pressed="library.lobe === l" @click="library.lobe = library.lobe === l ? null : l">{{ l }}</UButton>
      </div>

      <p v-if="library.mode === 'category' || library.mode === 'placement'" class="flex flex-wrap items-center gap-3 text-sm text-muted">
        <span aria-live="polite">{{ library.mode === 'placement'
          ? `${shownGroups.length} of ${groups.length} placements`
          : ranked ? `${matchCount} match${matchCount === 1 ? '' : 'es'}, best first` : `${matchCount} of ${all.length} programs` }}</span>
        <UButton v-if="anyFilter" size="xs" variant="ghost" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
      </p>
    </header>

    <!-- by category: cards; a search shows one list, best match first -->
    <template v-if="library.mode === 'category'">
      <UEmpty v-if="!matchCount" icon="i-lucide-search-x" title="No program matches"
        :description="`Nothing fits${library.query.trim() ? ' this search' : ''}${library.evidence ? ` with evidence “${evidenceLabel(library.evidence)}”` : ''}${library.category ? ' in this category' : ''}.`"
        :actions="[{ label: 'Clear filters', onClick: clearFilters }]" />
      <div v-else-if="ranked" class="cards">
        <ProgramCard v-for="p in ranked" :key="p.doc.id" :p="p" :current="p.doc.id === program.id" show-category />
      </div>
      <template v-else>
        <section v-for="g in sections" :key="g.key" class="grid gap-3" :aria-label="g.label">
          <div class="flex items-end justify-between gap-3 border-b border-default pb-2">
            <h2 class="flex items-center gap-3 text-xl">
              <ArtMark v-if="programMark(g.key)" :name="programMark(g.key)!" class="w-10 shrink-0 text-toned" />
              <span>{{ g.label }} <span class="num font-sans text-sm font-normal text-muted">{{ g.items.length }}</span></span>
            </h2>
            <UButton v-if="g.items.length > FIRST && !library.category" size="xs" variant="link" color="primary" :aria-expanded="!!more[g.key]" @click="more[g.key] = !more[g.key]">
              {{ more[g.key] ? 'Show fewer' : `Show all ${g.items.length}` }}
            </UButton>
          </div>
          <div class="cards">
            <ProgramCard v-for="p in g.shown" :key="p.doc.id" :p="p" :current="p.doc.id === program.id" />
          </div>
        </section>
      </template>
    </template>

    <!-- by placement: programs that put the coils on the same sites -->
    <ProgramLibraryPlacement v-else-if="library.mode === 'placement'" :groups="shownGroups" />
    <!-- by site: what lies under each scalp site, and the programs with a coil there -->
    <ProgramLibrarySite v-else-if="library.mode === 'site'" />
    <!-- by experience: which brain region, and the program for it -->
    <ProgramLibraryExperience v-else />
  </div>
</template>

<style scoped>
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(17.5rem, 1fr)); gap: 0.75rem; }
</style>
