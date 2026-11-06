<script setup>
// One 10-10 site: how to find it, what lies under it, what direct stimulation
// there did, Murphy's zones that include it, and the programs with a coil on it.
import { computed, ref, watch } from 'vue'
import { SITES } from '../../lib/brain.js'
import { describeSite } from '../../lib/tape.js'
import { recipeFor, bandText } from '../../lib/head.js'

const props = defineProps({
  site: { type: String, required: true },
  data: { type: Object, default: null }, // loadRegions()
  groups: { type: Array, required: true }, // placementGroups()
})
const emit = defineEmits(['site', 'program'])

const charted = computed(() => Object.fromEntries((props.data?.regions ?? []).filter((r) => r.kind === 'site').map((r) => [r.site, r])))
const zones = computed(() => props.data?.zones ?? [])
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
</script>

<template>
  <article class="site-card">
    <header>
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
        <dd>Not in the MRI site tables. Nearest charted site: <button type="button" class="linkbtn" @click="emit('site', nearest.r.site)">{{ nearest.r.site }}</button> ({{ Math.round(nearest.d) }} mm): {{ nearest.r.function }}</dd>
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
</template>

<style scoped>
.detail { display: block; margin-top: 4px; line-height: 1.4; }
.site-card { display: grid; gap: 12px; min-width: 0; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); scroll-margin-top: calc(var(--header-h, 100px) + 12px); }
.site-card h3 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
.big { font-size: 34px; line-height: 1; }
.where { font: 400 15px var(--font-body); color: var(--muted); letter-spacing: 0; }
.facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px 14px; margin: 0; font-size: 14px; }
.facts dt { color: var(--muted); font-size: 13px; font-weight: 600; padding-top: 1px; }
.facts dd { margin: 0; line-height: 1.45; }
.approx { color: var(--warn); font-weight: 700; margin-right: 4px; }
.chip.band { margin-left: 4px; }
.chip.band.band-on { border-color: var(--blue); color: var(--blue); }
.chip.band.band-above, .chip.band.band-below { border-color: var(--warn); color: var(--warn); }
.more summary { cursor: pointer; font-size: 13px; color: var(--muted); }
.more ul { margin: 6px 0 0; padding-left: 18px; display: grid; gap: 4px; overflow-wrap: anywhere; }
.block { display: grid; gap: 6px; border-top: 1px solid var(--line); padding-top: 10px; }
.block h4 { margin: 0; font: 600 16px var(--font-display); letter-spacing: .01em; color: var(--text); }
.stim { line-height: 1.45; }
.src { overflow-wrap: anywhere; }
.tag { display: inline-block; font-size: 11px; padding: 0 7px; border-radius: 99px; border: 1px solid; margin-right: 4px; }
.tag.claim { color: var(--warn); border-color: var(--warn); }
.progs { display: grid; gap: 4px; }
.prog { display: flex; justify-content: space-between; gap: 10px; text-align: left; background: none; border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; color: var(--text); cursor: pointer; font-size: 13.5px; }
.prog:hover { border-color: color-mix(in srgb, var(--text) 30%, var(--line)); background: var(--surface); }
.prog span:first-child { min-width: 0; overflow-wrap: anywhere; }
.prog span:last-child { white-space: nowrap; }
.linkbtn { justify-self: start; }
</style>
