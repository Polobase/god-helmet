<script setup lang="ts">
// Guides: the library of guided sessions, and the runs done so far.
// A guide opens at /app/guides/<id>, where it also runs.
import { errorMessage } from '~/lib/device'
import { live, armRunning, stopLeftover } from '~/lib/guideRun'
import { presetById } from '~/lib/programs'
import { guideMark } from '~/lib/art'
import { guides, CATEGORY_LABELS, guideLibrary as lib, guidePath, listRuns, type GuideDoc, type GuideEntry, type RunRecord } from '~/lib/guides'

definePageMeta({
  // Back from a guide, the list returns to where it was (below), not to the top.
  scrollToTop: (_to, from) => !from.path.startsWith('/app/guides/'),
})
useHead({ title: 'Guides' })

const route = useRoute()
const missing = computed(() => (typeof route.query.missing === 'string' ? route.query.missing : ''))

// ---- library and filters
const usesHelmet = (d: GuideDoc) => (d.requires?.helmet ?? 'none') !== 'none'
const matches = (d: GuideDoc, q: string) => !q || `${d.name ?? ''} ${d.summary ?? ''}`.toLowerCase().includes(q)

const categories = computed(() => Object.keys(CATEGORY_LABELS).filter((k) => guides.some((g) => g.doc.category === k)))
const filtered = computed(() => {
  const q = lib.query.trim().toLowerCase()
  return guides.filter(({ doc: d }) => (!lib.category || d.category === lib.category) && (!lib.onlyHeadphones || d.requires?.headphones) && (!lib.onlyHelmet || usesHelmet(d)) && matches(d, q))
})
const anyFilter = computed(() => !!lib.query.trim() || !!lib.category || lib.onlyHeadphones || lib.onlyHelmet)
function clearFilters() {
  lib.query = ''
  lib.category = ''
  lib.onlyHeadphones = false
  lib.onlyHelmet = false
}
const groups = computed(() => {
  const out: { key: string, label: string, items: GuideEntry[] }[] = []
  for (const g of filtered.value) {
    const key = g.doc.category || 'other'
    let grp = out.find((x) => x.key === key)
    if (!grp) out.push((grp = { key, label: CATEGORY_LABELS[key] ?? key, items: [] }))
    grp.items.push(g)
  }
  return out
})

// ---- a run in progress (it has its guide's page; this one leads back to it)
const run = computed(() => (live.phase !== 'idle' && live.guide ? live.guide : null))
const runTitle = computed(() => (!run.value ? '' : live.phase === 'summary' ? `“${run.value.name}” has ended` : live.phase === 'starting' ? `“${run.value.name}” is starting` : `“${run.value.name}” is ${live.paused ? 'paused' : 'running'}`))
const runNote = computed(() => (!run.value ? '' : live.phase === 'summary'
  ? 'Its summary is open: rate the session there, then press Done.'
  : `Step ${live.index + 1} of ${run.value.steps.length}: ${run.value.steps[live.index]?.title ?? ''}. Sound, timer and helmet carry on while you are on another page.`))

// ---- past runs
const stored = ref<RunRecord[]>([])
// The run that is going, or whose summary is still open, belongs to the runner:
// listed here, it could be rated and revealed (or deleted) behind the runner's back.
const runs = computed(() => stored.value.filter((r) => live.phase === 'idle' || r.id !== live.record?.id))
const runsError = ref('')
async function loadRuns() {
  try {
    stored.value = await listRuns()
    runsError.value = ''
  } catch (e) {
    runsError.value = `Past runs unavailable: ${errorMessage(e)}`
  }
}
// A run that was cut off (the page was reloaded or closed) whose helmet program
// is still running: the same helmet, the same start of it, the session with
// the run's token. It can be stopped from here.
const leftover = computed(() => stored.value.find((r) => r.id !== live.record?.id && armRunning(r.helmet)) ?? null)
const leftoverName = computed(() => (leftover.value ? presetById(leftover.value.helmet.presetId)?.doc.name ?? leftover.value.helmet.presetId : ''))
const stopping = ref(false)
const stopError = ref('')
async function stopIt() {
  if (!leftover.value || stopping.value) return
  stopping.value = true
  stopError.value = ''
  try {
    await stopLeftover(leftover.value)
    await loadRuns()
  } catch (e) {
    stopError.value = `Stop did not reach the helmet: ${errorMessage(e)}`
  } finally {
    stopping.value = false
  }
}
const past = ref<{ $el?: HTMLElement } | null>(null)
const toPast = () => past.value?.$el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
watch(() => live.phase, (p) => (p === 'idle' || p === 'summary') && loadRuns())

// Come back from a guide to the same place in the list; a run in progress is shown at the top instead.
const returning = lib.back
lib.back = false
onMounted(async () => {
  loadRuns()
  if (!returning) return
  await nextTick()
  window.scrollTo({ top: live.phase === 'idle' ? lib.y : 0 })
})
onBeforeRouteLeave(() => {
  lib.y = window.scrollY
})
</script>

<template>
  <div class="grid gap-5">
    <UAlert v-if="run" color="primary" variant="subtle" :icon="live.phase === 'summary' ? 'i-lucide-flag' : live.paused ? 'i-lucide-circle-pause' : 'i-lucide-circle-play'" role="status"
      :title="runTitle" :description="runNote"
      :actions="[{ label: live.phase === 'summary' ? 'Open the summary' : 'Back to the guide', to: guidePath(run.id), color: 'primary', variant: 'solid' }]" />

    <UAlert v-if="leftover" color="warning" variant="subtle" icon="i-lucide-triangle-alert" role="status" data-test="leftover-arm"
      :title="`“${leftoverName}” is still running on the helmet`"
      :description="`It was started by the guide “${leftover.guideName || leftover.guideId}”, whose run was cut off (the page was reloaded or closed). It runs on to its own end unless you stop it.${stopError ? ` ${stopError}` : ''}`"
      :actions="[{ label: 'Stop it', color: 'error', variant: 'solid', loading: stopping, onClick: stopIt }]" />

    <header class="grid gap-4">
      <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <p class="text-sm text-muted">Guided sessions</p>
          <h1 class="mt-1 text-4xl">Guides</h1>
        </div>
        <UButton v-if="runs.length" size="sm" variant="ghost" trailing-icon="i-lucide-arrow-down" @click="toPast">Your past runs ({{ runs.length }})</UButton>
      </div>
      <p class="measure text-sm text-muted">Timed, step-by-step sessions with spoken-style instructions, optional beat audio, an optional blinded helmet program and built-in inputs. Every run is stored on this phone and can be exported.</p>
      <UAlert v-if="missing" color="warning" variant="subtle" icon="i-lucide-search-x" :title="`No guide called “${missing}”.`" role="status" />

      <UInput v-model="lib.query" type="search" icon="i-lucide-search" size="lg" class="w-full max-w-2xl" placeholder="Search by name or description" aria-label="Search guides" />

      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Category">
        <UButton size="xs" class="rounded-full" :variant="!lib.category ? 'soft' : 'outline'" :color="!lib.category ? 'primary' : 'neutral'" :aria-pressed="!lib.category" @click="lib.category = ''">All</UButton>
        <UButton v-for="c in categories" :key="c" size="xs" class="rounded-full" :variant="lib.category === c ? 'soft' : 'outline'" :color="lib.category === c ? 'primary' : 'neutral'" :aria-pressed="lib.category === c" @click="lib.category = lib.category === c ? '' : c">
          {{ CATEGORY_LABELS[c] }}
        </UButton>
      </div>
      <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Requirements">
        <span class="mr-1 text-sm text-muted">Show only:</span>
        <UButton size="xs" class="rounded-full" :variant="lib.onlyHeadphones ? 'soft' : 'outline'" :color="lib.onlyHeadphones ? 'primary' : 'neutral'" :icon="lib.onlyHeadphones ? 'i-lucide-check' : undefined" :aria-pressed="lib.onlyHeadphones" @click="lib.onlyHeadphones = !lib.onlyHeadphones">Needs headphones</UButton>
        <UButton size="xs" class="rounded-full" :variant="lib.onlyHelmet ? 'soft' : 'outline'" :color="lib.onlyHelmet ? 'primary' : 'neutral'" :icon="lib.onlyHelmet ? 'i-lucide-check' : undefined" :aria-pressed="lib.onlyHelmet" @click="lib.onlyHelmet = !lib.onlyHelmet">Uses the helmet</UButton>
      </div>
      <p v-if="guides.length" class="flex flex-wrap items-center gap-3 text-sm text-muted">
        <span class="num" aria-live="polite">{{ filtered.length }} of {{ guides.length }} guides</span>
        <UButton v-if="anyFilter" size="xs" variant="ghost" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
      </p>
    </header>

    <UEmpty v-if="!guides.length" icon="i-lucide-folder-x" title="No guides found" description="The guide files (guides/*.json) are missing from this build." />
    <UEmpty v-else-if="!groups.length" icon="i-lucide-search-x" title="No guide matches these filters." :actions="[{ label: 'Clear filters', onClick: clearFilters }]" />

    <section v-for="g in groups" :key="g.key" class="grid gap-3" :aria-label="g.label">
      <h2 class="flex items-center gap-3 border-b border-default pb-2 text-xl">
        <ArtMark v-if="guideMark(g.key)" :name="guideMark(g.key)!" class="w-10 shrink-0 text-toned" />
        <span>{{ g.label }} <span class="num font-sans text-sm font-normal text-muted">{{ g.items.length }}</span></span>
      </h2>
      <div class="cards">
        <NuxtLink v-for="{ doc, errors } in g.items" :key="doc.id" :to="guidePath(doc.id)" class="panel flex min-w-0 flex-col gap-2.5 p-4 transition-colors hover:border-accented hover:bg-elevated/40"
          :class="{ 'border-primary! ring-1 ring-primary': run?.id === doc.id }" :aria-current="run?.id === doc.id ? 'true' : undefined">
          <span class="font-display text-[1.15rem] font-[620] leading-tight text-highlighted [overflow-wrap:anywhere]">{{ doc.name }}</span>
          <span v-if="doc.summary" class="line-clamp-2 text-sm text-muted">{{ doc.summary }}</span>
          <span class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-muted">
            <span><b class="num font-display text-base font-[620] text-highlighted">{{ doc.minutes ?? '–' }}</b> min</span>
            <EvidenceBadge :level="doc.evidence" />
            <GuideReqIcons :requires="doc.requires" />
          </span>
          <span v-if="errors?.length" class="text-sm text-error">Invalid guide file</span>
        </NuxtLink>
      </div>
    </section>

    <UAlert v-if="runsError" color="error" variant="subtle" icon="i-lucide-database" :title="runsError" />
    <GuideRunList ref="past" class="past" :runs="runs" @changed="loadRuns" />
  </div>
</template>

<style scoped>
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(17.5rem, 1fr)); gap: 0.75rem; }
.past { scroll-margin-top: calc(var(--header-h, 3.75rem) + 1rem); }
</style>
