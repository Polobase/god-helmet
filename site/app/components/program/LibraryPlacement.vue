<script setup lang="ts">
// Library, by placement: programs that put the coils on the same sites. A
// placement opens to its programs. The page header holds the lobe filter and
// the count.
import { fmtMinutes } from '#core/lib/format.js'
import { library, program, categoryLabel, type PlacementGroup } from '~/lib/programs'
import { bestView, placementName, revealOpenGroup } from '~/lib/placement'

const props = defineProps<{
  /** What the lobe filter and the search leave, most used first. */
  groups: PlacementGroup[]
}>()

const filtering = computed(() => !!(library.query.trim() || library.lobe))
const visible = computed(() => (library.allGroups || filtering.value ? props.groups : props.groups.slice(0, 12)))
const sitesLine = (g: PlacementGroup) => g.sites.flatMap((s, i) => (s ? [`${i + 1} ${s}`] : [])).join(', ')
const toggle = (g: PlacementGroup) => (library.group = library.group === g.key ? null : g.key)

// Sent here by "Show this placement in the library": bring that placement into view.
const gallery = ref<HTMLElement>()
onMounted(() => {
  if (!revealOpenGroup.value) return
  revealOpenGroup.value = false
  requestAnimationFrame(() => gallery.value?.querySelector('[aria-expanded="true"]')?.scrollIntoView({ block: 'center' }))
})
</script>

<template>
  <section class="panel grid gap-4 p-5 sm:p-7">
    <p class="measure text-sm text-muted">Programs with the same placement put the coils on the same sites; they differ in signal, timing and which coils run when. Open a placement to see its programs.</p>
    <div ref="gallery" class="gallery">
      <template v-for="g in visible" :key="g.key">
        <button type="button" class="g-card" :class="{ on: library.group === g.key }" :aria-expanded="library.group === g.key" @click="toggle(g)">
          <SiteMap class="w-24" :sites="g.sites" :view="bestView(g)" compact />
          <span class="grid min-w-0 gap-0.5">
            <span class="text-xs font-semibold text-muted">{{ g.layout ? `Layout ${g.layout}` : `${g.coils} coil${g.coils === 1 ? '' : 's'}` }}, {{ g.programs.length }} program{{ g.programs.length === 1 ? '' : 's' }}</span>
            <span class="text-[0.92rem] leading-snug font-semibold text-highlighted [overflow-wrap:anywhere]">{{ placementName(g) }}</span>
            <span class="num text-[0.8rem] leading-snug text-muted [overflow-wrap:anywhere]">{{ sitesLine(g) }}</span>
          </span>
        </button>
        <div v-if="library.group === g.key" class="g-open">
          <p class="text-sm text-muted">{{ g.basis }}</p>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-1.5">
            <NuxtLink v-for="p in g.programs" :key="p.doc.id" :to="programPath(p.doc.id)" class="prog" :class="{ on: p.doc.id === program.id }">
              <span class="text-sm font-semibold text-highlighted [overflow-wrap:anywhere]">{{ p.doc.name }}</span>
              <span class="text-sm text-muted">{{ categoryLabel(p.doc.category || 'other') }}, {{ fmtMinutes(p.session!.totalMs) }}</span>
            </NuxtLink>
          </div>
        </div>
      </template>
    </div>
    <p v-if="!groups.length" class="text-sm text-muted">No placement matches.</p>
    <UButton v-if="!filtering && groups.length > 12" size="sm" variant="ghost" class="justify-self-start" @click="library.allGroups = !library.allGroups">
      {{ library.allGroups ? 'Show the 12 most used' : `Show all ${groups.length} placements` }}
    </UButton>
  </section>
</template>

<style scoped>
/* Dense: an open placement's programs take the full row under its card, and the cards after it fill the row beside it. */
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 17.5rem), 1fr)); grid-auto-flow: dense; gap: 0.65rem; }
.g-card { display: grid; grid-template-columns: 6rem minmax(0, 1fr); gap: 0.75rem; align-items: center; text-align: left; padding: 0.5rem 0.75rem 0.5rem 0.5rem; border: 1px solid var(--ui-border); border-radius: calc(var(--ui-radius) * 2); background: var(--ui-bg-muted); cursor: pointer; min-width: 0; transition: border-color 0.15s; }
.g-card:hover { border-color: var(--ui-primary); }
.g-card.on { border-color: var(--ui-primary); box-shadow: 0 0 0 1px var(--ui-primary) inset; }
.g-open { grid-column: 1 / -1; display: grid; gap: 0.5rem; padding: 0.75rem; border: 1px solid var(--ui-primary); border-radius: calc(var(--ui-radius) * 2); background: var(--accent-soft); }
.prog { display: grid; gap: 0.125rem; padding: 0.5rem 0.65rem; border: 1px solid var(--ui-border); border-radius: calc(var(--ui-radius) * 1.5); background: var(--ui-bg); min-width: 0; transition: border-color 0.15s; }
.prog:hover, .prog.on { border-color: var(--ui-primary); }
</style>
