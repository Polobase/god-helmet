<script setup>
// Guides tab: library (#guides), detail (#guides/<id>), runner and past runs.
import { computed, nextTick, onMounted, ref, watch } from 'vue'
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
const query = ref('')
const category = ref('')
const onlyHeadphones = ref(false)
const onlyHelmet = ref(false)
const usesHelmet = (d) => (d.requires?.helmet ?? 'none') !== 'none'
const matches = (d, q) => !q || `${d.name ?? ''} ${d.summary ?? ''}`.toLowerCase().includes(q)

const categories = computed(() => Object.keys(CATEGORY_LABELS).filter((k) => guides.some((g) => docOf(g).category === k)))
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return guides.filter((g) => {
    const d = docOf(g)
    return (!category.value || d.category === category.value) && (!onlyHeadphones.value || d.requires?.headphones) && (!onlyHelmet.value || usesHelmet(d)) && matches(d, q)
  })
})
const anyFilter = computed(() => !!query.value.trim() || !!category.value || onlyHeadphones.value || onlyHelmet.value)
function clearFilters() {
  query.value = ''
  category.value = ''
  onlyHeadphones.value = false
  onlyHelmet.value = false
}
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
// Open a guide at its top, and come back to the same place in the list.
// scrollY is read here (pre-flush), before the list is swapped out.
let listY = 0
watch(() => nav.arg, (arg, prev) => {
  starting.value = false
  // an active run keeps the screen: do not jump to the saved list position
  if (nav.tab !== 'guides' || live.phase !== 'idle') return
  if (!prev) listY = window.scrollY
  nextTick(() => window.scrollTo({ top: arg ? 0 : listY }))
})
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
const past = ref(null)
const toPast = () => past.value?.$el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
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
      <div class="row between">
        <h2>Guides</h2>
        <button v-if="runs.length" type="button" class="btn ghost sm" @click="toPast">Your past runs ({{ runs.length }}) ↓</button>
      </div>
      <p class="small">Timed, step-by-step sessions with spoken-style instructions, optional beat audio, an optional blinded helmet program and built-in inputs. Every run is stored on this phone and can be exported.</p>
      <p v-if="nav.arg && !selected" class="small warn">No guide called “{{ nav.arg }}”.</p>
      <input v-model="query" type="search" placeholder="Search by name or description" aria-label="Search guides" />
      <div class="filters" role="group" aria-label="Category">
        <button type="button" class="chip" :class="{ on: !category }" :aria-pressed="!category" @click="category = ''">All</button>
        <button v-for="c in categories" :key="c" type="button" class="chip" :class="{ on: category === c }" :aria-pressed="category === c" @click="category = category === c ? '' : c">{{ CATEGORY_LABELS[c] }}</button>
      </div>
      <div class="filters" role="group" aria-label="Requirements">
        <span class="small muted">Show only:</span>
        <button type="button" class="chip toggle" :class="{ on: onlyHeadphones }" :aria-pressed="onlyHeadphones" @click="onlyHeadphones = !onlyHeadphones"><span v-if="onlyHeadphones" aria-hidden="true">✓</span>Needs headphones</button>
        <button type="button" class="chip toggle" :class="{ on: onlyHelmet }" :aria-pressed="onlyHelmet" @click="onlyHelmet = !onlyHelmet"><span v-if="onlyHelmet" aria-hidden="true">✓</span>Uses the helmet</button>
      </div>
      <p v-if="guides.length" class="row small muted">
        <span aria-live="polite">{{ filtered.length }} of {{ guides.length }} guides</span>
        <button v-if="anyFilter" type="button" class="btn ghost sm" @click="clearFilters">Clear filters</button>
      </p>
    </header>

    <p v-if="!guides.length" class="card small muted">No guides found (guides/*.json).</p>
    <div v-else-if="!groups.length" class="card small muted">
      <p>No guide matches these filters.</p>
      <div><button type="button" class="btn sm" @click="clearFilters">Clear filters</button></div>
    </div>

    <section v-for="g in groups" :key="g.key" class="group" :aria-label="g.label">
      <h3 class="eyebrow">{{ g.label }}</h3>
      <div class="cards">
        <a v-for="item in g.items" :key="docOf(item).id" class="gcard" :href="`#guides/${encodeURIComponent(docOf(item).id)}`">
          <span class="head">
            <span class="name">{{ docOf(item).name }}</span>
            <span v-if="docOf(item).summary" class="sum small muted">{{ docOf(item).summary }}</span>
          </span>
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
    <RunList ref="past" class="past" :runs="runs" @changed="loadRuns" />
  </div>
</template>

<style scoped>
.between { justify-content: space-between; }
.filters { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.filters .chip { cursor: pointer; padding: 6px 12px; font-size: 13px; background: transparent; }
.filters .chip.on { background: var(--accent); }
.filters .chip.toggle.on { background: transparent; border-color: var(--accent); color: var(--accent); }
.group { display: grid; gap: 8px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.gcard { display: grid; grid-template-rows: 1fr auto; align-items: start; gap: 8px; padding: 14px; border-radius: var(--radius); border: 1px solid var(--line); background: var(--surface); color: var(--text); text-decoration: none; min-width: 0; }
.gcard:hover { border-color: var(--accent); }
.head { display: grid; gap: 4px; }
.name { font: 600 19px var(--font-display); letter-spacing: .02em; }
.sum { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.past { scroll-margin-top: 110px; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
</style>
