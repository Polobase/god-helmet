<script setup>
// Guides tab: library (#guides), detail (#guides/<id>), runner and past runs.
import { computed, onMounted, ref, watch } from 'vue'
import { nav, go } from '../lib/nav.js'
import { guides, guideById, CATEGORY_LABELS } from '../lib/guides.js'
import { listRuns } from '../lib/runs.js'
import GuideRunner, { live } from '../components/guide/GuideRunner.vue'
import GuideDetail from '../components/guide/GuideDetail.vue'
import RunList from '../components/guide/RunList.vue'
import EvidenceChip from '../components/guide/EvidenceChip.vue'
import ReqIcons from '../components/guide/ReqIcons.vue'

const docOf = (g) => g?.doc ?? g
const entryOf = (g) => (g ? (g.doc ? g : { doc: g, errors: [] }) : null)

// ---- library and filters
const category = ref('')
const onlyHeadphones = ref(false)
const onlyHelmet = ref(false)
const usesHelmet = (d) => (d.requires?.helmet ?? 'none') !== 'none'

const categories = computed(() => Object.keys(CATEGORY_LABELS).filter((k) => guides.some((g) => docOf(g).category === k)))
const filtered = computed(() => guides.filter((g) => {
  const d = docOf(g)
  return (!category.value || d.category === category.value) && (!onlyHeadphones.value || d.requires?.headphones) && (!onlyHelmet.value || usesHelmet(d))
}))
const groups = computed(() => {
  const out = []
  for (const g of filtered.value) {
    const key = docOf(g).category || 'other'
    let grp = out.find((x) => x.key === key)
    if (!grp) out.push((grp = { key, label: CATEGORY_LABELS[key] ?? key, items: [] }))
    grp.items.push(g)
  }
  return out
})

// ---- route
const selected = computed(() => (nav.arg ? entryOf(guideById(nav.arg)) : null))
const starting = ref(false)
const headphones = ref(false)
watch(() => nav.arg, () => (starting.value = false))
const active = computed(() => live.phase !== 'idle')

function start({ headphones: h }) {
  headphones.value = !!h
  starting.value = true
  window.scrollTo({ top: 0 })
}

// ---- past runs
const runs = ref([])
const runsError = ref('')
async function loadRuns() {
  try {
    runs.value = await listRuns()
    runsError.value = ''
  } catch (e) {
    runsError.value = `Past runs unavailable: ${e.message}`
  }
}
onMounted(loadRuns)
watch(() => live.phase, (p) => (p === 'idle' || p === 'summary') && loadRuns())
const runsOfSelected = computed(() => (selected.value ? runs.value.filter((r) => r.guideId === selected.value.doc.id) : []))

function exitRunner() {
  starting.value = false
  loadRuns()
}
</script>

<template>
  <!-- an active run always takes the screen, whatever the route -->
  <GuideRunner v-if="active" :guide="live.guide" @exit="exitRunner" />

  <GuideRunner v-else-if="selected && starting" :guide="selected.doc" :headphones="headphones" @exit="exitRunner" />

  <GuideDetail v-else-if="selected" :entry="selected" @start="start" @back="go('guides')">
    <RunList v-if="runsOfSelected.length" :runs="runsOfSelected" title="Your runs of this guide" @changed="loadRuns" />
  </GuideDetail>

  <div v-else class="page">
    <header class="card">
      <span class="eyebrow">Guided sessions</span>
      <h2>Guides</h2>
      <p class="small">Timed, step-by-step sessions with spoken-style instructions, optional beat audio, an optional blinded helmet program and built-in inputs. Every run is stored on this phone and can be exported.</p>
      <p v-if="nav.arg && !selected" class="small warn">No guide called “{{ nav.arg }}”.</p>
      <div class="filters" role="group" aria-label="Filter guides">
        <button type="button" class="chip" :class="{ on: !category }" :aria-pressed="!category" @click="category = ''">All</button>
        <button v-for="c in categories" :key="c" type="button" class="chip" :class="{ on: category === c }" :aria-pressed="category === c" @click="category = category === c ? '' : c">{{ CATEGORY_LABELS[c] }}</button>
        <button type="button" class="chip" :class="{ on: onlyHeadphones }" :aria-pressed="onlyHeadphones" @click="onlyHeadphones = !onlyHeadphones">Needs headphones</button>
        <button type="button" class="chip" :class="{ on: onlyHelmet }" :aria-pressed="onlyHelmet" @click="onlyHelmet = !onlyHelmet">Uses the helmet</button>
      </div>
    </header>

    <p v-if="!guides.length" class="card small muted">No guides found (guides/*.json).</p>
    <p v-else-if="!groups.length" class="card small muted">No guide matches these filters.</p>

    <section v-for="g in groups" :key="g.key" class="group" :aria-label="g.label">
      <h3 class="eyebrow">{{ g.label }}</h3>
      <div class="cards">
        <a v-for="item in g.items" :key="docOf(item).id" class="gcard" :href="`#guides/${encodeURIComponent(docOf(item).id)}`">
          <span class="name">{{ docOf(item).name }}</span>
          <span class="meta">
            <span class="small muted num">{{ docOf(item).minutes ?? '–' }} min</span>
            <EvidenceChip :level="docOf(item).evidence" />
            <ReqIcons :requires="docOf(item).requires" />
          </span>
          <span v-if="item.errors?.length" class="small bad">Invalid guide file</span>
        </a>
      </div>
    </section>

    <p v-if="runsError" class="card small bad">{{ runsError }}</p>
    <RunList :runs="runs" @changed="loadRuns" />
  </div>
</template>

<style scoped>
.filters { display: flex; flex-wrap: wrap; gap: 6px; }
.filters .chip { cursor: pointer; padding: 6px 12px; font-size: 13px; background: transparent; }
.filters .chip.on { background: var(--accent); }
.group { display: grid; gap: 8px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.gcard { display: grid; gap: 8px; padding: 14px; border-radius: var(--radius); border: 1px solid var(--line); background: var(--surface); color: var(--text); text-decoration: none; min-width: 0; }
.gcard:hover { border-color: var(--accent); }
.name { font: 600 19px var(--font-display); letter-spacing: .02em; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
</style>
