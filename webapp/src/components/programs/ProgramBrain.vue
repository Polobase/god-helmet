<script setup>
// Where a program's field goes: the estimated field of its coils on a template
// brain (a physics estimate, not a map of activation), the regions it reaches
// ranked by field, the program's targets and its coils. The 3D view stays in
// view while the list beside it scrolls.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import BrainScene from '../BrainScene.vue'
import { loadBrain, exposure, liveField, underCoil, coilPoses, fmtUT, cssColor, SCALE, sessionSites } from '../../lib/brain.js'
import { presetById } from '../../lib/presets.js'
import { coilsUsed } from '../../engine/spatial.js'
import { describePattern, describeSpatial, fmtMinutes } from '../../lib/format.js'
import { evidenceLabel } from '../../lib/evidence.js'
import { device } from '../../ble/device.js'
import { program, preview, setPhase, startPreview, stopPreview } from '../../lib/programState.js'

const preset = computed(() => presetById(program.id))
const session = computed(() => preset.value.session)

// "All phases" (the maximum over the program) is this view's own choice; a
// single phase is the one Overview shows too.
const allPhases = ref(session.value.phases.length > 1)
watch(() => program.id, () => (allPhases.value = session.value.phases.length > 1))
const phaseSel = computed(() => (allPhases.value ? 'all' : Math.min(program.phase, session.value.phases.length - 1)))
function pickPhase(i) {
  allPhases.value = i === 'all'
  if (i !== 'all') setPhase(i)
  else if (preview.value) startPreview(0)
}

const metric = ref('peak')
const glass = ref(true)
const showDeep = ref(true)
const showHead = ref(false)
const showSites = ref(false)
const view = ref('iso')
const scene = ref(null)
const uT = computed(() => Number(program.uT))
const maxField = computed(() => (device.info ? Math.min(device.info.maxFieldUT ?? 5, device.info.maxReachableUT ?? 5) : null))

// ---- data
const brain = shallowRef(null)
const loadError = ref('')
loadBrain().then((b) => (brain.value = b)).catch((e) => (loadError.value = e.message))

const exp = shallowRef(null)
let timer = 0
watch([brain, session, phaseSel, uT], () => {
  clearTimeout(timer)
  if (!brain.value) return
  timer = setTimeout(() => (exp.value = exposure(brain.value, session.value, phaseSel.value, uT.value)), 30)
}, { immediate: true })

// ---- live: the shared preview (Overview plays the same one), field per frame
const live = shallowRef(null)
let liveArrays = {}
watch(preview, (f) => {
  if (!f || !brain.value) return (live.value = null)
  liveArrays = liveField(brain.value, session.value, f.drives, uT.value, liveArrays)
  live.value = { ...liveArrays }
})
const liveLevels = computed(() => (preview.value ? preview.value.drives.map(Math.abs) : null))
const toggleLive = () => (preview.value ? stopPreview() : startPreview(allPhases.value ? 0 : program.phase))
onBeforeUnmount(() => clearTimeout(timer))

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
const under = computed(() => (brain.value ? underCoil(brain.value, session.value, uT.value) : []))
const siteInfo = computed(() => Object.fromEntries((brain.value?.regions ?? []).filter((r) => r.site).map((r) => [r.site, r])))
const unknownSites = computed(() => sessionSites(session.value).filter((s, ch) => s && !coils.value[ch]))
const underMax = computed(() => Math.max(0, ...under.value.filter(Boolean).map((u) => u.uT)))

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
// The open region always shows, also when it ranks below the first ten.
const rankedShown = computed(() => {
  if (showAll.value) return ranked.value
  const top = ranked.value.slice(0, TOP)
  const sel = ranked.value.find((r) => r.region === selectedRegion.value)
  return sel && !top.includes(sel) ? [...top, sel] : top
})
// shallow so `selectedRegion === r.region` compares the raw region, not a proxy
const selectedRegion = shallowRef(null)
const regionSources = (r) => {
  const seen = new Set()
  return [...(r.sources ?? []), ...(r.drivenSources ?? [])].filter((s) => {
    const k = s.url || s.title
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, 8)
}
const picked = ref(null)
const highlight = computed(() => selectedRegion.value?.mni ?? picked.value?.point ?? null)
const narrow = () => matchMedia('(max-width: 900px)').matches
function selectRegion(r, { reveal = false } = {}) {
  selectedRegion.value = selectedRegion.value === r ? null : r
  picked.value = null
  if (!selectedRegion.value || !reveal) return
  nextTick(() => document.getElementById(`region-${r.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
}
const showOnBrain = () => document.querySelector('.brain-stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' })

// A target chosen on Overview ("Aims at") opens here.
function openRequested() {
  if (!program.region || !ranked.value.length) return
  const r = ranked.value.find((x) => x.region.id === program.region)
  program.region = ''
  if (r) {
    selectedRegion.value = r.region
    nextTick(() => document.getElementById(`region-${r.region.id}`)?.scrollIntoView({ block: narrow() ? 'center' : 'nearest' }))
  }
}
watch(ranked, openRequested)
onMounted(openRequested)

// ---- picking a point on the brain
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
const pickNear = () => picked.value?.near && selectRegion(picked.value.near.r, { reveal: true })

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
const measureText = computed(() => (live.value ? 'instantaneous field' : metric.value === 'peak' ? 'peak over the phase' : 'root-mean-square over the phase'))
</script>

<template>
  <div class="brain">
    <section class="card viewer">
      <div class="toolbar">
        <div class="seg" role="group" aria-label="View">
          <button v-for="[k, t] in VIEWS" :key="k" type="button" :class="{ on: view === k }" @click="setView(k)">{{ t }}</button>
        </div>
        <div class="seg" role="group" aria-label="Measure">
          <button type="button" :class="{ on: metric === 'peak' && !live }" :disabled="!!live" @click="metric = 'peak'">Peak</button>
          <button type="button" :class="{ on: metric === 'rms' && !live }" :disabled="!!live" @click="metric = 'rms'">Average (RMS)</button>
        </div>
      </div>
      <div class="row phases" role="group" aria-label="Phase">
        <button v-if="session.phases.length > 1" type="button" class="chip pick" :class="{ on: phaseSel === 'all' }" :aria-pressed="phaseSel === 'all'" @click="pickPhase('all')">All phases (max)</button>
        <button v-for="(ph, i) in session.phases" :key="i" type="button" class="chip pick" :class="{ on: phaseSel === i }" :aria-pressed="phaseSel === i" @click="pickPhase(i)">{{ i + 1 }}. {{ ph.name }}, {{ fmtMinutes(ph.durationMs) }}</button>
      </div>
      <div class="controls">
        <label class="field">Intensity at 20 mm: <b class="num">{{ uT.toFixed(1) }} µT</b>
          <input v-model="program.uT" type="range" min="0.1" max="10" step="0.1" />
          <span v-if="maxField" class="small muted">This helmet goes up to {{ maxField.toFixed(1) }} µT; Start uses the same value.</span>
        </label>
        <div class="live-ctl">
          <button type="button" class="btn sm" :class="{ on: !!live }" @click="toggleLive">{{ live ? '■ Stop live' : '▶ Live' }}</button>
          <select v-model.number="program.speed" aria-label="Live speed">
            <option :value="1">real time</option><option :value="10">10× slower</option><option :value="50">50× slower</option>
          </select>
        </div>
      </div>
      <div class="brain-stage">
        <BrainScene v-if="brain" ref="scene" :brain="brain" :values="values" :coils="coils" :levels="liveLevels" :glass="glass"
          :show-deep="showDeep" :show-head="showHead" :show-sites="showSites" :highlight="highlight" :view="view" @pick="onPick" />
        <div v-else class="loading muted">{{ loadError || 'Loading brain…' }}</div>
        <div v-if="live && preview" class="overlay small">Live, {{ program.speed }}× slower · phase {{ preview.phase + 1 }} · {{ (preview.phaseMs / 1000).toFixed(1) }} s</div>
        <div v-if="picked" class="overlay pick-card small" role="status">
          <span class="muted">{{ picked.mesh }}</span>
          <b class="num big">{{ fmtUT(picked.uT) }} µT</b>
          <span class="muted">MNI {{ picked.point.join(', ') }}</span>
          <button v-if="picked.near" type="button" class="linkbtn" @click="pickNear">Nearest target: {{ picked.near.r.name }} ({{ picked.near.d.toFixed(0) }} mm)</button>
          <button type="button" class="btn ghost sm close" aria-label="Close" @click="picked = null">✕</button>
        </div>
      </div>
      <div class="row toggles small">
        <label class="check"><input v-model="glass" type="checkbox" /> Glass brain</label>
        <label class="check"><input v-model="showDeep" type="checkbox" /> Deep structures</label>
        <label class="check"><input v-model="showHead" type="checkbox" /> Scalp</label>
        <label class="check"><input v-model="showSites" type="checkbox" /> 10-05 sites</label>
      </div>
      <div class="legend">
        <div class="bar-scale" :style="{ background: legendGradient }"></div>
        <div class="ticks"><span v-for="t in TICKS" :key="t" :style="{ left: tickPos(t) }">{{ t }}</span></div>
        <details class="scale small">
          <summary>µT, log scale: {{ measureText }}; light contour lines at 0.1 and 1 µT</summary>
          <p class="muted">For scale: the Earth's field is about 48 µT (static); the ICNIRP reference level for uniform 25–400 Hz fields is 200 µT.</p>
        </details>
      </div>
      <p class="small muted">Estimated magnetic field of this program's coils on a standard brain (template MNI152, coil model). This is physics, not a map of brain activity: no study has shown that fields this weak switch on any region.</p>
      <p v-if="unknownSites.length" class="warn small">Not drawn (unknown 10-05 site): {{ unknownSites.join(', ') }}</p>
    </section>

    <aside class="side">
      <section v-if="targets.length" class="card">
        <h3>What this program aims at</h3>
        <div class="target-list">
          <button v-for="r in targets" :key="r.region.id" type="button" class="target" :class="{ sel: selectedRegion === r.region }" :aria-pressed="selectedRegion === r.region" @click="selectRegion(r.region, { reveal: true })">
            <span class="dot" :style="{ background: cssColor(r[metric]) }"></span>
            <span class="t-text"><b>{{ r.region.name }}</b><span class="muted small">{{ fmtUT(r[metric]) }} µT {{ metric === 'peak' ? 'peak' : 'RMS' }}, {{ Math.round(r.region.depthMm ?? 0) }} mm deep</span></span>
          </button>
        </div>
        <p class="muted small">Estimated field at each target's centre. The cortex right under a coil gets {{ fmtUT(underMax) }} µT. Evidence for the original protocol: {{ preset.doc.evidence ? evidenceLabel(preset.doc.evidence).toLowerCase() : 'not rated' }}.</p>
      </section>

      <section class="card">
        <div class="list-head">
          <h3>Regions by field</h3>
          <span class="muted small">{{ metric === 'peak' ? 'Peak' : 'RMS' }} µT at the centre</span>
        </div>
        <p v-if="!ranked.length" class="small muted">{{ loadError || 'Computing…' }}</p>
        <ol class="regions">
          <li v-for="r in rankedShown" :id="`region-${r.region.id}`" :key="r.region.id" :class="{ sel: selectedRegion === r.region }">
            <button type="button" class="region-row" :aria-expanded="selectedRegion === r.region" @click="selectRegion(r.region)">
              <span class="rname">
                <b>{{ r.region.name }}</b>
                <span class="muted small">{{ KIND[r.region.kind] }}<span v-if="targetIds.has(r.region.id)" class="chip tgt">target</span></span>
              </span>
              <span class="rfield">
                <span class="num">{{ fmtUT(r[metric]) }}</span>
                <span class="bar"><i :style="{ width: `${(r[metric] / maxRegion) * 100}%`, background: cssColor(r[metric]) }"></i></span>
              </span>
              <span class="rdepth num muted">{{ r.region.depthMm != null ? `${Math.round(r.region.depthMm)} mm` : '–' }}</span>
            </button>
            <div v-if="selectedRegion === r.region" class="region-detail small">
              <p>{{ r.region.function }}</p>
              <p v-if="r.region.driven"><span class="chip">electrodes / TMS</span> {{ r.region.driven }}</p>
              <p v-if="r.region.terms" class="muted">Meta-analysis terms (Neurosynth): {{ r.region.terms }}</p>
              <p v-if="r.region.depthNote" class="muted">Depth: {{ r.region.depthNote }}.</p>
              <p v-if="r.region.claimed"><span class="chip ev-warn">claim</span> {{ r.region.claimed }}</p>
              <p v-if="r.region.murphy"><span class="chip ev-warn">Murphy</span> {{ r.region.murphy }}</p>
              <p class="muted"><span>MNI</span> <span class="num">{{ r.region.mni.join(', ') }}</span></p>
              <p v-if="regionSources(r.region).length" class="muted">Sources: <template v-for="(s, i) in regionSources(r.region)" :key="i"><a v-if="s.url" :href="s.url" target="_blank" rel="noopener">{{ s.title }}</a><span v-else>{{ s.title }}</span><span v-if="i < regionSources(r.region).length - 1"> · </span></template></p>
              <button type="button" class="linkbtn small on-brain" @click="showOnBrain">Show on the brain</button>
            </div>
          </li>
        </ol>
        <div v-if="ranked.length > TOP" class="row">
          <span class="muted small">{{ showAll ? `All ${ranked.length} regions.` : `The ${TOP} strongest of ${ranked.length} regions.` }}</span>
          <button type="button" class="btn ghost sm" :aria-expanded="showAll" @click="showAll = !showAll">{{ showAll ? `Show top ${TOP}` : `Show all ${ranked.length}` }}</button>
        </div>
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
            <div class="muted">{{ describePattern(ph.pattern) }}; {{ describeSpatial(ph.spatial) }}</div>
            <div v-if="ph.track2" class="muted">Second track: {{ describePattern(ph.track2.pattern) }}; {{ describeSpatial(ph.track2.spatial) }}</div>
          </div>
        </div>
      </section>

      <details class="card notes">
        <summary>How this is computed, and what it does not show</summary>
        <ul class="small">
          <li><b>Coils:</b> each 19 × 12 mm, 495-turn coil with its core is modelled as 24 current loops (exact elliptic-integral field), its face 3 mm off the scalp, axis toward the head centre. Values are scaled so that the program intensity is the peak 20 mm in front of the coil, as in the calibration.</li>
          <li><b>Program:</b> the engine's own spatial gains and waveform give the peak and RMS of |B| over each phase; coils that fire together add as vectors.</li>
          <li><b>Brain:</b> Brainnetome atlas surfaces (MNI152) with cerebellum and brainstem from CerebrA; target centres from the project research. Real heads differ from the template by 5–10 mm, coil placement by tape by about the same.</li>
          <li><b>Not activation:</b> the induced electric field is microvolts per metre for smooth signals, with microsecond spikes of at most about 10 mV/m at the steps of the output: far below the brain's own fields (0.1–1 V/m) and TMS (about 100 V/m). Deep structures (amygdala, hippocampus) get 5–20× less than the cortex below a coil. Independent double-blind tests of this helmet design found no effect of the field (Granqvist 2005; Gendle &amp; McGrath 2012).</li>
          <li><b>Electrodes and TMS:</b> the "what stimulating it did" notes come from direct electrical stimulation in epilepsy surgery (milliamps on the brain surface or in deep electrodes) and from TMS (about 100 V/m). They show what these regions can do when driven that hard; this helmet's fields are many orders of magnitude weaker. Most stimulated cortical sites produce nothing reportable (Fox 2020: 37 % of 1,537 sites).</li>
          <li><b>Claims</b> are reported as claims: Persinger-lab results were not independently replicated and Murphy's region functions are his own descriptions.</li>
        </ul>
        <p v-if="brain" class="muted small">Data: {{ brain.sources.mesh }} · 10-05 sites: MNE-Python fsaverage_1005 (BSD-3). See <a href="#docs/brain_view">Brain view notes</a>.</p>
      </details>
    </aside>
  </div>
</template>

<style scoped>
.brain { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 380px); gap: 18px; align-items: start; }
.viewer { gap: 10px; container-type: inline-size; position: sticky; top: calc(var(--header-h, 100px) + 56px); }
.toolbar { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.phases { gap: 6px; }
/* long phase names wrap instead of widening the page */
.phases .chip { white-space: normal; text-align: left; max-width: 100%; border-radius: 12px; }
.controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 16px; align-items: end; }
.live-ctl { display: flex; gap: 6px; align-items: center; }
.live-ctl select { width: auto; padding: 5px 8px; font-size: 13px; }
.live-ctl .btn.on { border-color: var(--accent); background: var(--accent-soft); }
/* the pinned viewer must fit the window, with its controls, under the header and the slim bar */
.brain-stage { position: relative; height: max(300px, min(58vh, 560px, calc(100vh - var(--header-h, 100px) - 380px))); min-width: 0; }
.loading { display: grid; place-items: center; height: 100%; border: 1px dashed var(--line); border-radius: var(--radius); }
.overlay { position: absolute; left: 10px; top: 10px; background: color-mix(in srgb, var(--surface) 88%, transparent); border: 1px solid var(--line); padding: 4px 9px; border-radius: 8px; pointer-events: none; }
.pick-card { top: auto; bottom: 10px; pointer-events: auto; display: grid; gap: 2px; padding: 8px 36px 8px 12px; max-width: min(320px, calc(100% - 20px)); }
.pick-card .big { font-size: 22px; }
.pick-card .close { position: absolute; top: 4px; right: 4px; padding: 2px 7px; }
.toggles { gap: 14px; }
.legend { display: grid; gap: 4px; }
.bar-scale { height: 10px; border-radius: 99px; }
.ticks { position: relative; height: 16px; font: 11px var(--font-display); color: var(--muted); }
.ticks span { position: absolute; transform: translateX(-50%); }
.ticks span:first-child { transform: none; }
.ticks span:last-child { transform: translateX(-100%); }
.scale summary { cursor: pointer; color: var(--muted); }
.scale p { margin-top: 4px; }

.side { display: grid; gap: 18px; min-width: 0; }
.list-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.target-list { display: grid; gap: 6px; }
.target { display: flex; align-items: flex-start; gap: 10px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 9px; padding: 8px 10px; cursor: pointer; text-align: left; font-size: 14px; color: var(--text); }
.target:hover { border-color: color-mix(in srgb, var(--text) 30%, var(--line)); }
.target.sel { border-color: var(--accent); background: var(--accent-soft); }
.t-text { display: grid; gap: 1px; }
.target .dot { width: 12px; height: 12px; margin-top: 4px; border-radius: 99px; flex: none; box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--text) 40%, transparent); }
.regions { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.regions li { border: 1px solid transparent; border-radius: 9px; scroll-margin-top: calc(var(--header-h, 100px) + 60px); }
.regions li.sel { border-color: var(--accent); background: var(--accent-soft); }
.region-row { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 92px 44px; gap: 10px; align-items: center; text-align: left; background: none; border: 0; padding: 8px 10px; color: var(--text); cursor: pointer; border-radius: 9px; }
.region-row:hover { background: var(--surface-2); }
.rname { display: grid; gap: 1px; min-width: 0; overflow-wrap: anywhere; }
.rname b { font-weight: 600; font-size: 14px; }
.rfield { display: grid; gap: 4px; }
.rfield .num { font-size: 15px; }
/* ring keeps the colour code but shows the length of very weak (near-black) bars */
.rfield .bar > i { min-width: 4px; border-radius: 99px; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 40%, transparent); }
.rdepth { text-align: right; font-size: 14px; }
.chip.tgt { margin-left: 6px; font-size: 10.5px; padding: 0 6px; border-color: var(--accent); color: var(--accent); }
.region-detail { display: grid; gap: 6px; padding: 0 10px 10px; line-height: 1.45; }
.on-brain { justify-self: start; display: none; }
tr.off td { opacity: .45; }
.phase { border-top: 1px solid var(--line); padding-top: 6px; }
.notes { padding: 0; gap: 0; }
.notes summary { cursor: pointer; padding: 16px 18px; font: 600 17px var(--font-display); letter-spacing: .01em; }
.notes ul { margin: 0; padding: 0 18px 0 36px; display: grid; gap: 6px; }
.notes > p { padding: 10px 18px 16px; }
@media (max-width: 900px) {
  .brain { grid-template-columns: 1fr; }
  .viewer { position: static; }
  /* square on phones, wide and short in landscape; 100cqw is the viewer card's inner width */
  .brain-stage { height: min(100cqw, 70vh); min-height: 300px; }
  .on-brain { display: inline; }
}
@media (max-width: 520px) {
  .controls { grid-template-columns: 1fr; }
  .toolbar .seg button { padding: 6px 8px; }
}
</style>
