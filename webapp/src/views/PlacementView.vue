<script setup>
// Placement tab: choose a program (or a placement), see the coils on a head
// map from three sides, and tick each coil off with tape-measure directions
// for the user's head. Below: head measurements, every placement in use, a
// site explorer and coil preparation.
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { LAYOUTS, STATE_MAP } from '../lib/layouts.js'
import { presetById, presets, CATEGORY_LABELS } from '../lib/presets.js'
import { loadRegions, sessionSites, SITES, siteName } from '../lib/brain.js'
import { placementGroups, placementKind } from '../lib/placements.js'
import { placementState } from '../lib/placementState.js'
import { recipeFor, headInUse } from '../lib/head.js'
import { nav, go } from '../lib/nav.js'
import SiteMap from '../components/SiteMap.vue'
import PlacementPicker from '../components/placement/PlacementPicker.vue'
import CoilChecklist from '../components/placement/CoilChecklist.vue'
import HeadMeasure from '../components/placement/HeadMeasure.vue'
import SiteExplorer from '../components/placement/SiteExplorer.vue'

const groups = placementGroups(presets, sessionSites)
const groupOf = (p) => groups.find((g) => g.programs.includes(p))
const DEFAULT_ID = 'god-helmet-classic'

// ---------------------------------------------------------------- selection
const LAST_KEY = 'placement-program'
const lastId = () => {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}
const program = shallowRef(null)
const group = shallowRef(null)
function selectProgram(p, sync = true) {
  if (!p?.session) return
  program.value = p
  group.value = groupOf(p)
  try {
    localStorage.setItem(LAST_KEY, p.doc.id)
  } catch { /* private mode */ }
  if (sync && nav.arg !== p.doc.id) go('placement', p.doc.id)
}
// An unknown id in the link: say so, and show the last or default program instead.
const missingId = ref(nav.arg && !presetById(nav.arg)?.session ? nav.arg : '')
selectProgram([presetById(nav.arg), presetById(lastId()), presetById(DEFAULT_ID), groups[0].programs[0]].find((p) => p?.session), false)
if (missingId.value) history.replaceState(null, '', `#placement/${encodeURIComponent(program.value.doc.id)}`)
watch(() => nav.arg, (id) => {
  const p = presetById(id)
  if (p && p !== program.value) selectProgram(p, false)
})
function pick({ group: g, program: p }) {
  missingId.value = ''
  selectProgram(p ?? (program.value && g.programs.includes(program.value) ? program.value : g.featured))
}

// ---------------------------------------------------------------- views and ticks
const VIEWS = [{ key: 'top', label: 'From above' }, { key: 'left', label: 'Left side' }, { key: 'right', label: 'Right side' }]
const sideOf = (n) => (SITES[n]?.[0] < -12 ? 'left' : SITES[n]?.[0] > 12 ? 'right' : 'mid')
function bestView(g) {
  const sides = new Set(g.sites.filter(Boolean).map((s) => sideOf(siteName(s))))
  return sides.size === 1 && !sides.has('mid') ? [...sides][0] : 'top'
}
// The view and the ticks survive a detour to another tab (module state), but
// not a reload: every session needs a fresh check.
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
const placedCount = computed(() => used.value.filter((i) => ticks.value[i]).length)
const bandSummary = computed(() => {
  const n = { on: 0, above: 0, below: 0 }
  for (const s of group.value.sites.filter(Boolean)) n[recipeFor(siteName(s))?.band ?? 'on']++
  return [n.on && `${n.on} on the band`, n.above && `${n.above} above the band`, n.below && `${n.below} below the band`].filter(Boolean).join(' · ')
})

async function jumpToCoil(ch) {
  const el = document.getElementById(`coil-row-${ch}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el?.querySelector('input')?.focus({ preventScroll: true })
}

// ---------------------------------------------------------------- data
const data = shallowRef(null)
loadRegions().then((d) => (data.value = d))
const charted = computed(() => Object.fromEntries((data.value?.regions ?? []).filter((r) => r.kind === 'site').map((r) => [r.site, r])))
const layoutChannels = computed(() => (group.value.layout === 'A' ? LAYOUTS.ring.channels : group.value.layout === 'B' ? LAYOUTS.temporal.channels : null))

// ---------------------------------------------------------------- page sections
const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
const narrow = () => matchMedia('(max-width: 820px)').matches
const site = ref('T8')
const explorer = ref(null)
function openSite(n) {
  site.value = n
  // on phones go straight to the site card, which sits under the map
  nextTick(() => (narrow() ? explorer.value?.show() : scrollTo('pl-sites')))
}
// Deep links on phones open on the set-up card (the hero fills the first screen).
onMounted(() => {
  if (nav.arg && matchMedia('(max-width: 760px)').matches) document.getElementById('pl-setup')?.scrollIntoView({ block: 'start' })
})
const headDone = computed(() => !headInUse().defaulted.length)
const headLine = computed(() => {
  const h = headInUse()
  return `${h.nasionInion} / ${h.earEar} / ${h.circumference} cm`
})
function fromExplorer(p) {
  selectProgram(p)
  nextTick(() => scrollTo('pl-setup'))
}

// All placements gallery.
const galleryQuery = ref('')
const LOBES = ['temporal', 'frontal', 'central', 'parietal', 'occipital', 'inion']
const lobe = ref(null)
const showAllGroups = ref(false)
const shownGroups = computed(() => {
  const q = galleryQuery.value.trim().toLowerCase()
  const list = groups.filter((g) => (!lobe.value || g.lobes.includes(lobe.value)) && (!q || `${g.name} ${g.sites.filter(Boolean).join(' ')} ${g.programs.map((p) => p.doc.name).join(' ')}`.toLowerCase().includes(q)))
  return list
})
const visibleGroups = computed(() => (showAllGroups.value || galleryQuery.value || lobe.value ? shownGroups.value : shownGroups.value.slice(0, 12)))
function chooseGroup(g) {
  pick({ group: g, program: null })
  nextTick(() => scrollTo('pl-setup'))
}

const showAllPrograms = ref(false)
watch(group, () => (showAllPrograms.value = false))
// Collapsed list: the first 8, with the selected program always in it.
const groupPrograms = computed(() => {
  const all = group.value.programs
  if (showAllPrograms.value || all.length <= 8) return all
  return all.indexOf(program.value) < 8 ? all.slice(0, 8) : [...all.slice(0, 7), program.value]
})
const sitesLine = (g) => g.sites.map((s, i) => (s ? `${i + 1} ${s}` : null)).filter(Boolean).join(' · ')

const SECTIONS = [
  { id: 'pl-setup', label: 'Set up' },
  { id: 'pl-measure', label: 'Measure your head' },
  { id: 'pl-all', label: 'All placements' },
  { id: 'pl-sites', label: 'Site explorer' },
  { id: 'pl-prep', label: 'Coil preparation' },
]
</script>

<template>
  <div class="page">
    <header class="card hero">
      <div class="hero-text">
        <span class="eyebrow">Coil placement</span>
        <h2>Put every coil on its site</h2>
        <p>Each program puts the eight coils on standard EEG sites (the 10-10 and 10-5 systems). Choose the program, find each site with a soft tape measure, and tick the coils off as you go.</p>
      </div>
      <ol class="steps">
        <li>
          <button type="button" @click="scrollTo('pl-measure')">
            <span class="step-n" :class="{ done: headDone }">1</span>
            <span class="step-t"><b>Measure your head</b><span class="small muted">{{ headDone ? headLine : 'Three tape measurements, saved on this device' }}</span></span>
          </button>
        </li>
        <li>
          <button type="button" @click="scrollTo('pl-setup')">
            <span class="step-n">2</span>
            <span class="step-t"><b>Choose the program</b><span class="small muted">{{ program.doc.name }}</span></span>
          </button>
        </li>
        <li>
          <button type="button" @click="scrollTo('pl-setup')">
            <span class="step-n" :class="{ done: placedCount === used.length }">3</span>
            <span class="step-t"><b>Place and tick each coil</b><span class="small muted">{{ placedCount }} of {{ used.length }} placed</span></span>
          </button>
        </li>
      </ol>
      <nav class="jump" aria-label="On this page">
        <button v-for="s in SECTIONS" :key="s.id" type="button" class="chip" @click="scrollTo(s.id)">{{ s.label }}</button>
      </nav>
    </header>

    <section id="pl-setup" class="card setup">
      <p v-if="missingId" class="small warn" role="status">No program called “{{ missingId }}”. Showing {{ program.doc.name }}.</p>
      <PlacementPicker :groups="groups" :program="program" :group="group" @pick="pick" />
      <div class="title-row">
        <div class="title">
          <span class="eyebrow">{{ placementKind(group) }} · {{ group.programs.length }} program{{ group.programs.length === 1 ? '' : 's' }}</span>
          <h2>{{ group.name }}</h2>
          <p class="small muted">{{ group.basis }}</p>
        </div>
        <div class="facts">
          <span class="chip">{{ used.length }} coil{{ used.length === 1 ? '' : 's' }}</span>
          <span class="chip blue">{{ bandSummary }}</span>
        </div>
      </div>

      <div class="setup-grid">
        <div class="map-col">
          <div class="seg" role="group" aria-label="Map view">
            <button v-for="v in VIEWS" :key="v.key" type="button" :aria-pressed="view === v.key" :class="{ on: view === v.key }" @click="view = v.key">{{ v.label }}</button>
          </div>
          <SiteMap :sites="group.sites" :view="view" :checked="ticks" :focus="focusCh" coil-buttons @coil="jumpToCoil" />
          <div class="row actions">
            <button type="button" class="btn sm" @click="go('brain', program.doc.id)">Field on the brain</button>
            <button type="button" class="btn ghost sm" @click="go('programs', program.doc.id)">Program details</button>
          </div>
        </div>
        <CoilChecklist :sites="group.sites" :ticks="ticks" :regions="charted" :layout-channels="layoutChannels" :focus="focusCh"
          @toggle="toggle" @focus="focusCh = $event" @site="openSite" @reset="reset" @measure="scrollTo('pl-measure')" />
      </div>

      <div class="programs">
        <h3>Programs with this placement <span class="muted">({{ group.programs.length }})</span></h3>
        <div class="prog-grid">
          <button v-for="p in groupPrograms" :key="p.doc.id" type="button" class="prog" :class="{ on: p === program }" :aria-pressed="p === program" @click="selectProgram(p)">
            <span class="prog-name">{{ p.doc.name }}</span>
            <span class="muted small">{{ CATEGORY_LABELS[p.doc.category] ?? p.doc.category }}</span>
          </button>
        </div>
        <button v-if="group.programs.length > 8" type="button" class="linkbtn small" @click="showAllPrograms = !showAllPrograms">{{ showAllPrograms ? 'Show fewer' : `Show all ${group.programs.length}` }}</button>
        <p class="small muted">The coil sites are the same for all of them; the programs differ in signal, timing and which coils run when.</p>
      </div>
    </section>

    <section id="pl-measure" class="card">
      <div class="sec-head">
        <span class="eyebrow">Step 1</span>
        <h2>Measure your head</h2>
        <p class="muted">Three tape measurements turn the 10-10 rules into centimetres for your head. Mark the nasion, the inion and both ear points first; use the same ear point every time, since it moves the temporal sites most.</p>
      </div>
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
    </section>

    <section id="pl-all" class="card">
      <div class="sec-head row-between">
        <div>
          <span class="eyebrow">{{ groups.length }} placements · {{ presets.length }} programs</span>
          <h2>All placements</h2>
        </div>
        <input v-model="galleryQuery" type="search" class="search" placeholder="Filter by name, site or program" aria-label="Filter placements" />
      </div>
      <div class="row lobes" role="group" aria-label="Filter by region">
        <button type="button" class="chip pick" :class="{ on: !lobe }" :aria-pressed="!lobe" @click="lobe = null">All</button>
        <button v-for="l in LOBES" :key="l" type="button" class="chip pick" :class="{ on: lobe === l }" :aria-pressed="lobe === l" @click="lobe = lobe === l ? null : l">{{ l }}</button>
      </div>
      <div class="gallery">
        <button v-for="g in visibleGroups" :key="g.key" type="button" class="g-card" :class="{ on: g === group }" :aria-pressed="g === group" @click="chooseGroup(g)">
          <SiteMap class="thumb" :sites="g.sites" :view="bestView(g)" compact />
          <span class="g-text">
            <span class="g-kind">{{ g.layout ? `Layout ${g.layout}` : `${g.coils} coil${g.coils === 1 ? '' : 's'}` }} · {{ g.programs.length }} program{{ g.programs.length === 1 ? '' : 's' }}</span>
            <span class="g-name">{{ g.name }}</span>
            <span class="g-sites num">{{ sitesLine(g) }}</span>
          </span>
        </button>
      </div>
      <p v-if="!shownGroups.length" class="small muted">No placement matches.</p>
      <button v-if="!galleryQuery && !lobe && shownGroups.length > 12" type="button" class="btn ghost sm show-all" @click="showAllGroups = !showAllGroups">{{ showAllGroups ? 'Show the 12 most used' : `Show all ${shownGroups.length} placements` }}</button>
    </section>

    <section id="pl-sites" class="card">
      <div class="sec-head">
        <span class="eyebrow">Reference</span>
        <h2>Site explorer</h2>
        <p class="muted">Tap any site to see how to find it, what lies under it, what stimulating that area did, and which programs use it.</p>
      </div>
      <SiteExplorer ref="explorer" v-model:site="site" :data="data" :groups="groups" @program="fromExplorer" />
      <details v-if="Object.keys(charted).length" class="ref">
        <summary>All {{ Object.keys(charted).length }} charted sites as a table</summary>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Site</th><th>Scalp → brain</th><th>Underneath (MRI studies)</th><th>Function (mainstream)</th></tr></thead>
            <tbody>
              <tr v-for="r in Object.values(charted)" :key="r.id" class="clickable" @click="openSite(r.site)">
                <td class="num"><button type="button" class="linkbtn cell-btn" @click.stop="openSite(r.site)">{{ r.site }}</button></td>
                <td class="num">{{ r.depthMm.toFixed(1) }} mm</td>
                <td class="small">{{ r.anatomy.split(' | ')[0] }}</td>
                <td class="small muted">{{ r.function }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted small">Template values (MNI); real heads differ by 5–10 mm. Sources: Koessler 2009, Jurcak/Dan lab 10/5 projections, Scrivener &amp; Reader 2022.</p>
      </details>
      <details class="ref">
        <summary>Which brain region for which experience</summary>
        <p class="muted small">"Claim" = Persinger lab or Todd Murphy. Every mainstream induction of out-of-body or presence experiences used milliamp currents through electrodes on the brain, not µT fields from outside the skull. The fields reach the cortex at about 1–5 µT and deep structures at 10–20× less.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Experience</th><th>Brain region</th><th>Program</th></tr></thead>
            <tbody>
              <tr v-for="row in STATE_MAP" :key="row.preset" class="clickable" @click="fromExplorer(presetById(row.preset))">
                <td><b>{{ row.state }}</b></td><td class="muted">{{ row.region }}</td><td><button type="button" class="linkbtn cell-btn" @click.stop="fromExplorer(presetById(row.preset))">{{ presetById(row.preset)?.doc.name }}</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </section>

    <section id="pl-prep" class="card">
      <div class="sec-head">
        <span class="eyebrow">Before the first session</span>
        <h2>Preparing and mounting the coils</h2>
      </div>
      <div class="prep-grid">
        <div class="prep-card"><b>Leads</b><p class="small">Scrape the enamel off the last 5 mm of both leads; the meter should read about 4.2 Ω. The inner lead leaves the top face next to the core: mark it, it is the signal lead.</p></div>
        <div class="prep-card"><b>Mount</b><p class="small">Nylon M3 screw into the core through a Velcro-backed clip (hardware/coil_clip.scad). Steel screws change the core.</p></div>
        <div class="prep-card"><b>Orientation</b><p class="small">Coil axis toward the centre of the head, clean face (no leads) on the scalp. Hair, a cap or a thick band add distance: about 12 % less field per extra mm.</p></div>
        <div class="prep-card"><b>Polarity</b><p class="small">Setup → DC test with a compass in front of each coil. Mount every coil with the same pole toward the head; programs that need a reversed coil do it in software.</p></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero { gap: 16px; }
.hero-text { display: grid; gap: 6px; max-width: 72ch; }
.hero h2 { font-size: 30px; }
.steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.steps button { width: 100%; height: 100%; display: flex; gap: 12px; align-items: center; text-align: left; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); color: var(--text); cursor: pointer; }
.steps button:hover { border-color: var(--accent); }
.step-n { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font: 700 16px var(--font-display); background: var(--accent); color: var(--accent-ink); }
.step-n.done { background: var(--ok); }
.step-t { display: grid; gap: 1px; min-width: 0; }
.step-t .small { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.jump { display: flex; flex-wrap: wrap; gap: 6px; }
.jump .chip { cursor: pointer; background: none; min-height: 30px; }
.jump .chip:hover { border-color: var(--accent); color: var(--text); }

.setup { gap: 16px; scroll-margin-top: 110px; }
.title-row { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
.title { display: grid; gap: 4px; max-width: 70ch; min-width: 0; }
.facts { display: flex; gap: 6px; flex-wrap: wrap; }
.setup-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 22px; align-items: start; }
.map-col { display: grid; gap: 10px; position: sticky; top: 112px; min-width: 0; }
.actions { gap: 8px; }
.programs { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 14px; }
.prog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 6px; }
.prog { display: grid; gap: 2px; text-align: left; background: none; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; color: var(--text); cursor: pointer; min-width: 0; }
.prog:hover { border-color: var(--accent); }
.prog.on { border-color: var(--accent); background: var(--accent-soft); }
.prog-name { font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; }

section.card { scroll-margin-top: 110px; grid-template-columns: minmax(0, 1fr); }
.cell-btn { text-align: left; font-weight: 600; }
.sec-head { display: grid; gap: 4px; }
.sec-head p { max-width: 75ch; }
.row-between { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.search { flex: 0 1 300px; min-width: 0; width: 100%; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 9px 10px; color: var(--text); }
.steps-detail summary, .ref summary { cursor: pointer; font-weight: 600; }
.steps-detail[open] summary, .ref[open] summary { margin-bottom: 10px; }
.prep { margin: 0; padding-left: 20px; display: grid; gap: 6px; }

.lobes { gap: 6px; }
.chip.pick { cursor: pointer; background: none; text-transform: capitalize; min-height: 30px; }
.chip.pick:hover { border-color: var(--accent); color: var(--text); }
.chip.pick.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 10px; }
.g-card { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px; align-items: center; text-align: left; padding: 8px 12px 8px 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); color: var(--text); cursor: pointer; min-width: 0; }
.g-card:hover { border-color: var(--accent); }
.g-card.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
.thumb { width: 96px; }
.g-text { display: grid; gap: 2px; min-width: 0; }
.g-kind { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.g-name { font-weight: 600; font-size: 14.5px; line-height: 1.3; overflow-wrap: anywhere; }
.g-sites { font-size: 12.5px; color: var(--muted); overflow-wrap: anywhere; line-height: 1.35; }
.show-all { justify-self: start; }

.prep-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 10px; }
.prep-card { display: grid; gap: 4px; align-content: start; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); }
.prep-card p { line-height: 1.45; }

@media (max-width: 900px) {
  .setup-grid { grid-template-columns: 1fr; }
  .map-col { position: static; max-width: 460px; justify-self: center; width: 100%; }
}
@media (max-width: 640px) {
  .steps { grid-template-columns: 1fr; gap: 6px; }
  .steps button { padding: 8px 12px; }
  .step-n { width: 28px; height: 28px; font-size: 14px; }
  .jump { display: none; }
  .hero h2 { font-size: 26px; }
}
</style>
