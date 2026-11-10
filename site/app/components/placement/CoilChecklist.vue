<script setup lang="ts">
// One row per coil: tick box, site, where it is in plain words and how to find
// it with a tape (cm for the user's head). "More" (or the details switch for
// all rows) adds the measuring detail and what lies under the coil.
import type { LayoutChannel } from '~/lib/programs'
import { placementState, siteName, describeSite, recipeFor, bandText, headInUse, useRegions, nearestCharted, HEAD_LABELS, type HeadKey, type Recipe } from '~/lib/placement'

const props = defineProps<{
  /** Site per coil, null where a channel is unused. */
  sites: (string | null)[]
  /** Coils ticked as placed. */
  ticks: boolean[]
  /** The curated regions of the two standard layouts, per channel. */
  layoutChannels?: LayoutChannel[] | null
  /** The coil the map points at. */
  focus?: number | null
}>()
const emit = defineEmits<{ toggle: [ch: number], focus: [ch: number | null], site: [name: string], reset: [], measure: [] }>()

const { charted } = useRegions()
function underText(name: string, ch: number) {
  const curated = props.layoutChannels?.[ch]
  const entry = charted.value[name]
  const depth = entry?.depthMm ? `, ${Math.round(entry.depthMm)} mm scalp to brain` : ''
  if (curated) return `${curated.region}${depth}`
  if (entry) return `${entry.function}${depth}`
  // 10-5 site without a table entry: nearest charted site.
  const near = nearestCharted(name, charted.value)
  return near ? `Near ${near.region.site} (${Math.round(near.mm)} mm): ${near.region.function}` : ''
}

interface Row { ch: number, name: string, where: string, r: Recipe | null, band: string, under: string }
const rows = computed(() => props.sites.map((s, ch): Row | { ch: number, name: null } => {
  const name = siteName(s)
  if (!name) return { ch, name: null }
  const r = recipeFor(name)
  return { ch, name, where: describeSite(name), r, band: bandText(r), under: underText(name, ch) }
}))
const used = computed(() => rows.value.filter((r): r is Row => r.name !== null))
const unused = computed(() => rows.value.filter((r) => r.name === null))
const done = computed(() => used.value.filter((r) => props.ticks[r.ch]).length)
const offBand = computed(() => used.value.filter((r) => r.r && r.r.band !== 'on').length)
const anyEstimate = computed(() => used.value.some((r) => r.r?.estimate))
const list = (rs: { ch: number }[]) => rs.map((r) => `CH${r.ch + 1}`).join(', ')
// Which measurements the distances use: yours, typical, or a mix.
const headText = computed(() => {
  const h = headInUse()
  const own = (Object.keys(HEAD_LABELS) as HeadKey[]).filter((k) => !h.defaulted.includes(k))
  const part = (ks: HeadKey[]) => ks.map((k) => `${h[k]} cm ${HEAD_LABELS[k]}`).join(', ')
  if (!own.length) return { warn: true, text: `Distances are for a typical adult head (${part(h.defaulted)}).`, btn: 'Measure yours' }
  if (h.defaulted.length) return { warn: true, text: `Distances use your ${part(own)}; ${part(h.defaulted)} is a typical value.`, btn: 'Finish measuring' }
  return { warn: false, text: `Distances for your head: ${part(own)}.`, btn: 'Change' }
})
const offText = computed(() => {
  const n = offBand.value
  const all = n === used.value.length
  const who = n === 1 ? (all ? 'The coil sits' : '1 coil sits') : all ? `All ${n} coils sit` : `${n} of ${used.value.length} coils sit`
  return `${who} off the band line: hold ${n === 1 ? 'it' : 'them'} with a second strap or a snug cap, and check that each coil face lies flat on the scalp.`
})
// Coils on or against the ear cannot lie flat.
const EAR_SITES = ['T9h', 'T10h', 'TTP9', 'TTP10', 'TTP9h', 'TTP10h', 'T9', 'T10']
const onEar = computed(() => used.value.filter((r) => EAR_SITES.includes(r.name)).map((r) => r.name))
const unusedText = computed(() => {
  const n = unused.value.length
  if (used.value.length === 1) return `Only CH${used.value[0]!.ch + 1} is used; the others stay silent.`
  return `${list(unused.value)} ${n === 1 ? 'is' : 'are'} not used by this placement and stay${n === 1 ? 's' : ''} silent.`
})

const open = reactive<Record<number, boolean>>({})
const hasMore = (r: Row) => !!(r.r?.detail || r.under)
const shows = (r: Row) => placementState.details || open[r.ch]

const listEl = ref<HTMLElement>()
async function onReset() {
  if (!done.value) return
  emit('reset')
  await nextTick()
  listEl.value?.querySelector<HTMLInputElement>('input[type=checkbox]')?.focus()
}
// From the map: bring a coil's row into view and put the keyboard on its tick box.
function show(ch: number) {
  const el = listEl.value?.querySelector<HTMLElement>(`#coil-row-${ch}`)
  el?.scrollIntoView({ behavior: smooth(), block: 'center' })
  el?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
}
defineExpose({ show })
</script>

<template>
  <div class="grid min-w-0 content-start gap-3">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 class="text-xl">Coils</h3>
        <p class="text-sm text-muted">Tick each coil when it sits on its site.</p>
      </div>
      <div class="flex items-center gap-2.5 text-sm">
        <span class="num" role="status"><b class="text-highlighted">{{ done }}</b> / {{ used.length }} placed</span>
        <UProgress :model-value="done" :max="Math.max(1, used.length)" color="success" size="sm" class="w-24" aria-hidden="true" />
        <UButton variant="link" color="primary" size="sm" class="px-0" :class="{ 'cursor-default opacity-45': !done }" :aria-disabled="!done" @click="onReset">Reset</UButton>
      </div>
    </div>
    <UButton variant="link" color="primary" size="sm" class="justify-self-start px-0 text-left" :aria-pressed="placementState.details" @click="placementState.details = !placementState.details">
      {{ placementState.details ? 'Hide the details' : 'Show the measuring details and what lies under each coil' }}
    </UButton>

    <ol ref="listEl" class="m-0 grid list-none gap-2 p-0">
      <li v-for="r in used" :id="`coil-row-${r.ch}`" :key="r.ch" class="coil-row" :class="{ 'is-done': ticks[r.ch], 'is-focus': focus === r.ch }"
        @mouseenter="emit('focus', r.ch)" @mouseleave="emit('focus', null)" @focusin="emit('focus', r.ch)" @focusout="emit('focus', null)">
        <label class="tick">
          <input type="checkbox" :checked="ticks[r.ch]" :aria-label="`Coil ${r.ch + 1} placed at ${r.name}`" @change="emit('toggle', r.ch)">
          <span class="disc num" aria-hidden="true">{{ r.ch + 1 }}</span>
          <UIcon v-if="ticks[r.ch]" name="i-lucide-check" class="check" aria-hidden="true" />
        </label>
        <div class="grid min-w-0 gap-1">
          <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <button type="button" class="site-name num" :title="`More about ${r.name}`" @click="emit('site', r.name)">{{ r.name }}</button>
            <span class="text-sm text-muted">{{ r.where }}</span>
            <UBadge v-if="r.band" variant="outline" :color="r.r?.band === 'on' ? 'info' : 'warning'" class="rounded-full whitespace-nowrap min-[521px]:ml-auto">{{ r.band }}</UBadge>
          </div>
          <p v-if="r.r" class="max-w-[70ch] text-[0.92rem] leading-snug text-highlighted">
            <span v-if="r.r.estimate" class="mr-1 font-bold text-warning" title="Scaled from the template head">≈</span>{{ r.r.text }}
          </p>
          <template v-if="shows(r)">
            <p v-if="r.r?.detail" class="max-w-[70ch] text-sm leading-snug text-muted">{{ r.r.detail }}</p>
            <p v-if="r.under" class="text-sm leading-snug text-muted [overflow-wrap:anywhere]">{{ r.under }}</p>
          </template>
          <UButton v-if="hasMore(r) && !placementState.details" variant="link" color="primary" size="sm" class="justify-self-start px-0 py-0.5" :aria-expanded="!!open[r.ch]" @click="open[r.ch] = !open[r.ch]">
            {{ open[r.ch] ? 'Less' : 'More' }}
          </UButton>
        </div>
      </li>
    </ol>

    <p v-if="unused.length" class="text-sm leading-snug text-muted">{{ unusedText }}</p>
    <p v-if="offBand" class="note">{{ offText }}</p>
    <p v-if="onEar.length" class="note">{{ onEar.join(', ') }} {{ onEar.length === 1 ? 'is' : 'are' }} at or on the ear, so the coil cannot lie quite flat: tilt it, or fold the ear forward under it.</p>

    <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm">
      <span :class="headText.warn ? 'text-warning' : 'text-muted'">{{ headText.text }}</span>
      <UButton variant="link" color="primary" size="sm" class="px-0 py-0" @click="emit('measure')">{{ headText.btn }}</UButton>
      <span v-if="anyEstimate" class="text-muted"><span class="font-bold text-warning">≈</span> = scaled from the template head; measure between the two named sites for accuracy.</span>
    </div>
  </div>
</template>

<style scoped>
/* The tick box is the coil's numbered disc, as on the map. */
.coil-row { display: grid; grid-template-columns: 2.75rem minmax(0, 1fr); gap: 0.6rem; align-items: start; padding: 0.6rem 0.75rem 0.6rem 0.5rem; border: 1px solid var(--line); border-radius: calc(var(--ui-radius) * 2); transition: border-color 0.15s, background-color 0.15s; }
.coil-row.is-focus { border-color: var(--accent); }
.coil-row.is-done { background: color-mix(in srgb, var(--ok) 8%, transparent); border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
.tick { position: relative; display: grid; place-items: center; width: 2.75rem; height: 2.75rem; cursor: pointer; }
.tick input { position: absolute; inset: 0; opacity: 0; margin: 0; width: 100%; height: 100%; cursor: pointer; }
.disc { width: 2.125rem; height: 2.125rem; border-radius: 50%; display: grid; place-items: center; font-size: 1.05rem; font-weight: 700; border: 2px solid var(--accent); color: var(--text); background: var(--accent-soft); }
.is-done .disc { background: var(--ok); border-color: var(--ok); color: var(--bg); }
.check { position: absolute; right: 0; bottom: 0; width: 1rem; height: 1rem; padding: 1px; border-radius: 50%; background: var(--bg); color: var(--ok); border: 1px solid var(--ok); pointer-events: none; }
.tick input:focus-visible + .disc { outline: 2px solid var(--accent); outline-offset: 2px; }
.site-name { font-size: 1.375rem; line-height: 1.1; font-weight: 600; color: var(--text); cursor: pointer; text-decoration: underline dotted var(--muted); text-underline-offset: 4px; }
.site-name:hover { color: var(--accent); }
.note { font-size: 0.875rem; line-height: 1.45; color: var(--text); padding: 0.5rem 0.65rem; border-left: 3px solid var(--warn); background: var(--surface); border-radius: 0 calc(var(--ui-radius) * 1.5) calc(var(--ui-radius) * 1.5) 0; }
@media (max-width: 520px) {
  .site-name { font-size: 1.25rem; }
}
</style>
