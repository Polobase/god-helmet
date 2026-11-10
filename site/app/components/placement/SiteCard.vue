<script setup lang="ts">
// One 10-10 site: how to find it, what lies under it, what direct stimulation
// there did, Murphy's zones that include it, and the programs with a coil on it.
import { groups, type Preset } from '~/lib/programs'
import { useRegions, nearestCharted, describeSite, recipeFor, bandText } from '~/lib/placement'

const props = withDefaults(defineProps<{
  site: string
  /** The site's name and position as a heading; off where a title above already says it. */
  heading?: boolean
  /** The page of a program its links open: '' (Overview) or 'placement'. */
  sub?: string
}>(), { heading: true, sub: '' })
const emit = defineEmits<{ site: [name: string], program: [p: Preset] }>()

const { data, charted } = useRegions()
const entry = computed(() => charted.value[props.site] ?? null)
const nearest = computed(() => (entry.value ? null : nearestCharted(props.site, charted.value)))
const recipe = computed(() => recipeFor(props.site))
const studies = computed(() => (entry.value?.anatomy ?? '').split(' | ').filter(Boolean))
const stim = computed(() => (data.value?.siteGroups ?? []).filter((g) => g.sites.includes(props.site)))
const inZones = computed(() => (data.value?.zones ?? []).filter((z) => z.sites.includes(props.site)))
const programs = computed(() => {
  const out: { p: Preset, chs: number[] }[] = []
  for (const g of groups) {
    const chs = g.sites.flatMap((s, i) => (s === props.site ? [i + 1] : []))
    if (chs.length) for (const p of g.programs) out.push({ p, chs })
  }
  return out
})
const showAll = ref(false)
watch(() => props.site, () => (showAll.value = false))
</script>

<template>
  <article class="grid min-w-0 content-start gap-4">
    <header v-if="heading">
      <h3 class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span class="num text-4xl leading-none">{{ site }}</span>
        <span class="font-sans text-[0.95rem] font-normal tracking-normal text-muted">{{ describeSite(site) }}</span>
      </h3>
    </header>

    <dl class="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3.5 gap-y-2 text-sm">
      <template v-if="recipe">
        <dt>Find it</dt>
        <dd>
          <span v-if="recipe.estimate" class="mr-1 font-bold text-warning" title="Scaled from the template head">≈</span>{{ recipe.text }}
          <UBadge variant="outline" :color="recipe.band === 'on' ? 'info' : 'warning'" class="ml-1 rounded-full align-[0.08em] whitespace-nowrap">{{ bandText(recipe) }}</UBadge>
          <span v-if="recipe.detail" class="mt-1 block leading-snug text-muted">{{ recipe.detail }}</span>
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
        <dd>
          Not in the MRI site tables. Nearest charted site:
          <UButton variant="link" color="primary" class="p-0 align-baseline font-semibold" @click="emit('site', nearest.region.site)">{{ nearest.region.site }}</UButton>
          ({{ Math.round(nearest.mm) }} mm): {{ nearest.region.function }}
        </dd>
      </template>
    </dl>

    <details v-if="studies.length" class="text-sm">
      <summary class="cursor-pointer text-muted hover:text-highlighted">MRI and cap studies ({{ studies.length }})</summary>
      <ul class="mt-1.5 grid list-disc gap-1 pl-5 [overflow-wrap:anywhere]"><li v-for="(s, i) in studies" :key="i">{{ s }}</li></ul>
    </details>

    <section v-if="stim.length" class="part">
      <h4>Direct stimulation of this area</h4>
      <div v-for="g in stim" :key="g.area" class="text-sm leading-snug">
        <b class="text-highlighted">{{ g.area }}.</b> {{ g.driven }}
        <div class="text-muted [overflow-wrap:anywhere]">
          <template v-for="(s, i) in g.sources" :key="i">
            <a v-if="s.url" :href="s.url" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-highlighted">{{ s.title }}</a><span v-else>{{ s.title }}</span><span v-if="i < g.sources.length - 1">, </span>
          </template>
        </div>
      </div>
      <p class="text-sm text-muted">Electrodes on the brain use milliamps and TMS about 100 V/m; these coils induce microvolts to millivolts per metre.</p>
    </section>

    <section v-if="inZones.length" class="part">
      <h4>Murphy's zones with this site</h4>
      <div v-for="z in inZones" :key="z.name" class="text-sm">
        <b class="text-highlighted">{{ z.name }}</b>
        <div><EvidenceBadge level="claim" /> {{ z.claimed }}</div>
      </div>
    </section>

    <section class="part">
      <h4>Programs with a coil here <span class="num font-sans text-sm font-normal text-muted">({{ programs.length }})</span></h4>
      <p v-if="!programs.length" class="text-sm text-muted">No program uses this site.</p>
      <div v-else class="grid gap-1">
        <NuxtLink v-for="x in (showAll ? programs : programs.slice(0, 6))" :key="x.p.doc.id" :to="programPath(x.p.doc.id, sub)"
          class="flex justify-between gap-2.5 rounded-md border border-default px-2.5 py-1.5 text-sm text-highlighted transition-colors hover:border-accented hover:bg-elevated/50" @click="emit('program', x.p)">
          <span class="min-w-0 [overflow-wrap:anywhere]">{{ x.p.doc.name }}</span><span class="num whitespace-nowrap text-muted">CH{{ x.chs.join(', CH') }}</span>
        </NuxtLink>
        <UButton v-if="programs.length > 6" variant="link" color="primary" size="sm" class="justify-self-start px-0" :aria-expanded="showAll" @click="showAll = !showAll">{{ showAll ? 'Show fewer' : `Show all ${programs.length}` }}</UButton>
      </div>
    </section>
  </article>
</template>

<style scoped>
dt { color: var(--ui-text-muted); font-weight: 600; padding-top: 1px; }
dd { margin: 0; line-height: 1.45; color: var(--ui-text-highlighted); }
.part { display: grid; gap: 0.4rem; border-top: 1px solid var(--ui-border); padding-top: 0.75rem; }
.part h4 { font-family: var(--font-display); font-stretch: 86%; font-weight: 620; font-size: 1.05rem; color: var(--ui-text-highlighted); }
</style>
