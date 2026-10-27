<script setup>
// Every 10-10 site on a map: tap one to see where it is, how to find it, what
// lies under it, what direct stimulation there did, and which programs use it.
import { computed, nextTick, ref, watch } from 'vue'
import { SITES, siteName } from '../../lib/brain.js'
import { describeSite, parseSite } from '../../lib/tape.js'
import { recipeFor, bandText } from '../../lib/head.js'
import SiteMap from '../SiteMap.vue'

const props = defineProps({
  data: { type: Object, default: null }, // loadRegions()
  groups: { type: Array, required: true }, // placementGroups()
  site: { type: String, default: 'T8' },
})
const emit = defineEmits(['update:site', 'program'])

const VIEWS = [{ key: 'top', label: 'Top' }, { key: 'left', label: 'Left' }, { key: 'right', label: 'Right' }]
const x = (n) => SITES[siteName(n)]?.[0] ?? 0
const view = ref(x(props.site) < -12 ? 'left' : x(props.site) > 12 ? 'right' : 'top')
// A side view shows sites up to 12 mm past the midline (as SiteMap does).
const shown = (n, v) => v === 'top' || (v === 'left' ? x(n) <= 12 : x(n) >= -12)
const flip = () => (view.value = view.value === 'left' ? 'right' : 'left')
watch(() => props.site, (n) => {
  if (!shown(n, view.value)) flip()
})

const charted = computed(() => Object.fromEntries((props.data?.regions ?? []).filter((r) => r.kind === 'site').map((r) => [r.site, r])))
const zones = computed(() => props.data?.zones ?? [])
const zoneName = ref(null)
const zone = computed(() => zones.value.find((z) => z.name === zoneName.value) ?? null)
watch(zone, (z) => {
  const known = (z?.sites ?? []).map(siteName).filter(Boolean)
  if (known.length && !known.some((n) => shown(n, view.value))) flip()
})
const query = ref('')
const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  const exact = siteName(q)
  const out = Object.values(charted.value).filter((r) => r.site.toLowerCase().includes(q) || r.function.toLowerCase().includes(q) || r.anatomy.toLowerCase().includes(q)).map((r) => r.site)
  return exact && parseSite(exact) && !out.includes(exact) ? [exact, ...out] : out
})
const highlight = computed(() => [...new Set([...(zone.value?.sites ?? []), ...matches.value])])

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const entry = computed(() => charted.value[props.site] ?? null)
const nearest = computed(() => {
  if (entry.value || !SITES[props.site]) return null
  let best = null
  for (const r of Object.values(charted.value)) {
    const d = dist(SITES[props.site], SITES[r.site])
    if (!best || d < best.d) best = { r, d }
  }
  return best
})
const recipe = computed(() => recipeFor(props.site))
const studies = computed(() => (entry.value?.anatomy ?? '').split(' | ').filter(Boolean))
const stim = computed(() => (props.data?.siteGroups ?? []).filter((g) => g.sites.includes(props.site)))
const inZones = computed(() => zones.value.filter((z) => z.sites.includes(props.site)))
const programs = computed(() => {
  const out = []
  for (const g of props.groups) {
    const chs = g.sites.map((s, i) => (s === props.site ? i + 1 : null)).filter(Boolean)
    if (chs.length) for (const p of g.programs) out.push({ p, chs })
  }
  return out
})
const showAll = ref(false)
watch(() => props.site, () => (showAll.value = false))
// On narrow screens the card sits under the map: bring it into view after a tap.
const cardEl = ref(null)
function pick(n) {
  emit('update:site', n)
  if (!matchMedia('(max-width: 820px)').matches) return
  nextTick(() => {
    const h = cardEl.value?.querySelector('header')
    if (h && h.getBoundingClientRect().bottom > innerHeight - 24) cardEl.value.scrollIntoView({ block: 'start', behavior: 'smooth' })
  })
}
defineExpose({ show: () => cardEl.value?.scrollIntoView({ block: 'start', behavior: 'smooth' }) })
</script>

<template>
  <div class="explorer">
    <div class="map-col">
      <div class="tools">
        <div class="seg" role="group" aria-label="Map view">
          <button v-for="v in VIEWS" :key="v.key" type="button" :aria-pressed="view === v.key" :class="{ on: view === v.key }" @click="view = v.key">{{ v.label }}</button>
        </div>
        <input v-model="query" type="search" class="find" placeholder="Find a site or function (e.g. TPJ)" aria-label="Find a site or function" @keydown.enter="matches[0] && pick(matches[0])" />
      </div>
      <SiteMap :sites="[]" :view="view" selectable :selected="site" :highlight="highlight" @site="pick" />
      <div v-if="query.trim()" class="row small matches">
        <span class="muted">{{ matches.length ? `${matches.length} match${matches.length === 1 ? '' : 'es'}:` : 'No charted site matches.' }}</span>
        <button v-for="m in matches.slice(0, 14)" :key="m" type="button" class="chip pick" :class="{ on: m === site }" @click="pick(m)">{{ m }}</button>
      </div>
      <div v-if="zones.length" class="zones">
        <span class="small muted">Murphy's scalp zones (claims):</span>
        <div class="row">
          <button v-for="z in zones" :key="z.name" type="button" class="chip pick" :class="{ on: zoneName === z.name }" :aria-pressed="zoneName === z.name" @click="zoneName = zoneName === z.name ? null : z.name">{{ z.name.split(/ [–-] /)[0] }}</button>
        </div>
        <div v-if="zone" class="zone-card small">
          <b>{{ zone.name }}</b>
          <div><span class="muted">Sites:</span> {{ zone.sites.join(', ') }}</div>
          <div><span class="muted">Underneath:</span> {{ zone.anatomy }}</div>
          <div><span class="tag claim">claim</span> {{ zone.claimed }}</div>
          <div v-if="zone.mainstream" class="muted">{{ zone.mainstream }}</div>
        </div>
      </div>
    </div>

    <p class="sr-only" role="status">{{ site }}: {{ describeSite(site) }}</p>
    <article ref="cardEl" class="site-card">
      <header>
        <span class="eyebrow">Site</span>
        <h3><span class="num big">{{ site }}</span> <span class="where">{{ describeSite(site) }}</span></h3>
      </header>
      <dl class="facts">
        <template v-if="recipe">
          <dt>Find it</dt>
          <dd>
            <span v-if="recipe.estimate" class="approx" title="Scaled from the template head">≈</span>{{ recipe.text }} <span class="chip band" :class="`band-${recipe.band}`">{{ bandText(recipe) }}</span>
            <span v-if="recipe.detail" class="small muted detail">{{ recipe.detail }}</span>
          </dd>
        </template>
        <template v-if="entry">
          <dt>Under it</dt>
          <dd>{{ entry.function }}</dd>
          <dt>Depth</dt>
          <dd><span class="num">{{ entry.depthMm.toFixed(1) }} mm</span> from the scalp to the brain (template head)</dd>
        </template>
        <template v-else-if="nearest">
          <dt>Under it</dt>
          <dd>Not in the MRI site tables. Nearest charted site: <button type="button" class="linkbtn" @click="pick(nearest.r.site)">{{ nearest.r.site }}</button> ({{ Math.round(nearest.d) }} mm): {{ nearest.r.function }}</dd>
        </template>
      </dl>
      <details v-if="studies.length" class="more">
        <summary>MRI and cap studies ({{ studies.length }})</summary>
        <ul class="small"><li v-for="(s, i) in studies" :key="i">{{ s }}</li></ul>
      </details>
      <section v-if="stim.length" class="block">
        <h4>Direct stimulation of this area</h4>
        <div v-for="g in stim" :key="g.area" class="small stim">
          <b>{{ g.area }}.</b> {{ g.driven }}
          <div class="muted src"><template v-for="(s, i) in g.sources" :key="i"><a v-if="s.url" :href="s.url" target="_blank" rel="noopener">{{ s.title }}</a><span v-else>{{ s.title }}</span><span v-if="i < g.sources.length - 1"> · </span></template></div>
        </div>
        <p class="small muted">Electrodes on the brain use milliamps and TMS about 100 V/m; these coils induce microvolts to millivolts per metre.</p>
      </section>
      <section v-if="inZones.length" class="block">
        <h4>Murphy's zones with this site</h4>
        <div v-for="z in inZones" :key="z.name" class="small"><b>{{ z.name }}</b><div><span class="tag claim">claim</span> {{ z.claimed }}</div></div>
      </section>
      <section class="block">
        <h4>Programs with a coil here <span class="muted">({{ programs.length }})</span></h4>
        <p v-if="!programs.length" class="small muted">No program uses this site.</p>
        <div v-else class="progs">
          <button v-for="x in (showAll ? programs : programs.slice(0, 6))" :key="x.p.doc.id" type="button" class="prog" @click="emit('program', x.p)">
            <span>{{ x.p.doc.name }}</span><span class="muted small">CH{{ x.chs.join(', CH') }}</span>
          </button>
          <button v-if="programs.length > 6" type="button" class="linkbtn small" @click="showAll = !showAll">{{ showAll ? 'Show fewer' : `Show all ${programs.length}` }}</button>
        </div>
      </section>
    </article>
  </div>
</template>

<style scoped>
.explorer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: start; }
.map-col { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-width: 0; position: sticky; top: 112px; }
.tools { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.find { flex: 1 1 180px; min-width: 0; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 9px 10px; color: var(--text); }
.matches { gap: 6px; }
.chip.pick { cursor: pointer; background: none; min-height: 28px; }
.chip.pick:hover { border-color: var(--accent); color: var(--text); }
.chip.pick.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.zones { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
.zones .chip.pick { white-space: normal; text-align: left; max-width: 100%; border-radius: 14px; }
.detail { display: block; margin-top: 4px; line-height: 1.4; }
.zones .row { gap: 6px; }
.zone-card { display: grid; gap: 4px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
.site-card { display: grid; gap: 12px; min-width: 0; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); scroll-margin-top: 110px; }
.site-card h3 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
.big { font-size: 34px; line-height: 1; }
.where { font: 400 15px var(--font-body); color: var(--muted); letter-spacing: 0; }
.facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px 14px; margin: 0; font-size: 14px; }
.facts dt { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; padding-top: 2px; }
.facts dd { margin: 0; line-height: 1.45; }
.approx { color: var(--warn); font-weight: 700; margin-right: 4px; }
.chip.band { margin-left: 4px; }
.chip.band.band-on { border-color: var(--blue); color: var(--blue); }
.chip.band.band-above, .chip.band.band-below { border-color: var(--warn); color: var(--warn); }
.more summary { cursor: pointer; font-size: 13px; color: var(--muted); }
.more ul { margin: 6px 0 0; padding-left: 18px; display: grid; gap: 4px; overflow-wrap: anywhere; }
.block { display: grid; gap: 6px; border-top: 1px solid var(--line); padding-top: 10px; }
.block h4 { margin: 0; font: 600 13px var(--font-body); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.stim { line-height: 1.45; }
.src { overflow-wrap: anywhere; }
.tag { display: inline-block; font-size: 11px; padding: 0 7px; border-radius: 99px; border: 1px solid; margin-right: 4px; }
.tag.claim { color: var(--warn); border-color: var(--warn); }
.progs { display: grid; gap: 4px; }
.prog { display: flex; justify-content: space-between; gap: 10px; text-align: left; background: none; border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; color: var(--text); cursor: pointer; font-size: 13.5px; }
.prog:hover { border-color: var(--accent); }
.prog span:first-child { min-width: 0; overflow-wrap: anywhere; }
.prog span:last-child { white-space: nowrap; }
.linkbtn { justify-self: start; }
@media (max-width: 820px) {
  /* card right under the map, zone chips after it */
  .explorer { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .map-col { display: contents; }
  .tools, .matches { order: 0; }
  .site-card { order: 1; }
  .zones { order: 2; }
}
</style>
