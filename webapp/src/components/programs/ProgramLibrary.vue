<script setup>
// Program library (#programs): find a program by category, by placement, by
// scalp site or by the experience it aims at. A card opens the program.
import { computed, nextTick, ref, shallowRef } from 'vue'
import { presets, groupedPresets, presetById, CATEGORY_LABELS } from '../../lib/presets.js'
import { STATE_MAP } from '../../lib/layouts.js'
import { fmtMinutes } from '../../lib/format.js'
import { EVIDENCE_KEYS, evidenceLabel } from '../../lib/evidence.js'
import { queryWords, score, norm } from '../../lib/search.js'
import { loadRegions, SITES, siteName } from '../../lib/brain.js'
import { library, groups, program } from '../../lib/programState.js'
import { routeHash } from '../../lib/routes.js'
import { go } from '../../lib/nav.js'
import LivePanel from '../LivePanel.vue'
import SiteMap from '../SiteMap.vue'
import SiteExplorer from '../placement/SiteExplorer.vue'
import ProgramCard from './ProgramCard.vue'
import { fmtRange } from '../../lib/units.js'

defineProps({ missing: { type: String, default: '' } })

const MODES = [
  { key: 'category', label: 'Category' },
  { key: 'placement', label: 'Placement' },
  { key: 'site', label: 'Site' },
  { key: 'experience', label: 'Experience' },
]
const PLACEHOLDER = {
  category: 'Search programs, sites, brain regions…',
  placement: 'Filter by name, site or program',
  experience: 'Filter experiences, regions or programs',
}
const href = (id) => routeHash('programs', id)
const open = (p) => p && go('programs', p.doc.id)
const words = computed(() => queryWords(library.query))

// ---------------------------------------------------------------- by category
const catKey = (p) => p.doc.category || 'other'
const catLabel = (p) => CATEGORY_LABELS[catKey(p)] ?? catKey(p)
const fieldsOf = (p) => [
  [p.doc.name, 3], [p.doc.id, 3], [catLabel(p), 2], [catKey(p), 2],
  [(p.session?.sites ?? []).filter(Boolean).join(' '), 2], [(p.doc.targets ?? []).join(' '), 2],
  [p.doc.origin ?? '', 1], [p.doc.summary ?? '', 1],
]
const byEvidence = (p) => !library.evidence || p.doc.evidence === library.evidence
const inCategory = (p) => !library.category || catKey(p) === library.category
const evCount = Object.fromEntries(EVIDENCE_KEYS.map((k) => [k, presets.filter((p) => p.doc.evidence === k).length]))
// Category chips count what the evidence filter leaves.
const chips = computed(() => groupedPresets().map((g) => ({ key: g.key, label: g.label, n: g.items.filter(byEvidence).length })).filter((c) => c.n))
const ranked = computed(() => {
  if (!words.value.length) return null
  return presets.filter((p) => byEvidence(p) && inCategory(p))
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
const pickCategory = (key) => (library.category = library.category === key ? '' : key)

// ---------------------------------------------------------------- by placement
const LOBES = ['temporal', 'frontal', 'central', 'parietal', 'occipital', 'inion']
const sideOf = (n) => (SITES[n]?.[0] < -12 ? 'left' : SITES[n]?.[0] > 12 ? 'right' : 'mid')
function bestView(g) {
  const sides = new Set(g.sites.filter(Boolean).map((s) => sideOf(siteName(s))))
  return sides.size === 1 && !sides.has('mid') ? [...sides][0] : 'top'
}
const shownGroups = computed(() => {
  const q = norm(library.query.trim())
  return groups.filter((g) => (!library.lobe || g.lobes.includes(library.lobe)) && (!q || norm(`${g.name} ${g.sites.filter(Boolean).join(' ')} ${g.programs.map((p) => p.doc.name).join(' ')}`).includes(q)))
})
const filtering = computed(() => !!(library.query.trim() || library.lobe))
const visibleGroups = computed(() => (library.allGroups || filtering.value ? shownGroups.value : shownGroups.value.slice(0, 12)))
const sitesLine = (g) => g.sites.map((s, i) => (s ? `${i + 1} ${s}` : null)).filter(Boolean).join(' · ')
const toggleGroup = (g) => (library.group = library.group === g.key ? null : g.key)

// ---------------------------------------------------------------- by site
const data = shallowRef(null)
const needRegions = computed(() => library.mode === 'site')
let loading = null
const ensureRegions = () => (loading ??= loadRegions().then((d) => (data.value = d)))
const charted = computed(() => Object.fromEntries((data.value?.regions ?? []).filter((r) => r.kind === 'site').map((r) => [r.site, r])))
const explorer = ref(null)
function openSite(n) {
  library.site = n
  // on phones the site card sits under the map
  nextTick(() => (matchMedia('(max-width: 820px)').matches ? explorer.value?.show() : document.getElementById('lib-site-explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
}

// ---------------------------------------------------------------- by experience
const experiences = computed(() => {
  const q = norm(library.query.trim())
  return STATE_MAP.map((row) => ({ ...row, p: presetById(row.preset) }))
    .filter((r) => !q || norm(`${r.state} ${r.region} ${r.p?.doc.name ?? ''}`).includes(q))
})

function setMode(m) {
  library.mode = m
  if (m === 'site') ensureRegions()
}
if (needRegions.value) ensureRegions()
</script>

<template>
  <div class="page library">
    <LivePanel />

    <header class="card head">
      <div class="title-row">
        <h2>Programs</h2>
        <span class="small muted">{{ presets.length }} programs, {{ groups.length }} placements</span>
      </div>
      <p class="small muted intro">Each program sets the coils' signals, timing and sites. Open one to see its phases, where the coils go and where the field reaches, and to start it.</p>
      <p v-if="missing" class="small warn" role="status">No program called “{{ missing }}”.</p>
      <div class="seg" role="group" aria-label="Browse by">
        <button v-for="m in MODES" :key="m.key" type="button" :class="{ on: library.mode === m.key }" :aria-pressed="library.mode === m.key" @click="setMode(m.key)">{{ m.label }}</button>
      </div>
      <div v-if="library.mode !== 'site'" class="search-row">
        <input v-model="library.query" type="search" :placeholder="PLACEHOLDER[library.mode]" :aria-label="PLACEHOLDER[library.mode]" />
        <select v-if="library.mode === 'category'" v-model="library.evidence" aria-label="Evidence level">
          <option value="">Any evidence</option>
          <option v-for="k in EVIDENCE_KEYS" :key="k" :value="k">{{ evidenceLabel(k) }} ({{ evCount[k] }})</option>
        </select>
      </div>
      <div v-if="library.mode === 'category'" class="chips" role="group" aria-label="Category">
        <button type="button" class="chip pick" :class="{ on: !library.category }" :aria-pressed="!library.category" @click="library.category = ''">All</button>
        <button v-for="c in chips" :key="c.key" type="button" class="chip pick" :class="{ on: library.category === c.key }" :aria-pressed="library.category === c.key" @click="pickCategory(c.key)">{{ c.label }} <span class="n">{{ c.n }}</span></button>
      </div>
      <div v-if="library.mode === 'placement'" class="chips" role="group" aria-label="Filter by region">
        <button type="button" class="chip pick" :class="{ on: !library.lobe }" :aria-pressed="!library.lobe" @click="library.lobe = null">All</button>
        <button v-for="l in LOBES" :key="l" type="button" class="chip pick cap" :class="{ on: library.lobe === l }" :aria-pressed="library.lobe === l" @click="library.lobe = library.lobe === l ? null : l">{{ l }}</button>
      </div>
      <p v-if="library.mode === 'category' || library.mode === 'placement'" class="row small muted count">
        <span aria-live="polite">{{ library.mode === 'category'
          ? (ranked ? `${matchCount} match${matchCount === 1 ? '' : 'es'}, best first` : `${matchCount} of ${presets.length} programs`)
          : `${shownGroups.length} of ${groups.length} placements` }}</span>
        <button v-if="anyFilter" type="button" class="btn ghost sm" @click="clearFilters">Clear filters</button>
      </p>
    </header>

    <!-- by category: cards; a search shows one list, best match first -->
    <template v-if="library.mode === 'category'">
      <div v-if="!matchCount" class="card small muted">
        <p>No program matches{{ library.query.trim() ? ' this search' : '' }}{{ library.evidence ? ` with evidence “${evidenceLabel(library.evidence)}”` : '' }}{{ library.category ? ' in this category' : '' }}.</p>
        <div><button type="button" class="btn sm" @click="clearFilters">Clear filters</button></div>
      </div>
      <div v-else-if="ranked" class="cards">
        <ProgramCard v-for="p in ranked" :key="p.doc.id" :p="p" :current="p.doc.id === program.id" show-category />
      </div>
      <template v-else>
      <section v-for="g in sections" :key="g.key" class="group" :aria-label="g.label">
        <div class="group-head">
          <h3 class="group-title">{{ g.label }} <span class="n num">{{ g.items.length }}</span></h3>
          <button v-if="g.items.length > FIRST && !library.category" type="button" class="linkbtn small" :aria-expanded="!!library.more[g.key]" @click="library.more[g.key] = !library.more[g.key]">{{ library.more[g.key] ? 'Show fewer' : `Show all ${g.items.length}` }}</button>
        </div>
        <div class="cards">
          <ProgramCard v-for="p in g.shown" :key="p.doc.id" :p="p" :current="p.doc.id === program.id" />
        </div>
      </section>
      </template>
    </template>

    <!-- by placement: programs that put the coils on the same sites -->
    <section v-else-if="library.mode === 'placement'" class="card">
      <p class="small muted">Programs with the same placement put the coils on the same sites; they differ in signal, timing and which coils run when. Open a placement to see its programs.</p>
      <div class="gallery">
        <template v-for="g in visibleGroups" :key="g.key">
          <button type="button" class="g-card" :class="{ on: library.group === g.key }" :aria-expanded="library.group === g.key" @click="toggleGroup(g)">
            <SiteMap class="thumb" :sites="g.sites" :view="bestView(g)" compact />
            <span class="g-text">
              <span class="g-kind">{{ g.layout ? `Layout ${g.layout}` : `${g.coils} coil${g.coils === 1 ? '' : 's'}` }}, {{ g.programs.length }} program{{ g.programs.length === 1 ? '' : 's' }}</span>
              <span class="g-name">{{ g.name }}</span>
              <span class="g-sites num">{{ sitesLine(g) }}</span>
            </span>
          </button>
          <div v-if="library.group === g.key" class="g-open">
            <p class="small muted">{{ g.basis }}</p>
            <div class="g-progs">
              <a v-for="p in g.programs" :key="p.doc.id" class="prog" :class="{ on: p.doc.id === program.id }" :href="href(p.doc.id)">
                <span class="prog-name">{{ p.doc.name }}</span>
                <span class="muted small">{{ catLabel(p) }}, {{ fmtMinutes(p.session.totalMs) }}</span>
              </a>
            </div>
          </div>
        </template>
      </div>
      <p v-if="!shownGroups.length" class="small muted">No placement matches.</p>
      <button v-if="!filtering && shownGroups.length > 12" type="button" class="btn ghost sm show-all" @click="library.allGroups = !library.allGroups">{{ library.allGroups ? 'Show the 12 most used' : `Show all ${shownGroups.length} placements` }}</button>
    </section>

    <!-- by site: what lies under each scalp site, and the programs with a coil there -->
    <section v-else-if="library.mode === 'site'" id="lib-site-explorer" class="card sites">
      <p class="small muted">Tap any site to see how to find it, what lies under it, what stimulating that area did, and which programs use it.</p>
      <SiteExplorer ref="explorer" v-model:site="library.site" :data="data" :groups="groups" @program="open" />
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
    </section>

    <!-- by experience: which brain region, and the program for it -->
    <section v-else class="card">
      <p class="muted small">"Claim" = Persinger lab or Todd Murphy. Every mainstream induction of out-of-body or presence experiences used milliamp currents through electrodes on the brain, not µT fields from outside the skull. The fields reach the cortex at about {{ fmtRange(1, 5) }} and deep structures at 10–20× less.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Experience</th><th>Brain region</th><th>Program</th></tr></thead>
          <tbody>
            <tr v-for="row in experiences" :key="row.preset" class="clickable" @click="open(row.p)">
              <td><b>{{ row.state }}</b></td><td class="muted">{{ row.region }}</td>
              <td><a v-if="row.p" class="cell-link" :href="href(row.p.doc.id)" @click.stop>{{ row.p.doc.name }}</a></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!experiences.length" class="small muted">No experience matches.</p>
    </section>
  </div>
</template>

<style scoped>
.head { gap: 12px; }
.title-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.intro { max-width: 75ch; }
.search-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.search-row select { width: auto; }
.chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: thin; padding-bottom: 2px; }
.chip.pick .n { opacity: .7; font-variant-numeric: tabular-nums; }
.cap { text-transform: capitalize; }
.count { min-height: 32px; }

.group { display: grid; gap: 8px; }
.group-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 10px; }
.group-title { font-size: 20px; }
.group-title .n { font-size: 15px; color: var(--muted); font-weight: 600; margin-left: 4px; }

.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 10px; }
.g-card { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px; align-items: center; text-align: left; padding: 8px 12px 8px 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); color: var(--text); cursor: pointer; min-width: 0; }
.g-card:hover { border-color: var(--accent); }
.g-card.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
.thumb { width: 96px; }
.g-text { display: grid; gap: 2px; min-width: 0; }
.g-kind { font-size: 12px; font-weight: 600; color: var(--muted); }
.g-name { font-weight: 600; font-size: 14.5px; line-height: 1.3; overflow-wrap: anywhere; }
.g-sites { font-size: 12.5px; color: var(--muted); overflow-wrap: anywhere; line-height: 1.35; }
.g-open { grid-column: 1 / -1; display: grid; gap: 8px; padding: 12px; border: 1px solid var(--accent); border-radius: 10px; background: var(--accent-soft); }
.g-progs { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 6px; }
.prog { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--text); text-decoration: none; min-width: 0; }
.prog:hover, .prog.on { border-color: var(--accent); }
.prog-name { font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; }
.show-all { justify-self: start; }

.sites { scroll-margin-top: calc(var(--header-h, 100px) + 10px); }
.ref summary { cursor: pointer; font-weight: 600; }
.ref[open] summary { margin-bottom: 10px; }
.cell-btn, .cell-link { text-align: left; font-weight: 600; }

@media (max-width: 520px) {
  .title-row .small { display: none; }
  .head .seg { flex-wrap: nowrap; overflow-x: auto; max-width: 100%; }
  .head .seg button { padding: 6px 9px; white-space: nowrap; }
  .search-row select { max-width: 138px; }
}
</style>
