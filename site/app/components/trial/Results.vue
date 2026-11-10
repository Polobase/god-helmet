<script setup lang="ts">
// Results of the series: hits against chance for all revealed trials and per
// condition, and every trial in a list that opens it.
import { fmtDate } from '#core/lib/format.js'
import { summarise, isArvTrial, type Trial, type ArvTrial, type TrialSummary } from '~/lib/trials'

const props = defineProps<{
  trials: Trial[]
  /** ARV trials from Guides: their rank means "predicted outcome A", not a hit, so they are left out. */
  arv: ArvTrial[]
  loading: boolean
  /** The open trial, marked in the list. */
  currentId?: number
}>()
const emit = defineEmits<{ pick: [trial: Trial], export: [] }>()

const arvCount = computed(() => props.trials.filter((t) => isArvTrial(props.arv, t)).length)
const stats = computed(() => {
  const revealed = props.trials.filter((t) => t.state === 'revealed' && !isArvTrial(props.arv, t))
  const groups: [string, Trial[]][] = [
    ['All revealed', revealed],
    ['Active field', revealed.filter((t) => t.condition === 'active')],
    ['Sham', revealed.filter((t) => t.condition === 'sham')],
    ['No stimulation', revealed.filter((t) => t.condition === 'none')],
  ]
  return groups.map(([label, list]) => ({ label, s: summarise(list) })).filter((r): r is { label: string, s: TrialSummary } => !!r.s)
})
const overview = computed(() => {
  const s = stats.value[0]?.s
  if (!s) return null
  return { s, verdict: s.pHits < 0.05 ? 'That is more than chance usually gives (p < 0.05).' : 'That is still within what chance alone gives.' }
})
</script>

<template>
  <section class="panel grid grid-cols-1 gap-4 p-5 sm:p-7" aria-labelledby="trial-results">
    <h2 id="trial-results" class="text-2xl">Results</h2>
    <p v-if="overview" class="measure" data-test="overview"><b class="text-highlighted">{{ overview.s.hits }} first-place hit(s) in {{ overview.s.n }} revealed trial(s).</b> Chance alone would give about {{ overview.s.expected.toFixed(1) }}. {{ overview.verdict }}</p>

    <div v-if="stats.length" class="sheet">
      <table data-test="stats">
        <thead>
          <tr>
            <th><span class="sr-only">Trials</span></th>
            <th class="r">N</th>
            <th class="r" title="Trials where the target got rank 1, with the number chance would give">Hits</th>
            <th class="r" title="Chance of at least this many hits if the target is just guessed">p</th>
            <th class="r">Mean rank</th>
            <th class="r" title="How much better than average the target was ranked, in standard deviations; with its p-value">Rank z</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in stats" :key="r.label">
            <th scope="row">{{ r.label }}</th>
            <td class="r num">{{ r.s.n }}</td>
            <td class="r num">{{ r.s.hits }}<br><span class="sub">exp. {{ r.s.expected.toFixed(1) }}</span></td>
            <td class="r num">{{ r.s.pHits.toFixed(3) }}</td>
            <td class="r num">{{ r.s.meanRank.toFixed(2) }}</td>
            <td class="r num">{{ r.s.z.toFixed(2) }}<br><span class="sub">p {{ r.s.pZ.toFixed(3) }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="text-sm text-muted">No revealed trials yet.</p>

    <p v-if="arvCount" class="measure text-sm text-muted">{{ arvCount }} associative remote-viewing trial(s) from Guides are left out: their result is scored in the guide's run summary.</p>
    <p class="measure text-sm text-muted">One-sided p-values against chance. With 30 trials at 5 pictures, chance gives about 6 hits; about 11 are needed for p &lt; 0.05. A real effect of the field shows as active better than sham.</p>

    <template v-if="trials.length">
      <p class="text-sm text-muted">Tap a row to open that trial.</p>
      <div class="sheet">
        <table data-test="trial-list">
          <thead>
            <tr><th class="r">#</th><th>When</th><th class="max-sm:hidden">Mode</th><th>State</th><th>Condition</th><th class="r">Rank</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in trials" :key="t.id" class="pickable" :class="{ on: currentId === t.id }" tabindex="0" :aria-current="currentId === t.id ? 'true' : undefined"
              @click="emit('pick', t)" @keydown.enter="emit('pick', t)">
              <td class="r num">{{ t.id }}</td>
              <td class="sm:whitespace-nowrap">{{ fmtDate(t.created) }}</td>
              <td class="max-sm:hidden">{{ t.mode }}</td>
              <td>{{ t.state }}</td>
              <td>{{ t.condition }}</td>
              <td class="r num">{{ t.state === 'revealed' ? `${t.targetRank}/${t.setSize}` : '–' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <p v-if="loading" class="text-sm text-muted">Loading trials…</p>
    <div v-if="trials.length"><UButton size="sm" icon="i-lucide-download" @click="emit('export')">Export trials (for tools/trial_stats.py)</UButton></div>
  </section>
</template>

<style scoped>
.sheet { overflow-x: auto; border: 1px solid var(--ui-border); border-radius: calc(var(--ui-radius) * 2); }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th, td { padding: 0.55rem 0.8rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--ui-border); }
tbody tr:last-child > * { border-bottom: 0; }
thead th { font-weight: 600; color: var(--ui-text-muted); background: var(--ui-bg-muted); white-space: nowrap; }
thead th[title] { text-decoration: underline dotted; text-underline-offset: 0.25em; cursor: help; }
tbody th { font-weight: 600; color: var(--ui-text-highlighted); }
.r { text-align: right; white-space: nowrap; }
.sub { color: var(--ui-text-muted); font-size: 0.8rem; }
.pickable { cursor: pointer; }
.pickable:hover td, .pickable.on td { background: var(--accent-soft); }
.pickable:focus-visible { outline-offset: -2px; }
/* A phone shows every column without scrolling sideways; the sheet still scrolls if it must. */
@media (max-width: 640px) {
  table { font-size: 0.8rem; }
  th, td { padding: 0.5rem 0.25rem; }
  th:first-child, td:first-child { padding-left: 0.6rem; }
  th:last-child, td:last-child { padding-right: 0.6rem; }
  .sub { font-size: 0.75rem; }
  thead th, thead th.r { white-space: normal; vertical-align: bottom; }
}
</style>
