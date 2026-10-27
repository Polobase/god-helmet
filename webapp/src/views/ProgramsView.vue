<script setup>
// Program library: placement, phases, waveforms, an in-browser preview of the
// coil activity, sources, and the start controls.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { groupedPresets, presetById, presets, sourceEntries } from '../lib/presets.js'
import { layoutInfo } from '../lib/layouts.js'
import { sessionSites } from '../lib/brain.js'
import { describePattern, describeSpatial, fmtMinutes } from '../lib/format.js'
import { coilsUsed } from '../engine/spatial.js'
import { SessionRunner, render } from '../engine/session.js'
import { PATTERN_INFO } from '../engine/patterns.js'
import { device, call, connect } from '../ble/device.js'
import { nav, go, goSafety } from '../lib/nav.js'
import SiteMap from '../components/SiteMap.vue'
import WaveformPreview from '../components/WaveformPreview.vue'
import PhaseTimeline from '../components/PhaseTimeline.vue'
import LivePanel from '../components/LivePanel.vue'

const allGroups = groupedPresets()
// Library filter: words match name, summary, origin, sites and category.
const query = ref('')
const evidenceFilter = ref('')
const groups = computed(() => {
  const words = query.value.toLowerCase().split(/\s+/).filter(Boolean)
  const match = (p) => {
    if (evidenceFilter.value && p.doc.evidence !== evidenceFilter.value) return false
    if (!words.length) return true
    const hay = [p.doc.name, p.doc.summary, p.doc.origin, p.doc.id, p.doc.category, ...(p.session?.sites ?? []), ...(p.doc.targets ?? [])].join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  }
  return allGroups.map((g) => ({ ...g, items: g.items.filter(match) })).filter((g) => g.items.length)
})
const shownCount = computed(() => groups.value.reduce((a, g) => a + g.items.length, 0))
// The Clear button disappears with the empty state: put focus on the selected
// program (the watch on the filters scrolls the list to it).
function clearFilters() {
  query.value = ''
  evidenceFilter.value = ''
  nextTick(() => lib.value?.querySelector('.item.sel')?.focus({ preventScroll: true }))
}
const EVIDENCE_LABEL = {
  established: 'Established',
  'single-lab': 'Single lab',
  claim: 'Claim',
  anecdote: 'Anecdote',
  unverified: 'Unverified',
}
const EVIDENCE_INFO = {
  established: 'Independently replicated or consensus',
  'single-lab': 'Published, but not independently replicated',
  claim: 'Statement by the author, lab or vendor',
  anecdote: 'User reports',
  unverified: 'A construct nobody has tested',
}
// "left-tpj" -> "left tpj" until the region names load in the brain view
const targetName = (id) => id.replace(/-/g, ' ').replace(/\b(tpj|dlpfc|vmpfc)\b/g, (m) => m.toUpperCase())
const DEFAULT_ID = presetById('god-helmet-classic') ? 'god-helmet-classic' : presets[0].doc.id
const selectedId = ref(nav.arg && presetById(nav.arg) ? nav.arg : DEFAULT_ID)
watch(() => nav.arg, (id) => { if (id && presetById(id)) selectedId.value = id })
const preset = computed(() => presetById(selectedId.value))
const session = computed(() => preset.value.session)
const phaseIndex = ref(0)
watch(selectedId, () => {
  phaseIndex.value = 0
  stopPreview()
})
const phase = computed(() => session.value.phases[phaseIndex.value])
const used = computed(() => coilsUsed(phase.value.spatial, session.value.geometry))
const direction = computed(() => (phase.value.spatial.mode === 'rotate' ? (phase.value.spatial.ccw ? 'ccw' : 'cw') : null))
// The Persinger/Murphy caveat only applies to programs from that line of work.
const persingerNote = computed(() => /persinger|murphy|shiva|shakti|koren/i.test(`${preset.value.doc.source ?? ''} ${preset.value.doc.origin ?? ''}`))

const lib = ref(null)
const detailEl = ref(null)
// Scroll the library list (never the window) so the selected item sits below
// the sticky filters. Uses rects: on phones .library is not the offsetParent.
function revealSelected() {
  const box = lib.value
  const el = box?.querySelector('.item.sel')
  if (!box || !el) return
  const head = box.querySelector('.filters')?.offsetHeight ?? 0
  const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top
  if (top < head || top + el.offsetHeight > box.clientHeight) box.scrollTop += top - head - (box.clientHeight - head - el.offsetHeight) / 2
}
onMounted(revealSelected)
watch(selectedId, () => nextTick(revealSelected))
// Filtered results start at the top; with no filter, back to the selection.
watch([query, evidenceFilter], () => nextTick(() => {
  if (!lib.value) return
  if (query.value.trim() || evidenceFilter.value) lib.value.scrollTop = 0
  else revealSelected()
}))

function select(id) {
  selectedId.value = id
  go('programs', id)
  // The library stays in view while the page scrolls (desktop): bring the new
  // program's title into view when it is above or under the sticky header.
  nextTick(() => {
    const d = detailEl.value
    if (d && d.getBoundingClientRect().top < 110) d.scrollIntoView({ block: 'start' })
  })
}

// ---- preview: run the session in the browser, slowed down 10x so steps of
// a few ms are visible.
const preview = ref(null)
const previewMs = ref(-1)
let raf = 0
function startPreview() {
  const runner = new SessionRunner()
  runner.start(session.value)
  runner.advance(session.value.phases.slice(0, phaseIndex.value).reduce((a, p) => a + p.durationMs, 0) + 12000)
  previewMs.value = runner.programMs
  let last = performance.now()
  const step = (t) => {
    const f = runner.advance((t - last) / 10)
    last = t
    if (!f.running) return stopPreview()
    phaseIndex.value = f.phase
    previewMs.value = f.programMs
    preview.value = render(session.value, f).map(Math.abs)
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  preview.value = new Array(8).fill(0)
}
function stopPreview() {
  cancelAnimationFrame(raf)
  preview.value = null
  previewMs.value = -1
}
onBeforeUnmount(stopPreview)

// ---- start
const field = ref(1)
watch(preset, (p) => (field.value = p.doc.uT ?? 1), { immediate: true })
const blind = ref(false)
const maxField = computed(() => Math.min(device.info?.maxFieldUT ?? 5, device.info?.maxReachableUT ?? 5))
const busy = computed(() => device.status && device.status.state !== 'idle')
const recent = computed(() => {
  const i = device.info
  return i?.lastSessionEpoch && i.env?.timeValid ? (Date.now() / 1000 - i.lastSessionEpoch) / 3600 : null
})
const startError = ref('')
const confirmRecent = ref(false)

async function start() {
  startError.value = ''
  if (recent.value !== null && recent.value < 72 && !confirmRecent.value) {
    confirmRecent.value = true
    return
  }
  confirmRecent.value = false
  try {
    await call('session.start', { session: preset.value.doc, presetId: preset.value.doc.id, fieldUT: Number(field.value), blind: blind.value })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    startError.value = e.message
    if (/safety/.test(e.message)) goSafety(`programs/${preset.value.doc.id}`)
  }
}
</script>

<template>
  <div class="page">
    <LivePanel />

    <div class="layout">
      <nav ref="lib" class="library card" aria-label="Programs">
        <div class="filters">
          <input v-model="query" type="search" placeholder="Search programs, sites, regions…" aria-label="Search programs" />
          <select v-model="evidenceFilter" aria-label="Evidence level">
            <option value="">Any evidence</option>
            <option v-for="(label, key) in EVIDENCE_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
          <span class="count muted small">{{ shownCount }} of {{ presets.length }} programs</span>
        </div>
        <div v-if="!shownCount" class="empty stack small">
          <p class="muted">No program matches{{ query.trim() && evidenceFilter ? ' this search and evidence level' : evidenceFilter ? ' this evidence level' : ' this search' }}.</p>
          <button class="btn ghost sm" @click="clearFilters">Clear filters</button>
        </div>
        <div v-for="g in groups" :key="g.key" class="group">
          <div class="eyebrow">{{ g.label }}</div>
          <button v-for="p in g.items" :key="p.doc.id" class="item" :class="{ sel: p.doc.id === selectedId }" @click="select(p.doc.id)">
            <span class="name">{{ p.doc.name }}</span>
            <span v-if="p.session" class="meta">
              {{ layoutInfo(p.session.layout).key === 'custom' ? '' : `${layoutInfo(p.session.layout).name} · ` }}{{ fmtMinutes(p.session.totalMs) }}
              <span v-if="p.doc.evidence" class="chip" :class="'ev-' + p.doc.evidence">{{ EVIDENCE_LABEL[p.doc.evidence] ?? p.doc.evidence }}</span>
            </span>
            <span v-else class="meta">invalid: {{ p.error }}</span>
          </button>
        </div>
      </nav>

      <article ref="detailEl" class="detail">
        <header class="card">
          <div class="row" style="justify-content: space-between">
            <span class="eyebrow">{{ allGroups.find((g) => g.key === preset.doc.category)?.label }}</span>
            <span class="chip blue">{{ layoutInfo(session.layout).title }}</span>
          </div>
          <h2>{{ preset.doc.name }}</h2>
          <p>{{ preset.doc.summary }}</p>
          <div v-if="preset.doc.evidence" class="row meta-row small">
            <span class="chip" :class="'ev-' + preset.doc.evidence">Evidence: {{ EVIDENCE_LABEL[preset.doc.evidence] ?? preset.doc.evidence }}</span>
            <span v-if="EVIDENCE_INFO[preset.doc.evidence]" class="muted">{{ EVIDENCE_INFO[preset.doc.evidence] }}</span>
          </div>
          <p v-if="preset.doc.origin" class="muted small">{{ preset.doc.origin }}</p>
          <dl v-if="preset.doc.setting || preset.doc.schedule" class="facts small">
            <template v-if="preset.doc.setting"><dt>Setting</dt><dd>{{ preset.doc.setting }}</dd></template>
            <template v-if="preset.doc.schedule"><dt>Schedule</dt><dd>{{ preset.doc.schedule }}</dd></template>
          </dl>
          <details v-if="preset.doc.notes" :key="preset.doc.id" class="notes small">
            <summary>Notes, caveats and how this program was derived</summary>
            <p>{{ preset.doc.notes }}</p>
          </details>
          <div v-if="preset.doc.targets?.length" class="row small">
            <span class="muted">Aims at:</span>
            <span v-for="t in preset.doc.targets" :key="t" class="chip">{{ targetName(t) }}</span>
            <button class="btn ghost sm" @click="go('brain', preset.doc.id)">Show in Brain view</button>
          </div>
        </header>

        <section class="card">
          <div class="grid2">
            <div class="stack">
              <h3>Placement</h3>
              <SiteMap :sites="sessionSites(session)" :used="preview ? null : used" :levels="preview" :direction="direction" />
              <div class="row">
                <button v-if="!preview" class="btn sm" @click="startPreview">Preview coil activity (10× slower)</button>
                <button v-else class="btn sm" @click="stopPreview">Stop preview</button>
                <button class="btn ghost sm" @click="go('brain', preset.doc.id)">Brain view</button>
                <button class="btn ghost sm" @click="go('placement', preset.doc.id)">How to place the coils</button>
              </div>
            </div>
            <div class="stack">
              <h3>Program</h3>
              <PhaseTimeline v-if="session.phases.length > 1" :phases="session.phases" :selected="phaseIndex" :position-ms="previewMs" @select="(i) => { phaseIndex = i; stopPreview() }" />
              <div class="stack phase">
                <div class="row" style="justify-content: space-between">
                  <b>{{ phaseIndex + 1 }}. {{ phase.name }}</b>
                  <span class="muted small">{{ fmtMinutes(phase.durationMs) }}{{ phaseIndex > 0 ? (phase.crossfade ? ' · crossfade' : ' · abrupt switch') : '' }}</span>
                </div>
                <div class="small"><span class="muted">Signal:</span> {{ describePattern(phase.pattern) }}</div>
                <div class="small muted">{{ PATTERN_INFO[phase.pattern.type] }}</div>
                <WaveformPreview :pattern="phase.pattern" />
                <div class="small"><span class="muted">Coils:</span> {{ describeSpatial(phase.spatial) }}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <h3>Start</h3>
          <label class="field">Intensity at 20 mm depth: <b class="num">{{ Number(field).toFixed(1) }} µT</b>
            <input v-model="field" type="range" min="0.1" :max="maxField.toFixed(1)" step="0.1" />
          </label>
          <label class="check"><input v-model="blind" type="checkbox" /> Blind: the helmet picks real or sham at random (revealed after you rate)</label>
          <p v-if="device.info && !device.info.calibrated" class="warn small">Not calibrated yet: µT values are estimates. See Setup → Calibration.</p>
          <p v-if="confirmRecent" class="warn small">Last session was {{ recent.toFixed(0) }} h ago; 72 h between sessions is recommended. Press Start again to continue anyway.</p>
          <div v-if="device.kind" class="row">
            <button class="btn primary" :disabled="busy" @click="start">{{ busy ? 'A session is running' : 'Start' }}</button>
            <span class="muted small">on {{ device.name }}</span>
          </div>
          <div v-else class="row">
            <button class="btn primary" :disabled="!device.bluetooth || device.connecting" @click="connect('ble')">Connect helmet</button>
            <button class="btn" @click="connect('demo')">Try the demo</button>
          </div>
          <p v-if="startError" class="bad small">{{ startError }}</p>
        </section>

        <section class="card">
          <h3>Sources</h3>
          <ul class="sources">
            <li v-for="(s, i) in sourceEntries(preset.doc.source)" :key="i">
              <a v-if="s.url" :href="s.url" target="_blank" rel="noopener">{{ s.text }}</a><span v-else>{{ s.text }}</span>
              <a v-for="(u, j) in s.extra" :key="u" :href="u" target="_blank" rel="noopener" class="extra small" :aria-label="`${s.text}, link ${j + 2}`">[{{ j + 2 }}]</a>
            </li>
          </ul>
          <p v-if="persingerNote" class="muted small">Persinger-lab and Murphy claims are reported as claims. Independent double-blind tests (Granqvist 2005) found no effect of the field; use Blind to test it yourself.</p>
        </section>
      </article>
    </div>
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: minmax(220px, 290px) minmax(0, 1fr); gap: 18px; align-items: start; }
.library { position: sticky; top: 110px; max-height: calc(100vh - 130px); overflow: auto; gap: 14px; }
.group { display: grid; gap: 4px; }
.empty .btn { justify-self: start; }
.filters { display: grid; gap: 6px; position: sticky; top: -16px; background: var(--surface); padding-block: 4px; z-index: 1; }
.item { text-align: left; background: none; border: 1px solid transparent; border-radius: 8px; padding: 8px 10px; cursor: pointer; display: grid; gap: 2px; }
.item:hover { border-color: var(--line); }
.item.sel { background: var(--accent-soft); border-color: var(--accent); }
.item .name { font-weight: 600; font-size: 14px; }
.item .meta { color: var(--muted); font-size: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.item .meta .chip { font-size: 11px; padding: 0 7px; }
.detail { display: grid; gap: 18px; min-width: 0; scroll-margin-top: 110px; }
/* Keep rows at content height when the other column is taller */
.grid2 > .stack { align-content: start; }
.phase { border-top: 1px solid var(--line); padding-top: 10px; }
.sources { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 14px; overflow-wrap: anywhere; }
.sources .extra { margin-left: 6px; }
.meta-row { gap: 8px; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 0; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; max-width: 75ch; }
.notes summary { cursor: pointer; color: var(--muted); padding: 8px 0; min-height: 32px; }
.notes summary:hover { color: var(--text); }
.notes p { max-width: 75ch; margin: 6px 0 0; }
.chip.ev-established { border-color: var(--ok); color: var(--ok); }
.chip.ev-single-lab { border-color: var(--blue); color: var(--blue); }
.chip.ev-claim, .chip.ev-anecdote { border-color: var(--warn); color: var(--warn); }
.chip.ev-unverified { border-color: var(--muted); }
@media (max-width: 760px) {
  .layout { grid-template-columns: 1fr; }
  .library { position: static; max-height: min(60vh, 520px); }
  .filters { grid-template-columns: 1fr auto; align-items: center; }
  .filters input { grid-column: 1 / -1; }
  .filters .count { justify-self: end; }
  .facts { grid-template-columns: 1fr; gap: 2px; }
  .facts dd { margin-bottom: 8px; }
}
</style>
