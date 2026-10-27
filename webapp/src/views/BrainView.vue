<script setup>
// Brain view: where a program's field goes. A physics estimate (coil model +
// template brain), not a map of activation: see the notes at the bottom.
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import BrainScene from '../components/BrainScene.vue'
import { loadBrain, exposure, liveField, underCoil, coilPoses, fmtUT, cssColor, SCALE, sessionSites } from '../lib/brain.js'
import { groupedPresets, presetById, presets } from '../lib/presets.js'
import { coilsUsed } from '../engine/spatial.js'
import { SessionRunner, render } from '../engine/session.js'
import { describePattern, describeSpatial, fmtMinutes } from '../lib/format.js'
import { nav, go } from '../lib/nav.js'

const groups = groupedPresets().map((g) => ({ ...g, items: g.items.filter((p) => p.session) }))
const DEFAULT_ID = presetById('god-helmet-classic') ? 'god-helmet-classic' : presets.find((p) => p.session).doc.id
const selectedId = ref(nav.arg && presetById(nav.arg)?.session ? nav.arg : DEFAULT_ID)
watch(() => nav.arg, (id) => { if (id && presetById(id)?.session) selectedId.value = id })
watch(selectedId, (id) => { if (nav.arg !== id) go('brain', id) })
const preset = computed(() => presetById(selectedId.value))
const session = computed(() => preset.value.session)

const phaseSel = ref('all')
const metric = ref('peak')
const uT = ref(1)
watch(preset, (p) => {
  phaseSel.value = p.session.phases.length > 1 ? 'all' : 0
  uT.value = p.doc.uT ?? 1
}, { immediate: true })

const glass = ref(true)
const showDeep = ref(true)
const showHead = ref(false)
const showSites = ref(false)
const view = ref('iso')
const scene = ref(null)

// ---- data
const brain = shallowRef(null)
const loadError = ref('')
loadBrain().then((b) => (brain.value = b)).catch((e) => (loadError.value = e.message))

const exp = shallowRef(null)
let timer = 0
watch([brain, session, phaseSel, () => Number(uT.value)], () => {
  clearTimeout(timer)
  if (!brain.value) return
  timer = setTimeout(() => (exp.value = exposure(brain.value, session.value, phaseSel.value, Number(uT.value))), 30)
}, { immediate: true })

// ---- live preview (slowed down so millisecond steps are visible)
const live = shallowRef(null)
const liveLevels = ref(null)
const slow = ref(10)
let raf = 0
let liveArrays = {}
const liveInfo = ref(null)
function startLive() {
  const runner = new SessionRunner()
  runner.start(session.value)
  const startPhase = phaseSel.value === 'all' ? 0 : phaseSel.value
  runner.advance(session.value.phases.slice(0, startPhase).reduce((a, p) => a + p.durationMs, 0) + 12000)
  let last = performance.now()
  const step = (t) => {
    const f = runner.advance((t - last) / slow.value)
    last = t
    if (!f.running) return stopLive()
    const drives = render(session.value, f)
    liveLevels.value = drives.map(Math.abs)
    liveArrays = liveField(brain.value, session.value, drives, Number(uT.value), liveArrays)
    live.value = { ...liveArrays }
    liveInfo.value = { phase: f.phase, phaseMs: f.phaseMs }
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}
function stopLive() {
  cancelAnimationFrame(raf)
  live.value = null
  liveLevels.value = null
  liveInfo.value = null
}
watch(preset, stopLive)
// a new phase restarts Live there, so the animation matches the chosen chip
watch(phaseSel, () => {
  if (!live.value) return
  stopLive()
  startLive()
})
onBeforeUnmount(() => {
  stopLive()
  clearTimeout(timer)
})

const values = computed(() => {
  if (live.value) return live.value
  if (!exp.value) return null
  return Object.fromEntries(Object.entries(exp.value.meshes).map(([k, v]) => [k, v[metric.value]]))
})

// ---- coils
const phasesShown = computed(() => (phaseSel.value === 'all' ? session.value.phases : [session.value.phases[phaseSel.value]]))
const usage = computed(() => {
  const u = new Array(8).fill(0)
  for (const ph of phasesShown.value) {
    for (const tr of [ph, ph.track2].filter(Boolean)) {
      if (tr.pattern.type === 'off' || tr.level === 0) continue
      coilsUsed(tr.spatial, session.value.geometry).forEach((w, ch) => (u[ch] = Math.max(u[ch], w * tr.level)))
    }
  }
  return u
})
const coils = computed(() => coilPoses(session.value).map((p, ch) => (p ? { ...p, weight: usage.value[ch] } : null)))
const under = computed(() => (brain.value ? underCoil(brain.value, session.value, Number(uT.value)) : []))
const siteInfo = computed(() => Object.fromEntries((brain.value?.regions ?? []).filter((r) => r.site).map((r) => [r.site, r])))
const unknownSites = computed(() => sessionSites(session.value).filter((s, ch) => s && !coils.value[ch]))

// ---- regions ranked by exposure
const KIND = { cortex: 'Cortex', deep: 'Deep' }
const ranked = computed(() => {
  if (!exp.value) return []
  return exp.value.regions.filter((r) => r.region.kind !== 'site').sort((a, b) => b[metric.value] - a[metric.value])
})
const maxRegion = computed(() => Math.max(1e-6, ...ranked.value.map((r) => r[metric.value])))
const targetIds = computed(() => new Set(preset.value.doc.targets ?? []))
const targets = computed(() => ranked.value.filter((r) => targetIds.value.has(r.region.id)))
const TOP = 10
const showAll = ref(false)
const rankedShown = computed(() => (showAll.value ? ranked.value : ranked.value.slice(0, TOP)))
// shallow so `selectedRegion === r.region` compares the raw region, not a proxy
const selectedRegion = shallowRef(null)
// research sources plus the stimulation-study sources, without duplicates
const regionSources = (r) => {
  const seen = new Set()
  return [...(r.sources ?? []), ...(r.drivenSources ?? [])].filter((s) => {
    const k = s.url || s.title
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, 8)
}
const highlight = computed(() => selectedRegion.value?.mni ?? picked.value?.point ?? null)
// reveal: scroll to the brain (desktop) or the region card (phone) when the click came from far below,
// stopping just under the sticky app header (one or two rows tall depending on width)
function selectRegion(r, reveal = false) {
  selectedRegion.value = selectedRegion.value === r ? null : r
  picked.value = null
  if (!reveal || !selectedRegion.value) return
  nextTick(() => {
    const el = document.querySelector(matchMedia('(max-width: 900px)').matches ? '.brain .pick' : '.brain .main')
    if (!el) return
    const head = document.querySelector('header.top')?.getBoundingClientRect().bottom ?? 0
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - head - 14, behavior: 'smooth' })
  })
}

// ---- picking a point on the brain
const picked = ref(null)
function onPick(p) {
  selectedRegion.value = null
  if (!p) return (picked.value = null)
  const v = values.value?.[p.key]?.[p.vertex] ?? 0
  const near = (brain.value?.regions ?? []).filter((r) => r.kind !== 'site')
    .map((r) => ({ r, d: Math.hypot(...r.mni.map((x, i) => x - p.point[i])) }))
    .sort((a, b) => a.d - b.d)[0]
  const mesh = brain.value.meshes.find((m) => m.key === p.key)
  picked.value = { ...p, uT: v, mesh: mesh?.name, near: near && near.d < 25 ? near : null }
}

// ---- legend
const TICKS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]
const legendGradient = computed(() => `linear-gradient(90deg, ${Array.from({ length: 11 }, (_, i) => cssColor(SCALE.min * (SCALE.max / SCALE.min) ** (i / 10))).join(', ')})`)
const tickPos = (v) => `${(Math.log10(v / SCALE.min) / Math.log10(SCALE.max / SCALE.min)) * 100}%`
const VIEWS = [['iso', '3D'], ['left', 'Left'], ['right', 'Right'], ['front', 'Front'], ['back', 'Back'], ['top', 'Top']]
// call the scene directly so clicking the active view still resets the camera
function setView(v) {
  view.value = v
  scene.value?.setView(v)
}
</script>

<template>
  <div class="page brain">
    <header class="card head">
      <div class="row" style="justify-content: space-between">
        <span class="eyebrow">Brain view</span>
        <span class="chip">Template brain MNI152 · coil model</span>
      </div>
      <h2>Where the field goes</h2>
      <p class="muted">Estimated magnetic field from each program's coils on a standard brain. This is physics, not a map of brain activity: no study has shown that fields this weak switch on any region.</p>
      <div class="controls">
        <label class="field">Program
          <select v-model="selectedId">
            <optgroup v-for="g in groups" :key="g.key" :label="g.label">
              <option v-for="p in g.items" :key="p.doc.id" :value="p.doc.id">{{ p.doc.name }}</option>
            </optgroup>
          </select>
        </label>
        <label class="field">Intensity at 20 mm: <b class="num">{{ Number(uT).toFixed(1) }} µT</b>
          <input v-model="uT" type="range" min="0.1" max="10" step="0.1" />
        </label>
      </div>
      <div class="row phases" role="group" aria-label="Phase">
        <button v-if="session.phases.length > 1" class="chip" :class="{ on: phaseSel === 'all' }" @click="phaseSel = 'all'">All phases (max)</button>
        <button v-for="(ph, i) in session.phases" :key="i" class="chip" :class="{ on: phaseSel === i }" @click="phaseSel = i">{{ i + 1 }}. {{ ph.name }} · {{ fmtMinutes(ph.durationMs) }}</button>
      </div>
    </header>

    <div class="main">
      <section class="card viewer">
        <div class="toolbar">
          <div class="seg" role="group" aria-label="View">
            <button v-for="[k, t] in VIEWS" :key="k" :class="{ on: view === k }" @click="setView(k)">{{ t }}</button>
          </div>
          <div class="seg" role="group" aria-label="Measure">
            <button :class="{ on: metric === 'peak' && !live }" :disabled="!!live" @click="metric = 'peak'">Peak</button>
            <button :class="{ on: metric === 'rms' && !live }" :disabled="!!live" @click="metric = 'rms'">Average (RMS)</button>
            <button :class="{ on: !!live }" @click="live ? stopLive() : startLive()">{{ live ? 'Stop live' : 'Live ▶' }}</button>
          </div>
        </div>
        <div class="stage">
          <BrainScene v-if="brain" ref="scene" :brain="brain" :values="values" :coils="coils" :levels="liveLevels" :glass="glass"
            :show-deep="showDeep" :show-head="showHead" :show-sites="showSites" :highlight="highlight" :view="view" @pick="onPick" />
          <div v-else class="loading muted">{{ loadError || 'Loading brain…' }}</div>
          <div v-if="live && liveInfo" class="overlay small">Live, {{ slow }}× slower · phase {{ liveInfo.phase + 1 }} · {{ (liveInfo.phaseMs / 1000).toFixed(1) }} s</div>
        </div>
        <div class="row toggles small">
          <label class="check"><input v-model="glass" type="checkbox" /> Glass brain</label>
          <label class="check"><input v-model="showDeep" type="checkbox" /> Deep structures</label>
          <label class="check"><input v-model="showHead" type="checkbox" /> Scalp</label>
          <label class="check"><input v-model="showSites" type="checkbox" /> 10-05 sites</label>
          <label v-if="live" class="check">Speed
            <select v-model.number="slow" style="width: auto"><option :value="1">real time</option><option :value="10">10× slower</option><option :value="50">50× slower</option></select>
          </label>
        </div>
        <div class="legend">
          <div class="bar-scale" :style="{ background: legendGradient }"></div>
          <div class="ticks"><span v-for="t in TICKS" :key="t" :style="{ left: tickPos(t) }">{{ t }}</span></div>
          <div class="muted small">µT, log scale · {{ live ? 'instantaneous field' : metric === 'peak' ? 'peak over the phase' : 'root-mean-square over the phase' }}; light contour lines at 0.1 and 1 µT. For scale: the Earth's field is about 48 µT (static); the ICNIRP reference level for uniform 25–400 Hz fields is 200 µT.</div>
        </div>
        <p v-if="unknownSites.length" class="warn small">Not drawn (unknown 10-05 site): {{ unknownSites.join(', ') }}</p>
      </section>

      <aside class="side">
        <section v-if="picked || selectedRegion" class="card pick">
          <template v-if="selectedRegion">
            <span class="eyebrow">{{ KIND[selectedRegion.kind] }}{{ targetIds.has(selectedRegion.id) ? ' · program target' : ' region' }}</span>
            <h3>{{ selectedRegion.name }}</h3>
            <p class="small"><span class="muted">MNI</span> <span class="num">{{ selectedRegion.mni.join(', ') }}</span> · <span class="muted">depth</span> <span class="num">{{ selectedRegion.depthMm != null ? `${Math.round(selectedRegion.depthMm)} mm` : '–' }}</span></p>
            <p class="small">{{ selectedRegion.function }}</p>
            <p v-if="selectedRegion.driven" class="small"><span class="chip">electrodes / TMS</span> {{ selectedRegion.driven }}</p>
            <p v-if="selectedRegion.terms" class="small muted">Meta-analysis terms (Neurosynth): {{ selectedRegion.terms }}</p>
            <p v-if="selectedRegion.depthNote" class="small muted">Depth: {{ selectedRegion.depthNote }}.</p>
            <p v-if="selectedRegion.claimed" class="small"><span class="chip">claim</span> {{ selectedRegion.claimed }}</p>
            <p v-if="selectedRegion.murphy" class="small"><span class="chip">Murphy</span> {{ selectedRegion.murphy }}</p>
            <p v-if="regionSources(selectedRegion).length" class="small muted">Sources: <template v-for="(s, i) in regionSources(selectedRegion)" :key="i"><a v-if="s.url" :href="s.url" target="_blank" rel="noopener">{{ s.title }}</a><span v-else>{{ s.title }}</span><span v-if="i < regionSources(selectedRegion).length - 1"> · </span></template></p>
          </template>
          <template v-else>
            <span class="eyebrow">{{ picked.mesh }}</span>
            <h3 class="num">{{ fmtUT(picked.uT) }} µT</h3>
            <p class="small muted">MNI {{ picked.point.join(', ') }}</p>
            <p v-if="picked.near" class="small">Nearest target: <b>{{ picked.near.r.name }}</b> ({{ picked.near.d.toFixed(0) }} mm)</p>
          </template>
          <button class="btn ghost sm" @click="picked = null; selectedRegion = null">Close</button>
        </section>

        <section class="card">
          <h3>Coils</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Coil</th><th>Site</th><th title="Single coil, cortex straight below">Cortex below</th><th>Use</th></tr></thead>
              <tbody>
                <tr v-for="(c, ch) in coils" :key="ch" :class="{ off: !c || !c.weight }">
                  <td class="num">CH{{ ch + 1 }}</td>
                  <td class="num" :title="c ? siteInfo[c.site]?.function : ''">{{ c?.site ?? '–' }}</td>
                  <td class="num">{{ under[ch] ? fmtUT(under[ch].uT) + ' µT' : '–' }}</td>
                  <td><div class="bar"><i :style="{ width: `${(c?.weight ?? 0) * 100}%` }"></i></div></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="stack small">
            <div v-for="(ph, i) in phasesShown" :key="i" class="phase">
              <b>{{ phaseSel === 'all' ? `${i + 1}. ` : '' }}{{ ph.name }}</b>
              <div class="muted">{{ describePattern(ph.pattern) }} · {{ describeSpatial(ph.spatial) }}</div>
              <div v-if="ph.track2" class="muted">+ {{ describePattern(ph.track2.pattern) }} · {{ describeSpatial(ph.track2.spatial) }}</div>
            </div>
          </div>
          <button class="btn ghost sm" @click="go('programs', preset.doc.id)">Open program</button>
        </section>
      </aside>
    </div>

    <section v-if="targets.length" class="card intended">
      <div class="row" style="justify-content: space-between">
        <h3>What this program aims at</h3>
        <span class="muted small">Evidence for the original protocol: <b>{{ preset.doc.evidence ?? 'not rated' }}</b>{{ preset.doc.origin ? ` · ${preset.doc.origin}` : '' }}</span>
      </div>
      <div class="target-list">
        <button v-for="r in targets" :key="r.region.id" class="target" :class="{ sel: selectedRegion === r.region }" :aria-pressed="selectedRegion === r.region" @click="selectRegion(r.region, true)">
          <span class="dot" :style="{ background: cssColor(r[metric]) }"></span>
          <span><b>{{ r.region.name }}</b><span class="muted small"> · {{ fmtUT(r[metric]) }} µT {{ metric === 'peak' ? 'peak' : 'RMS' }} · {{ Math.round(r.region.depthMm ?? 0) }} mm deep</span></span>
        </button>
      </div>
      <p class="muted small">Estimated field at each target's centre for this program and intensity. For comparison, the cortex right under a coil gets {{ fmtUT(Math.max(0, ...under.filter(Boolean).map((u) => u.uT))) }} µT.</p>
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between">
        <h3>Targets ranked by estimated field</h3>
        <span class="muted small">{{ metric === 'peak' ? 'Peak' : 'RMS' }} µT at the region's centre · tap a row to show it on the brain</span>
      </div>
      <div class="table-wrap">
        <table class="regions">
          <thead><tr><th>Region</th><th>Field</th><th>Depth</th><th>Function, and what stimulating it with electrodes or TMS did</th><th>Claims (Persinger lab, Murphy)</th></tr></thead>
          <tbody>
            <tr v-for="r in rankedShown" :key="r.region.id" class="clickable" :class="{ sel: selectedRegion === r.region }" @click="selectRegion(r.region, true)">
              <td><button class="rname" :aria-pressed="selectedRegion === r.region">{{ r.region.name }}</button><div class="muted small">{{ KIND[r.region.kind] }}<span v-if="targetIds.has(r.region.id)" class="chip on tgt">target</span></div></td>
              <td class="fieldcell">
                <span class="num">{{ fmtUT(r[metric]) }}</span>
                <div class="bar"><i :style="{ width: `${(r[metric] / maxRegion) * 100}%`, background: cssColor(r[metric]) }"></i></div>
              </td>
              <td class="num">{{ r.region.depthMm != null ? `${Math.round(r.region.depthMm)} mm` : '–' }}</td>
              <td class="small">{{ r.region.function }}<div v-if="r.region.driven" class="driven muted" :title="r.region.driven">{{ r.region.driven }}</div></td>
              <td class="small muted">{{ [r.region.claimed, r.region.murphy].filter(Boolean).join(' · ') || '–' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="ranked.length > TOP" class="row">
        <span class="muted small">{{ showAll ? `All ${ranked.length} regions.` : `The ${TOP} strongest of ${ranked.length} regions.` }}</span>
        <button class="btn ghost sm" :aria-expanded="showAll" @click="showAll = !showAll">{{ showAll ? `Show top ${TOP}` : `Show all ${ranked.length}` }}</button>
      </div>
    </section>

    <section class="card notes">
      <h3>How this is computed, and what it does not show</h3>
      <ul class="small">
        <li><b>Coils:</b> each 19 × 12 mm, 495-turn coil with its core is modelled as 24 current loops (exact elliptic-integral field), its face 3 mm off the scalp, axis toward the head centre. Values are scaled so that the program intensity is the peak 20 mm in front of the coil, as in the calibration.</li>
        <li><b>Program:</b> the engine's own spatial gains and waveform give the peak and RMS of |B| over each phase; coils that fire together add as vectors.</li>
        <li><b>Brain:</b> Brainnetome atlas surfaces (MNI152) with cerebellum and brainstem from CerebrA; target centres from the project research. Real heads differ from the template by 5–10 mm, coil placement by tape by about the same.</li>
        <li><b>Not activation:</b> the induced electric field is microvolts per metre for smooth signals, with microsecond spikes of at most about 10 mV/m at the steps of the output: far below the brain's own fields (0.1–1 V/m) and TMS (about 100 V/m). Deep structures (amygdala, hippocampus) get 5–20× less than the cortex below a coil. Independent double-blind tests of this helmet design found no effect of the field (Granqvist 2005; Gendle &amp; McGrath 2012).</li>
        <li><b>Electrodes and TMS:</b> the "what stimulating it did" notes come from direct electrical stimulation in epilepsy surgery (milliamps on the brain surface or in deep electrodes) and from TMS (about 100 V/m). They show what these regions can do when driven that hard; this helmet's fields are many orders of magnitude weaker. Most stimulated cortical sites produce nothing reportable (Fox 2020: 37 % of 1,537 sites).</li>
        <li><b>Claims</b> are reported as claims: Persinger-lab results were not independently replicated and Murphy's region functions are his own descriptions.</li>
      </ul>
      <p v-if="brain" class="muted small">Data: {{ brain.sources.mesh }} · 10-05 sites: MNE-Python fsaverage_1005 (BSD-3). See <a href="#docs/brain_view">Brain view notes</a>.</p>
    </section>
  </div>
</template>

<style scoped>
.brain { max-width: 1240px; }
.head { grid-template-columns: minmax(0, 1fr); }
.head .controls { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 12px; }
.phases { gap: 6px; }
/* long phase names wrap instead of widening the page */
.phases .chip { cursor: pointer; background: none; font-size: 12.5px; padding: 6px 12px; min-height: 32px; white-space: normal; text-align: left; max-width: 100%; border-radius: 12px; }
.phases .chip.on { background: var(--accent); color: var(--accent-ink); }
.main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 330px); gap: 18px; align-items: start; }
.viewer { gap: 10px; container-type: inline-size; }
.toolbar { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.seg button { background: none; border: 0; border-right: 1px solid var(--line); padding: 6px 10px; font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer; }
.seg button:last-child { border-right: 0; }
.seg button.on { background: var(--accent-soft); color: var(--text); }
.seg button:disabled { opacity: .45; cursor: default; }
.stage { position: relative; height: min(68vh, 620px); min-height: 340px; min-width: 0; }
.loading { display: grid; place-items: center; height: 100%; border: 1px dashed var(--line); border-radius: 8px; }
.overlay { position: absolute; left: 10px; top: 10px; background: color-mix(in srgb, var(--surface) 85%, transparent); border: 1px solid var(--line); padding: 3px 8px; border-radius: 6px; pointer-events: none; }
.toggles { gap: 14px; }
.legend { display: grid; gap: 4px; }
.bar-scale { height: 10px; border-radius: 99px; }
.ticks { position: relative; height: 16px; font: 11px var(--font-mono); color: var(--muted); }
.ticks span { position: absolute; transform: translateX(-50%); }
.ticks span:first-child { transform: none; }
.ticks span:last-child { transform: translateX(-100%); }
.side { display: grid; gap: 18px; position: sticky; top: 110px; }
.pick h3 { font-size: 22px; }
tr.off td { opacity: .45; }
.phase { border-top: 1px solid var(--line); padding-top: 6px; }
.regions td.fieldcell { min-width: 120px; }
.regions .bar { margin-top: 4px; }
/* ring keeps the colour code but shows the length of very weak (near-black) bars */
.regions .bar > i { min-width: 4px; border-radius: 99px; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 40%, transparent); }
.regions tr.sel td { background: var(--accent-soft); }
.regions .rname { background: none; border: 0; padding: 0; font: inherit; font-weight: 700; color: inherit; text-align: left; cursor: pointer; }
.regions .driven { margin-top: 4px; font-size: 12.5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.notes ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.target-list { display: flex; flex-wrap: wrap; gap: 8px; }
.target { display: inline-flex; align-items: center; gap: 8px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; cursor: pointer; text-align: left; font-size: 14px; }
.target:hover, .target.sel { border-color: var(--accent); }
.target.sel { background: var(--accent-soft); }
.target .dot { width: 12px; height: 12px; border-radius: 99px; flex: none; box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--text) 40%, transparent); }
.chip.tgt { margin-left: 6px; font-size: 10.5px; padding: 0 6px; }
@media (max-width: 900px) {
  .main { grid-template-columns: 1fr; }
  .side { position: static; }
  .head .controls { grid-template-columns: 1fr; }
  /* square on phones, wide and short in landscape; 100cqw is the viewer card's inner width */
  .stage { height: min(100cqw, 70vh); min-height: 320px; }
}
/* phones: Region / Field / Depth only; the region card holds the rest */
@media (max-width: 700px) {
  .regions th:nth-child(n+4), .regions td:nth-child(n+4) { display: none; }
  .regions td:first-child { overflow-wrap: anywhere; }
  .regions td.fieldcell { min-width: 96px; }
}
</style>
