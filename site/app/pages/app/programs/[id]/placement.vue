<script setup lang="ts">
// Placement of a program's coils: the head map from three sides and one row per
// coil to tick off, with tape-measure directions for the user's head. Below:
// head measuring, the other programs with the same placement, coil preparation.
import { useMediaQuery } from '@vueuse/core'
import { fmtMinutes } from '#core/lib/format.js'
import { program, library, groupOf, usedCoils, categoryLabel, LAYOUTS } from '~/lib/programs'
import { placementState, placementKind, placementName, bestView, describeSite, recipeFor, siteName, headInUse, revealOpenGroup, type MapView } from '~/lib/placement'

// The page is only shown for a program that parses, so it has a placement.
const group = computed(() => groupOf(program.id)!)

// ---------------------------------------------------------------- map view and ticks
const VIEWS = [{ value: 'top', label: 'From above' }, { value: 'left', label: 'Left side' }, { value: 'right', label: 'Right side' }]
// The view and the ticks survive a detour to another page, not a reload: every
// session needs a fresh check.
const view = ref<MapView>(placementState.view?.key === group.value.key ? placementState.view.view : bestView(group.value))
watch(group, (g) => (view.value = bestView(g)))
watch(view, (v) => (placementState.view = { key: group.value.key, view: v }))
const placed = placementState.placed
watch(group, (g) => (placed[g.key] ??= new Array(8).fill(false)), { immediate: true })
const ticks = computed(() => placed[group.value.key] ?? [])
const toggle = (ch: number) => (ticks.value[ch] = !ticks.value[ch])
const reset = () => ticks.value.fill(false)
const focusCh = ref<number | null>(null)
const used = computed(() => usedCoils(group.value))
const bandSummary = computed(() => {
  const n = { on: 0, above: 0, below: 0 }
  for (const s of group.value.sites.filter(Boolean)) n[recipeFor(siteName(s))?.band ?? 'on']++
  return [n.on && `${n.on} on the band`, n.above && `${n.above} above it`, n.below && `${n.below} below it`].filter(Boolean).join(', ')
})
const checklist = ref<{ show: (ch: number) => void, $el: HTMLElement }>()

// ---------------------------------------------------------------- what lies under the sites
const layoutChannels = computed(() => (group.value.layout === 'A' ? LAYOUTS.ring.channels : group.value.layout === 'B' ? LAYOUTS.temporal.channels : null))

// ---------------------------------------------------------------- site card in a side sheet
const sheetOpen = ref(false)
const sheetSite = ref('')
function openSite(n: string) {
  sheetSite.value = n
  sheetOpen.value = true
}
// From the side on a wide screen, from below on a phone.
const phone = useMediaQuery('(max-width: 640px)')

// ---------------------------------------------------------------- folds
const measureFold = ref<{ show: () => void }>()
const head = computed(() => headInUse())
const headDone = computed(() => !head.value.defaulted.length)
const headCm = computed(() => `${head.value.nasionInion} / ${head.value.earEar} / ${head.value.circumference} cm`)
const openMeasure = () => measureFold.value?.show()
// Arriving from the Start panel's "Measure" or "Place the coils".
function honourFocus() {
  const focus = program.focus
  program.focus = ''
  if (focus === 'measure') openMeasure()
  else if (focus === 'place') checklist.value?.$el.scrollIntoView({ block: 'start' })
}
// Two things can move the window first, and this has to come after both. The
// router, where it scrolls a new page to its top, does so one frame after the
// page has loaded. And the Start panel, as it closes, gives the keyboard back
// to its Start button, which scrolls the window up to that button.
let frame = 0
function afterStartPanel(then: () => void, giveUp = performance.now() + 1500) {
  frame = requestAnimationFrame(() => (document.querySelector('[role="dialog"]') && performance.now() < giveUp ? afterStartPanel(then, giveUp) : then()))
}
const nuxtApp = useNuxtApp()
let offLoaded = () => {}
onMounted(() => {
  if (!program.focus) return
  offLoaded = nuxtApp.hooks.hookOnce('page:loading:end', () => {
    frame = requestAnimationFrame(() => afterStartPanel(honourFocus))
  })
})
// The Start panel was opened on this page: no page loads.
watch(() => program.focus, (f) => f && afterStartPanel(honourFocus))
onBeforeUnmount(() => {
  offLoaded()
  cancelAnimationFrame(frame)
  // A request that was not answered here must not jump the page on a later visit.
  program.focus = ''
})

const showAllPrograms = ref(false)
watch(group, () => (showAllPrograms.value = false))
// Collapsed list: the first 8, with this program always in it.
const groupPrograms = computed(() => {
  const all = group.value.programs
  if (showAllPrograms.value || all.length <= 8) return all
  const i = all.findIndex((p) => p.doc.id === program.id)
  return i < 8 ? all.slice(0, 8) : [...all.slice(0, 7), all[i]!]
})
function browseInLibrary() {
  library.mode = 'placement'
  library.group = group.value.key
  library.query = ''
  library.lobe = null
  library.allGroups = true
  revealOpenGroup.value = true
  navigateTo('/app/programs')
}
</script>

<template>
  <div class="grid gap-5">
    <section class="panel grid gap-4 p-5 sm:p-7">
      <div class="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div class="grid min-w-0 max-w-[70ch] gap-1">
          <p class="text-sm font-semibold text-muted">{{ placementKind(group) }}<template v-if="group.programs.length > 1">, used by {{ group.programs.length }} programs</template></p>
          <h2 class="text-2xl">{{ placementName(group) }}</h2>
          <p class="text-sm text-muted">{{ group.basis }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <UBadge variant="outline" color="neutral" class="rounded-full">{{ used.length }} coil{{ used.length === 1 ? '' : 's' }}</UBadge>
          <UBadge variant="outline" color="info" class="rounded-full">{{ bandSummary }}</UBadge>
          <UButton size="xs" variant="outline" :color="headDone ? 'success' : 'warning'" class="rounded-full" @click="openMeasure">
            {{ headDone ? `Your head: ${headCm}` : 'Typical head: measure yours' }}
          </UButton>
        </div>
      </div>
      <p class="max-w-[80ch] text-sm text-muted">Each coil goes on a standard EEG site (the 10-10 and 10-5 systems). Find each site with a soft tape measure and tick the coil off when it sits there. Tap a site name to see what lies under it.</p>

      <div class="setup">
        <div class="map-col">
          <UTabs v-model="view" :items="VIEWS" :content="false" size="sm" class="w-fit max-w-full" role="group" aria-label="Map view" />
          <SiteMap :sites="group.sites" :view="view" :checked="ticks" :focus="focusCh ?? undefined" coil-buttons @coil="(ch: number) => checklist?.show(ch)" />
        </div>
        <PlacementCoilChecklist ref="checklist" class="scroll-mt-14" :sites="group.sites" :ticks="ticks" :layout-channels="layoutChannels" :focus="focusCh"
          @toggle="toggle" @focus="focusCh = $event" @site="openSite" @reset="reset" @measure="openMeasure" />
      </div>
    </section>

    <PlacementFold ref="measureFold" title="Measure your head" :hint="headDone ? `${headCm}, saved on this device` : 'Three tape measurements, saved on this device'">
      <p class="measure text-sm text-muted">Three tape measurements turn the 10-10 rules into centimetres for your head. Mark the nasion, the inion and both ear points first; use the same ear point every time, since it moves the temporal sites most.</p>
      <PlacementHeadMeasure />
      <details class="text-sm">
        <summary class="cursor-pointer py-1 font-semibold text-highlighted">Mark the whole 10-10 grid, step by step</summary>
        <ol class="mt-2 grid max-w-[85ch] list-decimal gap-1.5 pl-5">
          <li>Mark the <b>nasion</b> (dent at the top of the nose bridge), the <b>inion</b> (bump at the back of the skull) and both <b>ear points</b> (front root of the tragus).</li>
          <li><b>Cz</b> is halfway from nasion to inion over the top of the head, and also halfway between the two ear points. Adjust until both hold.</li>
          <li>Front to back through Cz, in 10 % steps of nasion–inion: Fpz, AFz, Fz, FCz, Cz, CPz, Pz, POz, Oz.</li>
          <li>Ear to ear through Cz, in 10 % steps: T7, C5, C3, C1, Cz, C2, C4, C6, T8.</li>
          <li>Round the head on the band line through Fpz, T7 and Oz: fifths of Fpz–T7 give Fp1, AF7, F7, FT7; fifths of T7–Oz give TP7, P7, PO7, O1 (each fifth is about 5 % of the band). Same on the right.</li>
          <li>Rows between: along F7–Fz–F8, FT7–FCz–FT8, TP7–CPz–TP8 and P7–Pz–P8, divide each half in quarters (F5, F3, F1 …). The AF and PO rows are only halved (AF3, PO3).</li>
          <li>The low line runs nasion – ear point (= T9) – inion, about 10 % of ear-to-ear below the band. Fifths of nasion–T9 give AF9, F9, FT9; fifths of T9–inion give TP9, P9, PO9.</li>
          <li>10-5 sites (FFT7, T9h, FC5h …) lie halfway between neighbouring 10-10 sites.</li>
        </ol>
        <p class="mt-2 text-muted">After Jurcak, Tsuzuki &amp; Dan 2007 (UI 10/10) and Oostenveld &amp; Praamstra 2001 (10-5 names). Full method and sources: <NuxtLink to="/docs/placement" class="text-primary underline underline-offset-4">Coil placement, in the docs</NuxtLink>.</p>
      </details>
      <p class="max-w-[85ch] text-sm text-muted">Measuring by hand varies by about 5–10 mm (Xiao 2017; Atcherson 2007), roughly the radius of the field spot a coil makes on the cortex. Mark the sites on the band once, and check them against the landmarks every session.</p>
    </PlacementFold>

    <PlacementFold v-if="group.programs.length > 1" title="Programs with this placement" :count="group.programs.length" hint="Same coil sites: change program without moving a coil">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-1.5">
        <NuxtLink v-for="p in groupPrograms" :key="p.doc.id" :to="programPath(p.doc.id, 'placement')" class="prog" :aria-current="p.doc.id === program.id ? 'true' : undefined">
          <span class="text-sm font-semibold text-highlighted [overflow-wrap:anywhere]">{{ p.doc.name }}</span>
          <span class="text-sm text-muted">{{ categoryLabel(p.doc.category) }}, {{ fmtMinutes(p.session!.totalMs) }}</span>
        </NuxtLink>
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <UButton v-if="group.programs.length > 8" variant="link" color="primary" size="sm" class="px-0" :aria-expanded="showAllPrograms" @click="showAllPrograms = !showAllPrograms">{{ showAllPrograms ? 'Show fewer' : `Show all ${group.programs.length}` }}</UButton>
        <UButton variant="link" color="primary" size="sm" class="px-0" @click="browseInLibrary">Show this placement in the library</UButton>
      </div>
      <p class="text-sm text-muted">The coil sites are the same for all of them; the programs differ in signal, timing and which coils run when.</p>
    </PlacementFold>

    <PlacementFold title="Preparing and mounting the coils" hint="Before the first session">
      <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13.75rem),1fr))] gap-3">
        <div class="prep"><b>Leads</b><p>Scrape the enamel off the last 5 mm of both leads; the meter should read about 4.2 Ω. The inner lead leaves the top face next to the core: mark it, it is the signal lead.</p></div>
        <div class="prep"><b>Mount</b><p>Nylon M3 screw into the core through a Velcro-backed clip (hardware/coil_clip.scad). Steel screws change the core.</p></div>
        <div class="prep"><b>Orientation</b><p>Coil axis toward the centre of the head, clean face (no leads) on the scalp. Hair, a cap or a thick band add distance: about 12 % less field per extra mm.</p></div>
        <div class="prep"><b>Polarity</b><p>Helmet → Calibration: a DC test with a compass in front of each coil. Mount every coil with the same pole toward the head; programs that need a reversed coil do it in software.</p></div>
      </div>
    </PlacementFold>

    <USlideover v-model:open="sheetOpen" :side="phone ? 'bottom' : 'right'" :title="sheetSite" :description="describeSite(sheetSite)"
      :ui="{ content: phone ? 'max-h-[88dvh] rounded-t-xl' : 'sm:max-w-lg', title: 'num font-display text-4xl leading-none font-[620]', description: 'mt-1.5' }">
      <template #body>
        <PlacementSiteCard v-if="sheetSite" :site="sheetSite" :heading="false" sub="placement" @site="sheetSite = $event" @program="sheetOpen = false" />
      </template>
    </USlideover>
  </div>
</template>

<style scoped>
.setup { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 1.5rem; align-items: start; }
/* The map stays in view next to a long coil list, under the header and the program's slim bar. */
.map-col { display: grid; gap: 0.65rem; position: sticky; top: calc(var(--header-h, 4rem) + 4rem); min-width: 0; }
.prog { display: grid; gap: 0.125rem; padding: 0.5rem 0.65rem; border: 1px solid var(--ui-border); border-radius: calc(var(--ui-radius) * 1.5); min-width: 0; transition: border-color 0.15s; }
.prog:hover { border-color: var(--ui-border-accented); }
.prog[aria-current] { border-color: var(--ui-primary); background: var(--accent-soft); }
.prep { display: grid; gap: 0.25rem; align-content: start; padding: 0.75rem 0.875rem; border: 1px solid var(--ui-border); border-radius: calc(var(--ui-radius) * 2); background: var(--ui-bg-muted); }
.prep b { color: var(--ui-text-highlighted); }
.prep p { font-size: 0.875rem; line-height: 1.45; }
@media (max-width: 900px) {
  .setup { grid-template-columns: 1fr; }
  .map-col { position: static; max-width: 28.75rem; justify-self: center; width: 100%; }
}
</style>
