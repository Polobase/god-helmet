<script setup>
// Placement of a program's coils: the head map from three sides and one row per
// coil to tick off, with tape-measure directions for the user's head. Below:
// head measuring, the other programs with the same placement, coil preparation.
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { LAYOUTS } from '../../lib/layouts.js'
import { CATEGORY_LABELS } from '../../lib/presets.js'
import { loadRegions, SITES, siteName } from '../../lib/brain.js'
import { placementKind } from '../../lib/placements.js'
import { placementState } from '../../lib/placementState.js'
import { recipeFor, headInUse } from '../../lib/head.js'
import { fmtMinutes } from '../../lib/format.js'
import { routeHash } from '../../lib/routes.js'
import { go } from '../../lib/nav.js'
import { program, groups, groupOf, library } from '../../lib/programState.js'
import SiteMap from '../SiteMap.vue'
import CoilChecklist from '../placement/CoilChecklist.vue'
import HeadMeasure from '../placement/HeadMeasure.vue'
import SiteCard from '../placement/SiteCard.vue'

const group = computed(() => groupOf(program.id))

// ---------------------------------------------------------------- map view and ticks
const VIEWS = [{ key: 'top', label: 'From above' }, { key: 'left', label: 'Left side' }, { key: 'right', label: 'Right side' }]
const sideOf = (n) => (SITES[n]?.[0] < -12 ? 'left' : SITES[n]?.[0] > 12 ? 'right' : 'mid')
function bestView(g) {
  const sides = new Set(g.sites.filter(Boolean).map((s) => sideOf(siteName(s))))
  return sides.size === 1 && !sides.has('mid') ? [...sides][0] : 'top'
}
// The view and the ticks survive a detour to another tab, not a reload: every
// session needs a fresh check.
const view = ref(placementState.view?.key === group.value.key ? placementState.view.view : bestView(group.value))
watch(group, (g) => (view.value = bestView(g)))
watch(view, (v) => (placementState.view = { key: group.value.key, view: v }))
const placed = placementState.placed
watch(group, (g) => (placed[g.key] ??= new Array(8).fill(false)), { immediate: true })
const ticks = computed(() => placed[group.value.key])
const toggle = (ch) => (ticks.value[ch] = !ticks.value[ch])
const reset = () => ticks.value.fill(false)
const focusCh = ref(null)
const used = computed(() => group.value.sites.map((s, i) => (s ? i : null)).filter((i) => i !== null))
const bandSummary = computed(() => {
  const n = { on: 0, above: 0, below: 0 }
  for (const s of group.value.sites.filter(Boolean)) n[recipeFor(siteName(s))?.band ?? 'on']++
  return [n.on && `${n.on} on the band`, n.above && `${n.above} above it`, n.below && `${n.below} below it`].filter(Boolean).join(', ')
})
function jumpToCoil(ch) {
  const el = document.getElementById(`coil-row-${ch}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el?.querySelector('input')?.focus({ preventScroll: true })
}

// ---------------------------------------------------------------- what lies under the sites
const data = shallowRef(null)
loadRegions().then((d) => (data.value = d))
const charted = computed(() => Object.fromEntries((data.value?.regions ?? []).filter((r) => r.kind === 'site').map((r) => [r.site, r])))
const layoutChannels = computed(() => (group.value.layout === 'A' ? LAYOUTS.ring.channels : group.value.layout === 'B' ? LAYOUTS.temporal.channels : null))

// ---------------------------------------------------------------- site card in a side sheet
const sheet = ref(null)
const sheetSite = ref('')
function openSite(n) {
  sheetSite.value = n
  nextTick(() => sheet.value?.showModal())
}
const onSheetClick = (e) => e.target === sheet.value && sheet.value.close()
function openProgram(p) {
  sheet.value?.close()
  go('programs', p.doc.id, 'placement')
}

// ---------------------------------------------------------------- folds
const measureEl = ref(null)
const measureOpen = ref(false)
const head = computed(() => headInUse())
const headDone = computed(() => !head.value.defaulted.length)
function openMeasure() {
  measureOpen.value = true
  nextTick(() => measureEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
// Arriving from the Start panel's "Measure" or "Place the coils".
onMounted(() => {
  if (program.focus === 'measure') openMeasure()
  else if (program.focus === 'place') document.querySelector('.checklist')?.scrollIntoView({ block: 'start' })
  program.focus = ''
})

const showAllPrograms = ref(false)
watch(group, () => (showAllPrograms.value = false))
// Collapsed list: the first 8, with this program always in it.
const groupPrograms = computed(() => {
  const all = group.value.programs
  if (showAllPrograms.value || all.length <= 8) return all
  const i = all.findIndex((p) => p.doc.id === program.id)
  return i < 8 ? all.slice(0, 8) : [...all.slice(0, 7), all[i]]
})
function browseInLibrary() {
  library.mode = 'placement'
  library.group = group.value.key
  library.query = ''
  library.lobe = null
  library.allGroups = true
  go('programs')
}
</script>

<template>
  <div class="placement">
    <section class="card setup">
      <div class="pl-head">
        <div class="pl-title">
          <p class="small muted kind">{{ placementKind(group) }}<template v-if="group.programs.length > 1">, used by {{ group.programs.length }} programs</template></p>
          <h2>{{ group.name }}</h2>
          <p class="small muted basis">{{ group.basis }}</p>
        </div>
        <div class="pl-facts">
          <span class="chip">{{ used.length }} coil{{ used.length === 1 ? '' : 's' }}</span>
          <span class="chip blue">{{ bandSummary }}</span>
          <button type="button" class="chip head-chip" :class="headDone ? 'ok' : 'warn'" @click="openMeasure">
            {{ headDone ? `Your head: ${head.nasionInion} / ${head.earEar} / ${head.circumference} cm` : 'Typical head: measure yours' }}
          </button>
        </div>
      </div>
      <p class="small muted intro">Each coil goes on a standard EEG site (the 10-10 and 10-5 systems). Find each site with a soft tape measure and tick the coil off when it sits there. Tap a site name to see what lies under it.</p>

      <div class="setup-grid">
        <div class="map-col">
          <div class="seg" role="group" aria-label="Map view">
            <button v-for="v in VIEWS" :key="v.key" type="button" :aria-pressed="view === v.key" :class="{ on: view === v.key }" @click="view = v.key">{{ v.label }}</button>
          </div>
          <SiteMap :sites="group.sites" :view="view" :checked="ticks" :focus="focusCh" coil-buttons @coil="jumpToCoil" />
        </div>
        <CoilChecklist :sites="group.sites" :ticks="ticks" :regions="charted" :layout-channels="layoutChannels" :focus="focusCh"
          @toggle="toggle" @focus="focusCh = $event" @site="openSite" @reset="reset" @measure="openMeasure" />
      </div>
    </section>

    <details ref="measureEl" class="card fold" :open="measureOpen" @toggle="measureOpen = $event.target.open">
      <summary>
        <span class="fold-title">Measure your head</span>
        <span class="small muted">{{ headDone ? `${head.nasionInion} / ${head.earEar} / ${head.circumference} cm, saved on this device` : 'Three tape measurements, saved on this device' }}</span>
      </summary>
      <div class="fold-body">
        <p class="muted small">Three tape measurements turn the 10-10 rules into centimetres for your head. Mark the nasion, the inion and both ear points first; use the same ear point every time, since it moves the temporal sites most.</p>
        <HeadMeasure />
        <details class="steps-detail">
          <summary>Mark the whole 10-10 grid, step by step</summary>
          <ol class="small prep">
            <li>Mark the <b>nasion</b> (dent at the top of the nose bridge), the <b>inion</b> (bump at the back of the skull) and both <b>ear points</b> (front root of the tragus).</li>
            <li><b>Cz</b> is halfway from nasion to inion over the top of the head, and also halfway between the two ear points. Adjust until both hold.</li>
            <li>Front to back through Cz, in 10 % steps of nasion–inion: Fpz, AFz, Fz, FCz, Cz, CPz, Pz, POz, Oz.</li>
            <li>Ear to ear through Cz, in 10 % steps: T7, C5, C3, C1, Cz, C2, C4, C6, T8.</li>
            <li>Round the head on the band line through Fpz, T7 and Oz: fifths of Fpz–T7 give Fp1, AF7, F7, FT7; fifths of T7–Oz give TP7, P7, PO7, O1 (each fifth is about 5 % of the band). Same on the right.</li>
            <li>Rows between: along F7–Fz–F8, FT7–FCz–FT8, TP7–CPz–TP8 and P7–Pz–P8, divide each half in quarters (F5, F3, F1 …). The AF and PO rows are only halved (AF3, PO3).</li>
            <li>The low line runs nasion – ear point (= T9) – inion, about 10 % of ear-to-ear below the band. Fifths of nasion–T9 give AF9, F9, FT9; fifths of T9–inion give TP9, P9, PO9.</li>
            <li>10-5 sites (FFT7, T9h, FC5h …) lie halfway between neighbouring 10-10 sites.</li>
          </ol>
          <p class="small muted">After Jurcak, Tsuzuki &amp; Dan 2007 (UI 10/10) and Oostenveld &amp; Praamstra 2001 (10-5 names). Full method and sources: <a href="#docs/placement">Placement notes</a>.</p>
        </details>
        <p class="small muted">Measuring by hand varies by about 5–10 mm (Xiao 2017; Atcherson 2007), roughly the radius of the field spot a coil makes on the cortex. Mark the sites on the band once, and check them against the landmarks every session.</p>
      </div>
    </details>

    <details v-if="group.programs.length > 1" class="card fold">
      <summary>
        <span class="fold-title">Programs with this placement <span class="muted num">{{ group.programs.length }}</span></span>
        <span class="small muted">Same coil sites: change program without moving a coil</span>
      </summary>
      <div class="fold-body">
        <div class="prog-grid">
          <a v-for="p in groupPrograms" :key="p.doc.id" class="prog" :class="{ on: p.doc.id === program.id }" :href="routeHash('programs', p.doc.id, 'placement')" :aria-current="p.doc.id === program.id ? 'true' : null">
            <span class="prog-name">{{ p.doc.name }}</span>
            <span class="muted small">{{ CATEGORY_LABELS[p.doc.category] ?? p.doc.category }}, {{ fmtMinutes(p.session.totalMs) }}</span>
          </a>
        </div>
        <div class="row">
          <button v-if="group.programs.length > 8" type="button" class="linkbtn small" @click="showAllPrograms = !showAllPrograms">{{ showAllPrograms ? 'Show fewer' : `Show all ${group.programs.length}` }}</button>
          <button type="button" class="linkbtn small" @click="browseInLibrary">Show this placement in the library</button>
        </div>
        <p class="small muted">The coil sites are the same for all of them; the programs differ in signal, timing and which coils run when.</p>
      </div>
    </details>

    <details class="card fold">
      <summary>
        <span class="fold-title">Preparing and mounting the coils</span>
        <span class="small muted">Before the first session</span>
      </summary>
      <div class="fold-body prep-grid">
        <div class="prep-card"><b>Leads</b><p class="small">Scrape the enamel off the last 5 mm of both leads; the meter should read about 4.2 Ω. The inner lead leaves the top face next to the core: mark it, it is the signal lead.</p></div>
        <div class="prep-card"><b>Mount</b><p class="small">Nylon M3 screw into the core through a Velcro-backed clip (hardware/coil_clip.scad). Steel screws change the core.</p></div>
        <div class="prep-card"><b>Orientation</b><p class="small">Coil axis toward the centre of the head, clean face (no leads) on the scalp. Hair, a cap or a thick band add distance: about 12 % less field per extra mm.</p></div>
        <div class="prep-card"><b>Polarity</b><p class="small">Helmet → Calibration: a DC test with a compass in front of each coil. Mount every coil with the same pole toward the head; programs that need a reversed coil do it in software.</p></div>
      </div>
    </details>

    <dialog ref="sheet" class="sheet" aria-label="Site" @click="onSheetClick">
      <div class="sheet-body">
        <button type="button" class="btn ghost sm close" aria-label="Close" @click="sheet.close()">✕</button>
        <SiteCard v-if="sheetSite" :site="sheetSite" :data="data" :groups="groups" @site="sheetSite = $event" @program="openProgram" />
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.placement { display: grid; gap: 18px; }
.setup { gap: 14px; }
.pl-head { display: flex; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap; align-items: flex-start; }
.pl-title { display: grid; gap: 4px; max-width: 70ch; min-width: 0; }
.kind { font-weight: 600; }
.pl-facts { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.head-chip { cursor: pointer; background: none; font: inherit; font-size: 12px; }
.head-chip.ok { border-color: var(--ok); color: var(--ok); }
.head-chip.warn { border-color: var(--warn); color: var(--warn); }
.head-chip:hover { color: var(--text); }
.intro { max-width: 80ch; }
.setup-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 24px; align-items: start; }
.map-col { display: grid; gap: 10px; position: sticky; top: calc(var(--header-h, 100px) + 64px); min-width: 0; }

.fold { padding: 0; gap: 0; }
.fold > summary { list-style: none; cursor: pointer; display: grid; gap: 2px; padding: 16px 18px 16px 44px; position: relative; }
.fold > summary::-webkit-details-marker { display: none; }
.fold > summary::before { content: ''; position: absolute; left: 20px; top: 22px; width: 8px; height: 8px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(-45deg); transition: transform .15s; }
.fold[open] > summary::before { transform: rotate(45deg); }
.fold > summary:hover::before { border-color: var(--text); }
.fold-title { font: 600 19px var(--font-display); letter-spacing: .01em; }
.fold-title .num { font-size: 15px; margin-left: 4px; }
.fold-body { display: grid; gap: 12px; padding: 0 18px 18px; }
.steps-detail summary { cursor: pointer; font-weight: 600; }
.steps-detail[open] summary { margin-bottom: 10px; }
.prep { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
.prog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 6px; }
.prog { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 9px; color: var(--text); text-decoration: none; min-width: 0; }
.prog:hover { border-color: color-mix(in srgb, var(--text) 30%, var(--line)); color: var(--text); }
.prog.on { border-color: var(--accent); background: var(--accent-soft); }
.prog-name { font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; }
.prep-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); }
.prep-card { display: grid; gap: 4px; align-content: start; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-2); }
.prep-card p { line-height: 1.45; }

.sheet { border: 1px solid var(--line); border-radius: var(--radius-lg) 0 0 var(--radius-lg); background: var(--surface); color: var(--text); padding: 0; margin: 0 0 0 auto; height: 100dvh; max-height: 100dvh; width: min(520px, 100vw); overflow: auto; overscroll-behavior: contain; }
.sheet::backdrop { background: rgb(0 0 0 / .5); }
.sheet-body { position: relative; padding: 18px; }
.sheet .close { position: absolute; top: 14px; right: 14px; z-index: 1; }
.sheet :deep(.site-card) { border: 0; background: none; padding: 0; }
@media (max-width: 900px) {
  .setup-grid { grid-template-columns: 1fr; }
  .map-col { position: static; max-width: 460px; justify-self: center; width: 100%; }
}
@media (max-width: 640px) {
  .sheet { margin: auto 0 0; height: auto; max-height: 88dvh; width: 100%; max-width: 100%; border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
}
</style>
