<script setup lang="ts">
// Every 10-10 site on a map: tap one to see where it is, how to find it, what
// lies under it, what direct stimulation there did, and which programs use it.
import type { ComponentPublicInstance } from 'vue'
import { SITES, siteName, describeSite, parseSite, useRegions, type MapView } from '~/lib/placement'

const site = defineModel<string>('site', { default: 'T8' })

const VIEWS = [{ value: 'top', label: 'Top' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]
const x = (n: string) => SITES[siteName(n) ?? '']?.[0] ?? 0
const view = ref<MapView>(x(site.value) < -12 ? 'left' : x(site.value) > 12 ? 'right' : 'top')
// A side view shows sites up to 12 mm past the midline (as SiteMap does).
const shown = (n: string, v: MapView) => v === 'top' || (v === 'left' ? x(n) <= 12 : x(n) >= -12)
const flip = () => (view.value = view.value === 'left' ? 'right' : 'left')
watch(site, (n) => {
  if (!shown(n, view.value)) flip()
})

const { data, charted } = useRegions()
const zones = computed(() => data.value?.zones ?? [])
const zoneName = ref<string | null>(null)
const zone = computed(() => zones.value.find((z) => z.name === zoneName.value) ?? null)
watch(zone, (z) => {
  const known = (z?.sites ?? []).map((n) => siteName(n)).filter((n): n is string => !!n)
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
const cardEl = ref<ComponentPublicInstance>()
function pick(n: string) {
  site.value = n
  if (!matchMedia('(max-width: 820px)').matches) return
  nextTick(() => {
    const el = cardEl.value?.$el as HTMLElement | undefined
    const h = el?.querySelector('header')
    if (el && h && h.getBoundingClientRect().bottom > innerHeight - 24) el.scrollIntoView({ block: 'start', behavior: smooth() })
  })
}
const pickFirst = () => matches.value[0] && pick(matches.value[0])
defineExpose({ show: () => (cardEl.value?.$el as HTMLElement | undefined)?.scrollIntoView({ block: 'start', behavior: smooth() }) })
</script>

<template>
  <div class="explorer">
    <div class="map-col">
      <div class="tools flex flex-wrap items-center gap-2.5">
        <UTabs v-model="view" :items="VIEWS" :content="false" size="sm" role="group" aria-label="Map view" />
        <UInput v-model="query" type="search" icon="i-lucide-search" class="min-w-0 flex-[1_1_11rem]" placeholder="Find a site or function (e.g. TPJ)" aria-label="Find a site or function" @keydown.enter="pickFirst" />
      </div>
      <SiteMap class="the-map" :sites="[]" :view="view" selectable :selected="site" :highlight="highlight" @site="pick" />
      <div v-if="query.trim()" class="matches flex flex-wrap items-center gap-1.5 text-sm">
        <span class="text-muted" aria-live="polite">{{ matches.length ? `${matches.length} match${matches.length === 1 ? '' : 'es'}:` : 'No charted site matches.' }}</span>
        <UButton v-for="m in matches.slice(0, 14)" :key="m" size="xs" class="num rounded-full" :variant="m === site ? 'soft' : 'outline'" :color="m === site ? 'primary' : 'neutral'" :aria-pressed="m === site" @click="pick(m)">{{ m }}</UButton>
      </div>
      <div v-if="zones.length" class="zones grid grid-cols-[minmax(0,1fr)] gap-1.5">
        <span class="text-sm text-muted">Murphy's scalp zones (claims):</span>
        <div class="flex flex-wrap gap-1.5">
          <UButton v-for="z in zones" :key="z.name" size="xs" class="max-w-full rounded-2xl text-left whitespace-normal" :variant="zoneName === z.name ? 'soft' : 'outline'" :color="zoneName === z.name ? 'primary' : 'neutral'"
            :aria-pressed="zoneName === z.name" @click="zoneName = zoneName === z.name ? null : z.name">
            {{ z.name.split(/ [–-] /)[0] }}
          </UButton>
        </div>
        <div v-if="zone" class="grid gap-1 rounded-md border border-default bg-elevated/50 px-3 py-2.5 text-sm">
          <b class="text-highlighted">{{ zone.name }}</b>
          <div><span class="text-muted">Sites:</span> {{ zone.sites.join(', ') }}</div>
          <div><span class="text-muted">Underneath:</span> {{ zone.anatomy }}</div>
          <div><EvidenceBadge level="claim" /> {{ zone.claimed }}</div>
          <div v-if="zone.mainstream" class="text-muted">{{ zone.mainstream }}</div>
        </div>
      </div>
    </div>

    <p class="sr-only" role="status">{{ site }}: {{ describeSite(site) }}</p>
    <PlacementSiteCard ref="cardEl" class="card-slot rounded-lg border border-default bg-muted p-4 sm:p-5" :site="site" @site="pick" />
  </div>
</template>

<style scoped>
.explorer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1.25rem; align-items: start; }
.map-col { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.65rem; min-width: 0; position: sticky; top: calc(var(--header-h, 4rem) + 0.75rem); }
@media (max-width: 820px) {
  /* card right under the map, zone chips after it */
  .explorer { grid-template-columns: minmax(0, 1fr); gap: 0.75rem; }
  .map-col { display: contents; }
  .tools, .the-map, .matches { order: 0; }
  .card-slot { order: 1; }
  .zones { order: 2; }
}
</style>
