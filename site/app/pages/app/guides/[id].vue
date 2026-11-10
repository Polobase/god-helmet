<script setup lang="ts">
// One guide: its detail, the set-up after Start, and its runner while it runs.
// The run lives in lib/guideRun.ts, so it carries on when this page is left;
// coming back here shows the runner again.
import { live } from '~/lib/guideRun'
import { guideById, guideLibrary, listRuns, type RunRecord } from '~/lib/guides'

const route = useRoute()
const id = computed(() => String(route.params.id))

// The route names the guide; an unknown name goes back to the library, which says so.
const toLibrary = (missing: string) => navigateTo({ path: '/app/guides', query: { missing } }, { replace: true })
if (!guideById(id.value)) await toLibrary(id.value)
const entry = computed(() => guideById(id.value) ?? null)
useHead({ title: () => entry.value?.doc.name ?? 'Guides' })

// Set-up of this guide (after Start, before Begin).
const starting = ref(false)
const headphones = ref(false)
watch(id, (v) => {
  starting.value = false
  if (!guideById(v)) toLibrary(v)
})
// This guide's run, from Begin to Done.
const running = computed(() => live.phase !== 'idle' && live.guide?.id === id.value)

function start({ headphones: h }: { headphones: boolean }) {
  headphones.value = !!h
  starting.value = true
  window.scrollTo({ top: 0 })
}

// ---- this guide's past runs
const runs = ref<RunRecord[]>([])
async function loadRuns() {
  try {
    runs.value = await listRuns()
  } catch {
    runs.value = [] // the library says why past runs are unavailable
  }
}
onMounted(loadRuns)
watch(() => live.phase, (p) => (p === 'idle' || p === 'summary') && loadRuns())
// Not the run that is going or whose summary is still open: that one belongs to the runner.
const runsOfGuide = computed(() => runs.value.filter((r) => r.guideId === id.value && (live.phase === 'idle' || r.id !== live.record?.id)))

function exitRunner() {
  starting.value = false
  loadRuns()
}
// Tells the library to return to where its list was.
onBeforeRouteLeave((to) => {
  guideLibrary.back = to.path === '/app/guides'
})
</script>

<template>
  <div>
    <!-- a run of this guide takes the page -->
    <GuideRunner v-if="running && live.guide" :guide="live.guide" @exit="exitRunner" />

    <GuideRunner v-else-if="entry && starting" :guide="entry.doc" :headphones="headphones" @exit="exitRunner" />

    <GuideDetail v-else-if="entry" :entry="entry" @start="start">
      <GuideRunList v-if="runsOfGuide.length" :runs="runsOfGuide" title="Your runs of this guide" @changed="loadRuns" />
    </GuideDetail>
  </div>
</template>
