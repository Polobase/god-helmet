<script setup>
import { computed, ref, shallowRef } from 'vue'
import { LAYOUTS, STATE_MAP } from '../lib/layouts.js'
import { presetById, presets } from '../lib/presets.js'
import { loadBrain, sessionSites, SITES } from '../lib/brain.js'
import { go } from '../lib/nav.js'
import HeadDiagram from '../components/HeadDiagram.vue'
import SiteMap from '../components/SiteMap.vue'

const usingLayout = (key) => presets.filter((p) => (p.doc.layout ?? 'temporal') === key)

// Program-specific placements, grouped by their set of sites.
const customGroups = computed(() => {
  const groups = new Map()
  for (const p of presets) {
    if (p.session?.layout !== 'custom') continue
    const sites = sessionSites(p.session)
    const key = sites.map((s) => s ?? '').join(',')
    if (!groups.has(key)) groups.set(key, { sites, programs: [] })
    groups.get(key).programs.push(p)
  }
  return [...groups.values()].sort((a, b) => b.programs.length - a.programs.length)
})

// Site reference: anatomy under each 10-10 site and Murphy's scalp zones.
const brain = shallowRef(null)
loadBrain().then((b) => (brain.value = b))
const siteRows = computed(() => (brain.value?.regions ?? []).filter((r) => r.kind === 'site'))
const zones = computed(() => brain.value?.zones ?? [])
const siteGroups = computed(() => brain.value?.siteGroups ?? [])
const zone = ref(null)
const siteFilter = ref('')
const shownSites = computed(() => {
  const q = siteFilter.value.trim().toLowerCase()
  return siteRows.value.filter((r) => !q || r.site.toLowerCase().includes(q) || r.function.toLowerCase().includes(q) || r.anatomy.toLowerCase().includes(q))
})
const knownSites = Object.keys(SITES).length
</script>

<template>
  <div class="page">
    <header class="card">
      <span class="eyebrow">Coil placement</span>
      <h2>Two layouts on one Velcro headband</h2>
      <p>All eight coils sit on a 6–8 cm neoprene band and move between the two layouts. Each program says which layout it expects. The coil axis points to the centre of the head, the clean face (no leads) toward the scalp, and all coils are wired the same way round: inner lead = signal, outer lead = return.</p>
      <p class="muted small">Positions use the 10-20 EEG system. Measure the head circumference along a line about 2 cm above the eyebrows and just above the ear tops; that is the line the band follows.</p>
    </header>

    <section v-for="L in LAYOUTS" :key="L.key" class="card">
      <div class="row" style="justify-content: space-between">
        <h2>{{ L.letter }} · {{ L.title }}</h2>
        <span class="muted small">{{ L.source }}</span>
      </div>
      <div class="grid2">
        <div class="diagram"><HeadDiagram :layout="L.key" :direction="L.key === 'ring' ? 'ccw' : null" /></div>
        <div class="stack">
          <p>{{ L.summary }}</p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Coil</th><th>Site</th><th>Where</th><th>Underneath</th></tr></thead>
              <tbody>
                <tr v-for="(c, i) in L.channels" :key="i">
                  <td class="num">CH{{ i + 1 }}</td><td class="num">{{ c.site }}</td><td>{{ c.where }}</td><td class="muted">{{ c.region }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="row small">
            <span class="muted">Programs:</span>
            <button v-for="p in usingLayout(L.key)" :key="p.doc.id" class="chip" @click="go('programs', p.doc.id)">{{ p.doc.name }}</button>
          </div>
        </div>
      </div>
    </section>

    <section v-if="customGroups.length" class="card">
      <span class="eyebrow">Layout C</span>
      <h2>Program-specific placements</h2>
      <p>Many programs place the coils on their own 10-10 sites (Murphy's Shiva and Shakti layouts, clinical coil positions). Move the coils to the sites shown before starting; the program page and the Brain tab show the same map.</p>
      <div class="custom-grid">
        <div v-for="(g, i) in customGroups" :key="i" class="custom">
          <SiteMap :sites="g.sites" :labels="false" />
          <div class="small num">{{ g.sites.map((s, ch) => (s ? `CH${ch + 1} ${s}` : null)).filter(Boolean).join(' · ') }}</div>
          <div class="row small">
            <button v-for="p in g.programs" :key="p.doc.id" class="chip" @click="go('programs', p.doc.id)">{{ p.doc.name }}</button>
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Finding a 10-10 site with a tape measure</h2>
      <div class="grid2">
        <div class="diagram"><SiteMap :sites="[]" :highlight="zone ? zone.sites : []" /></div>
        <ol class="small prep">
          <li>Mark the <b>nasion</b> (dent at the top of the nose bridge), the <b>inion</b> (bump at the back of the skull) and both <b>pre-auricular points</b> (front root of the tragus, the small flap in front of the ear canal). Use the same ear landmark every time: it moves the temporal sites most.</li>
          <li><b>Cz</b> is halfway from nasion to inion over the top of the head, and also halfway between the two ear points. Adjust until both hold.</li>
          <li>Front to back through Cz, in 10 % steps of the nasion–inion distance: Fpz, AFz, Fz, FCz, Cz, CPz, Pz, POz, Oz.</li>
          <li>Ear to ear through Cz, in 10 % steps: T7, C5, C3, C1, Cz, C2, C4, C6, T8.</li>
          <li>Around the head through Fpz, T7, Oz (the 10 % line): fifths of Fpz–T7 give Fp1, AF7, F7, FT7; fifths of T7–Oz give TP7, P7, PO7, O1. Same on the right.</li>
          <li>Rows between: F7–Fz–F8, FT7–FCz–FT8, TP7–CPz–TP8, P7–Pz–P8, each half divided in quarters (F5, F3, F1 ...).</li>
          <li>The low ring (nasion – ear point – inion) gives F9, FT9, T9, TP9, P9: about 4 cm below the band line (T9 sits about 39 mm below T7), over the inferior temporal lobe.</li>
        </ol>
      </div>
      <p class="muted small">Repeat measurements by hand vary by about 5–10 mm (Xiao 2017; Atcherson 2007), roughly the radius of the field spot a coil makes on the cortex, so re-measure each session and mark the band. After Jurcak, Tsuzuki &amp; Dan 2007 (UI 10/10). Map positions: MNE-Python fsaverage 10-05 set ({{ knownSites }} positions; 10-10 shown).</p>
      <div v-if="zones.length" class="stack">
        <h3>Murphy's scalp zones</h3>
        <div class="row small">
          <button v-for="z in zones" :key="z.name" class="chip" :class="{ on: zone === z }" @click="zone = zone === z ? null : z">{{ z.name.split(/ [–-] /)[0] }}</button>
        </div>
        <div v-if="zone" class="zone card">
          <b>{{ zone.name }}</b>
          <div class="small"><span class="muted">Sites:</span> {{ zone.sites.join(', ') }}</div>
          <div class="small"><span class="muted">Underneath:</span> {{ zone.anatomy }}</div>
          <div class="small"><span class="chip">claim</span> {{ zone.claimed }}</div>
          <div v-if="zone.mainstream" class="small muted">{{ zone.mainstream }}</div>
        </div>
      </div>
    </section>

    <section v-if="siteRows.length" class="card">
      <div class="row" style="justify-content: space-between">
        <h2>What lies under each site</h2>
        <input v-model="siteFilter" type="search" placeholder="Filter: site or function" style="max-width: 260px" aria-label="Filter sites" />
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Site</th><th>Scalp → brain</th><th>Underneath (MRI studies)</th><th>Function (mainstream)</th></tr></thead>
          <tbody>
            <tr v-for="r in shownSites" :key="r.id">
              <td class="num"><b>{{ r.site }}</b></td>
              <td class="num">{{ r.depthMm }} mm</td>
              <td class="small">{{ r.anatomy.split(' | ')[0] }}</td>
              <td class="small muted">{{ r.function }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small">Template values (MNI); real heads differ by 5–10 mm. Sources: Koessler 2009, Jurcak/Dan lab 10/5 projections, Scrivener &amp; Reader 2022.</p>
    </section>

    <section v-if="siteGroups.length" class="card">
      <h2>What stimulating these areas did (electrodes, TMS)</h2>
      <p class="muted small">Context, not an effect of this helmet: direct electrical stimulation during epilepsy surgery uses milliamps on the brain itself, and TMS about 100 V/m. The coils here induce microvolts to millivolts per metre.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Area</th><th>Sites</th><th>Findings</th></tr></thead>
          <tbody>
            <tr v-for="g in siteGroups" :key="g.area">
              <td><b>{{ g.area }}</b></td>
              <td class="num small">{{ g.sites.join(', ') }}</td>
              <td class="small">{{ g.driven }}<div class="muted"><template v-for="(s, i) in g.sources" :key="i"><a v-if="s.url" :href="s.url" target="_blank" rel="noopener">{{ s.title }}</a><span v-else>{{ s.title }}</span><span v-if="i < g.sources.length - 1"> · </span></template></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h2>Which brain region for which experience</h2>
      <p class="muted small">"Claim" = Persinger lab or Todd Murphy. Every mainstream induction of out-of-body or presence experiences used milliamp currents through electrodes on the brain, not µT fields from outside the skull. The fields reach the cortex at about 1–5 µT and deep structures at 10–20× less.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Experience</th><th>Brain region</th><th>Program</th></tr></thead>
          <tbody>
            <tr v-for="row in STATE_MAP" :key="row.preset" class="clickable" @click="go('programs', row.preset)">
              <td><b>{{ row.state }}</b></td><td class="muted">{{ row.region }}</td><td>{{ presetById(row.preset)?.doc.name }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h2>Preparing the coils</h2>
      <ul class="small prep">
        <li>Scrape the enamel off the last 5 mm of both leads; the meter should read about 4.2 Ω between them.</li>
        <li>Mark the inner lead (it leaves the top face next to the core): it is the signal lead.</li>
        <li>Mount with a nylon M3 screw into the core and a Velcro-backed clip (hardware/coil_clip.scad).</li>
        <li>Polarity check: Setup → DC test with a compass in front of each coil. All eight must show the same pole toward the head.</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.diagram { max-width: 420px; width: 100%; justify-self: center; }
.prep { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.chip { cursor: pointer; background: none; }
.chip.on { background: var(--accent); color: var(--accent-ink); }
.custom-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.custom { display: grid; gap: 8px; align-content: start; border: 1px solid var(--line); border-radius: 8px; padding: 10px; }
.zone { background: var(--surface-2); gap: 6px; }
.chip:hover { border-color: var(--accent); color: var(--text); }
</style>
