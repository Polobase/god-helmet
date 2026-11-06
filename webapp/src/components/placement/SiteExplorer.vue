<script setup>
// Every 10-10 site on a map: tap one to see where it is, how to find it, what
// lies under it, what direct stimulation there did, and which programs use it.
import { computed, nextTick, ref, watch } from 'vue'
import { SITES, siteName } from '../../lib/brain.js'
import { describeSite, parseSite } from '../../lib/tape.js'
import SiteMap from '../SiteMap.vue'
import SiteCard from './SiteCard.vue'

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

// On narrow screens the card sits under the map: bring it into view after a tap.
const cardEl = ref(null)
function pick(n) {
  emit('update:site', n)
  if (!matchMedia('(max-width: 820px)').matches) return
  nextTick(() => {
    const el = cardEl.value?.$el
    const h = el?.querySelector('header')
    if (h && h.getBoundingClientRect().bottom > innerHeight - 24) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  })
}
defineExpose({ show: () => cardEl.value?.$el?.scrollIntoView({ block: 'start', behavior: 'smooth' }) })
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
    <SiteCard ref="cardEl" class="card-slot" :site="site" :data="data" :groups="groups" @site="pick" @program="emit('program', $event)" />
  </div>
</template>

<style scoped>
.explorer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: start; }
.map-col { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-width: 0; position: sticky; top: calc(var(--header-h, 100px) + 12px); }
.tools { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.find { flex: 1 1 180px; min-width: 0; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 9px 10px; color: var(--text); }
.matches { gap: 6px; }
.zones { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
.zones .chip.pick { white-space: normal; text-align: left; max-width: 100%; border-radius: 14px; }
.zones .row { gap: 6px; }
.zone-card { display: grid; gap: 4px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
@media (max-width: 820px) {
  /* card right under the map, zone chips after it */
  .explorer { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .map-col { display: contents; }
  .tools, .matches { order: 0; }
  .card-slot { order: 1; }
  .zones { order: 2; }
}
</style>
