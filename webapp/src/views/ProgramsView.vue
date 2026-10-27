<script setup>
// Program library: placement, phases, waveforms, an in-browser preview of the
// coil activity, sources, and the start controls.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { groupedPresets, presetById, presets, sourceEntries } from '../lib/presets.js'
import { layoutInfo } from '../lib/layouts.js'
import { sessionSites } from '../lib/brain.js'
import { describePattern, describeSpatial, fmtMinutes } from '../lib/format.js'
import { coilsUsed } from '../engine/spatial.js'
import { SessionRunner, render } from '../engine/session.js'
import { PATTERN_INFO } from '../engine/patterns.js'
import { device, call, connect } from '../ble/device.js'
import { nav, go } from '../lib/nav.js'
import HeadDiagram from '../components/HeadDiagram.vue'
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
const direction = computed(() => (['rotate', 'cycle'].includes(phase.value.spatial.mode) ? (phase.value.spatial.ccw ? 'ccw' : 'cw') : null))

function select(id) {
  go('programs', id)
}

// ---- preview: run the session in the browser, slowed down 10x so steps of
// a few ms are visible.
const preview = ref(null)
let raf = 0
function startPreview() {
  const runner = new SessionRunner()
  runner.start(session.value)
  runner.advance(session.value.phases.slice(0, phaseIndex.value).reduce((a, p) => a + p.durationMs, 0) + 12000)
  let last = performance.now()
  const step = (t) => {
    const f = runner.advance((t - last) / 10)
    last = t
    if (!f.running) return stopPreview()
    phaseIndex.value = f.phase
    preview.value = render(session.value, f).map(Math.abs)
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  preview.value = new Array(8).fill(0)
}
function stopPreview() {
  cancelAnimationFrame(raf)
  preview.value = null
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
    if (/safety/.test(e.message)) go('safety')
  }
}
</script>

<template>
  <div class="page">
    <LivePanel />

    <div class="layout">
      <nav class="library card" aria-label="Programs">
        <div class="filters">
          <input v-model="query" type="search" placeholder="Search programs, sites, regions…" aria-label="Search programs" />
          <select v-model="evidenceFilter" aria-label="Evidence level">
            <option value="">Any evidence</option>
            <option value="established">Established</option>
            <option value="single-lab">Single lab</option>
            <option value="claim">Claim</option>
            <option value="anecdote">Anecdote</option>
            <option value="unverified">Unverified</option>
          </select>
          <span class="muted small">{{ shownCount }} of {{ presets.length }} programs</span>
        </div>
        <div v-for="g in groups" :key="g.key" class="group">
          <div class="eyebrow">{{ g.label }}</div>
          <button v-for="p in g.items" :key="p.doc.id" class="item" :class="{ sel: p.doc.id === selectedId }" @click="select(p.doc.id)">
            <span class="name">{{ p.doc.name }}</span>
            <span class="meta">{{ p.session ? `${layoutInfo(p.session.layout).name} · ${fmtMinutes(p.session.totalMs)}` : `invalid: ${p.error}` }}</span>
          </button>
        </div>
      </nav>

      <article class="detail">
        <header class="card">
          <div class="row" style="justify-content: space-between">
            <span class="eyebrow">{{ allGroups.find((g) => g.key === preset.doc.category)?.label }}</span>
            <span class="chip blue">{{ layoutInfo(session.layout).title }}</span>
          </div>
          <h2>{{ preset.doc.name }}</h2>
          <p>{{ preset.doc.summary }}</p>
          <div class="row meta-row small">
            <span v-if="preset.doc.evidence" class="chip" :class="'ev-' + preset.doc.evidence" :title="EVIDENCE_INFO[preset.doc.evidence]">Evidence: {{ preset.doc.evidence }}</span>
            <span v-if="preset.doc.origin" class="muted">{{ preset.doc.origin }}</span>
          </div>
          <dl v-if="preset.doc.notes || preset.doc.setting || preset.doc.schedule" class="facts small">
            <template v-if="preset.doc.setting"><dt>Setting</dt><dd>{{ preset.doc.setting }}</dd></template>
            <template v-if="preset.doc.schedule"><dt>Schedule</dt><dd>{{ preset.doc.schedule }}</dd></template>
            <template v-if="preset.doc.notes"><dt>Notes</dt><dd>{{ preset.doc.notes }}</dd></template>
          </dl>
          <div v-if="preset.doc.targets?.length" class="row small">
            <span class="muted">Aims at:</span>
            <button v-for="t in preset.doc.targets" :key="t" class="chip linkchip" @click="go('brain', preset.doc.id)">{{ targetName(t) }}</button>
          </div>
        </header>

        <section class="card">
          <div class="grid2">
            <div class="stack">
              <h3>Placement</h3>
              <SiteMap v-if="session.layout === 'custom'" :sites="sessionSites(session)" :used="preview ? null : used" :levels="preview" />
              <HeadDiagram v-else :layout="session.layout" :used="preview ? null : used" :levels="preview" :direction="direction" />
              <div class="row">
                <button v-if="!preview" class="btn sm" @click="startPreview">Preview coil activity (10× slower)</button>
                <button v-else class="btn sm" @click="stopPreview">Stop preview</button>
                <button class="btn ghost sm" @click="go('brain', preset.doc.id)">Brain view</button>
                <button class="btn ghost sm" @click="go('placement')">Where do the coils go?</button>
              </div>
            </div>
            <div class="stack">
              <h3>Program</h3>
              <PhaseTimeline :phases="session.phases" :selected="phaseIndex" @select="(i) => { phaseIndex = i; stopPreview() }" />
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
            </li>
          </ul>
          <p class="muted small">Persinger-lab and Murphy claims are reported as claims. Independent double-blind tests (Granqvist 2005) found no effect of the field; use Blind to test it yourself.</p>
        </section>
      </article>
    </div>
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: minmax(220px, 290px) minmax(0, 1fr); gap: 18px; align-items: start; }
.library { position: sticky; top: 110px; max-height: calc(100vh - 130px); overflow: auto; gap: 14px; }
.group { display: grid; gap: 4px; }
.filters { display: grid; gap: 6px; position: sticky; top: -16px; background: var(--surface); padding-block: 4px; z-index: 1; }
.item { text-align: left; background: none; border: 1px solid transparent; border-radius: 8px; padding: 8px 10px; cursor: pointer; display: grid; gap: 2px; }
.item:hover { border-color: var(--line); }
.item.sel { background: var(--accent-soft); border-color: var(--accent); }
.item .name { font-weight: 600; font-size: 14px; }
.item .meta { color: var(--muted); font-size: 12px; }
.detail { display: grid; gap: 18px; min-width: 0; }
.phase { border-top: 1px solid var(--line); padding-top: 10px; }
.sources { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 14px; }
.meta-row { gap: 8px; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 0; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; max-width: 75ch; }
.linkchip { cursor: pointer; background: none; }
.linkchip:hover { border-color: var(--accent); color: var(--text); }
.chip.ev-established { border-color: var(--ok); color: var(--ok); }
.chip.ev-single-lab { border-color: var(--blue); color: var(--blue); }
.chip.ev-claim, .chip.ev-anecdote { border-color: var(--warn); color: var(--warn); }
.chip.ev-unverified { border-color: var(--muted); }
@media (max-width: 760px) {
  .layout { grid-template-columns: 1fr; }
  .library { position: static; max-height: 300px; }
}
</style>
