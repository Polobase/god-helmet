<script setup lang="ts">
// Where a program's field goes: the estimated field of its coils on a template
// brain (a physics estimate, not a map of activation), the regions it reaches
// ranked by field, the program's targets and its coils. The 3D view stays in
// view while the list beside it scrolls.
import { useResizeObserver } from '@vueuse/core'
import { describePattern, describeSpatial, fmtMinutes } from '#core/lib/format.js'
import { coilsUsed } from '#core/engine/spatial.js'
import { fmtField, fmtSetting, fmtRef, toDisplay, unitLabel } from '#core/lib/units.js'
import { device, maxFieldUT, errorMessage } from '~/lib/device'
import { presetById, sessionSites, program, preview, setPhase, startPreview, stopPreview } from '~/lib/programs'
import { loadBrain, exposure, liveField, underCoil, coilPoses, cssColor, SCALE } from '~/lib/brain'
import type { Brain, Exposure, FieldValues, Metric, PhaseChoice, Region, ScenePick, SceneCoil, ViewKey } from '~/lib/brain'

const preset = computed(() => presetById(program.id)!)
const doc = computed(() => preset.value.doc)
const session = computed(() => preset.value.session!)

// "All phases" (the maximum over the program) is this view's own choice; a
// single phase is the one Overview shows too.
const allPhases = ref(session.value.phases.length > 1)
watch(() => program.id, () => (allPhases.value = session.value.phases.length > 1))
const phaseSel = computed<PhaseChoice>(() => (allPhases.value ? 'all' : Math.min(program.phase, session.value.phases.length - 1)))
function pickPhase(i: PhaseChoice) {
  allPhases.value = i === 'all'
  if (i !== 'all') setPhase(i)
  else if (preview.value) startPreview(0)
}

const metric = ref<Metric>('peak')
const glass = ref(true)
const showDeep = ref(true)
const showHead = ref(false)
const showSites = ref(false)
const view = ref<ViewKey>('iso')
const uT = computed(() => Number(program.uT))
const maxField = computed(() => (device.info ? maxFieldUT() : null))

// ---- data: the meshes (1.5 MB) and three.js with the scene load on demand, side by side
const brain = shallowRef<Brain | null>(null)
const loadError = ref('')
const reason = ref('')
function failed(e: unknown) {
  loadError.value = 'The brain did not load. Check the connection, then reload the page.'
  reason.value = errorMessage(e)
}
loadBrain().then((b) => (brain.value = b)).catch(failed)
// the same file <LazyBrainScene> asks for once the meshes are there: by then it is on its way
import('~/components/brain/Scene.vue').catch(failed)

const scene = useTemplateRef<{ setView: (view: ViewKey) => void }>('scene')
const sceneReady = ref(false)
const sceneError = ref('')
function noWebGL(why: string) {
  sceneError.value = 'This browser could not start WebGL, so the brain cannot be drawn here. The numbers beside it do not need it.'
  reason.value = why
}
const waitText = computed(() => sceneError.value || loadError.value || (sceneReady.value ? '' : 'Loading brain…'))

const exp = shallowRef<Exposure | null>(null)
let timer = 0
watch([brain, session, phaseSel, uT], () => {
  clearTimeout(timer)
  const b = brain.value
  if (b) timer = window.setTimeout(() => (exp.value = exposure(b, session.value, phaseSel.value, uT.value)), 30)
}, { immediate: true })

// ---- live: the shared preview (Overview plays the same one), field per frame
const live = shallowRef<FieldValues | null>(null)
let liveArrays: FieldValues = {}
watch(preview, (f) => {
  if (!f || !brain.value) {
    live.value = null
    return
  }
  liveArrays = liveField(brain.value, session.value, f.drives, uT.value, liveArrays)
  live.value = { ...liveArrays }
})
const liveLevels = computed(() => (preview.value ? preview.value.drives.map(Math.abs) : null))
const toggleLive = () => (preview.value ? stopPreview() : startPreview(allPhases.value ? 0 : program.phase))
const SPEEDS = [{ label: 'real time', value: 1 }, { label: '10× slower', value: 10 }, { label: '50× slower', value: 50 }]
const speedText = computed(() => SPEEDS.find((s) => s.value === program.speed)?.label ?? `${program.speed}× slower`)
onBeforeUnmount(() => clearTimeout(timer))

const values = computed<FieldValues | null>(() => {
  if (live.value) return live.value
  if (!exp.value) return null
  return Object.fromEntries(Object.entries(exp.value.meshes).map(([k, v]) => [k, v[metric.value]]))
})

// ---- coils
const phasesShown = computed(() => (phaseSel.value === 'all' ? session.value.phases : [session.value.phases[phaseSel.value]!]))
const usage = computed(() => {
  const u = new Array<number>(8).fill(0)
  for (const ph of phasesShown.value) {
    for (const tr of [ph, ph.track2]) {
      if (!tr || tr.pattern.type === 'off' || tr.level === 0) continue
      const used: number[] = coilsUsed(tr.spatial, session.value.geometry)
      used.forEach((w, ch) => (u[ch] = Math.max(u[ch] ?? 0, w * tr.level)))
    }
  }
  return u
})
const coils = computed<(SceneCoil | null)[]>(() => coilPoses(session.value).map((p, ch) => (p ? { ...p, weight: usage.value[ch] ?? 0 } : null)))
const under = computed(() => (brain.value ? underCoil(brain.value, session.value, uT.value) : []))
const siteInfo = computed(() => new Map((brain.value?.regions ?? []).filter((r) => r.site).map((r) => [r.site, r])))
const unknownSites = computed(() => sessionSites(session.value).filter((s, ch) => s && !coils.value[ch]))
const underMax = computed(() => Math.max(0, ...under.value.map((u) => u?.uT ?? 0)))
const percent = (weight: number) => Math.round(weight * 100)

// ---- regions ranked by exposure
const KIND: Record<string, string> = { cortex: 'Cortex', deep: 'Deep' }
const ranked = computed(() => {
  if (!exp.value) return []
  return exp.value.regions.filter((r) => r.region.kind !== 'site').sort((a, b) => b[metric.value] - a[metric.value])
})
const maxRegion = computed(() => Math.max(1e-6, ...ranked.value.map((r) => r[metric.value])))
const targetIds = computed(() => new Set(doc.value.targets ?? []))
const targets = computed(() => ranked.value.filter((r) => targetIds.value.has(r.region.id)))
const metricName = computed(() => (metric.value === 'peak' ? 'peak' : 'RMS'))
const TOP = 10
const showAll = ref(false)
// shallow so `selectedRegion === r.region` compares the raw region, not a proxy
const selectedRegion = shallowRef<Region | null>(null)
// The open region always shows, also when it ranks below the first ten.
const rankedShown = computed(() => {
  if (showAll.value) return ranked.value
  const top = ranked.value.slice(0, TOP)
  const sel = ranked.value.find((r) => r.region === selectedRegion.value)
  return sel && !top.includes(sel) ? [...top, sel] : top
})
// Sources of the open region: its own and those of the stimulation notes, each once.
const openSources = computed(() => {
  const r = selectedRegion.value
  const seen = new Set<string>()
  return [...(r?.sources ?? []), ...(r?.drivenSources ?? [])].filter((s) => {
    const k = s.url || s.title
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, 8)
})

// A point picked on the brain; its value follows the map (measure, phase, intensity, live).
interface Picked extends ScenePick { mesh?: string, near: { r: Region, d: number } | null }
const picked = shallowRef<Picked | null>(null)
const pickedUT = computed(() => (picked.value ? values.value?.[picked.value.key]?.[picked.value.vertex] ?? 0 : 0))
const highlight = computed(() => selectedRegion.value?.mni ?? picked.value?.point ?? null)
const narrow = () => window.matchMedia('(max-width: 900px)').matches
const rowOf = (r: Region) => document.getElementById(`region-${r.id}`)
function selectRegion(r: Region, { reveal = false } = {}) {
  selectedRegion.value = selectedRegion.value === r ? null : r
  picked.value = null
  if (!selectedRegion.value || !reveal) return
  nextTick(() => rowOf(r)?.scrollIntoView({ behavior: smooth(), block: 'nearest' }))
}
const stageEl = useTemplateRef<HTMLDivElement>('stageEl')
const showOnBrain = () => stageEl.value?.scrollIntoView({ behavior: smooth(), block: 'center' })

// The pinned viewer must fit the window with its controls around the stage:
// tell the stylesheet how much room they take (more with many phases).
const viewerEl = useTemplateRef<HTMLElement>('viewerEl')
const around = ref(0)
useResizeObserver(viewerEl, () => {
  if (viewerEl.value && stageEl.value) around.value = viewerEl.value.offsetHeight - stageEl.value.offsetHeight
})

// A target chosen on Overview ("Aims at") opens here. Its row is scrolled to
// once the page has arrived: the router puts the page at the top one frame
// after a navigation has settled, which is later than this page is set up.
const arrived = new Promise<void>((resolve) => {
  useNuxtApp().hooks.hookOnce('page:loading:end', () => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
  window.setTimeout(resolve, 1500) // should the hook ever not come
})
function openRequested() {
  if (!program.region || !ranked.value.length) return
  const r = ranked.value.find((x) => x.region.id === program.region)
  program.region = ''
  if (!r) return
  selectedRegion.value = r.region
  arrived.then(() => nextTick()).then(() => rowOf(r.region)?.scrollIntoView({ block: narrow() ? 'center' : 'nearest' }))
}
watch(ranked, openRequested)
onMounted(openRequested)

// ---- picking a point on the brain
function onPick(p: ScenePick | null) {
  selectedRegion.value = null
  if (!p) {
    picked.value = null
    return
  }
  const near = (brain.value?.regions ?? []).filter((r) => r.kind !== 'site')
    .map((r) => ({ r, d: Math.hypot(r.mni[0] - p.point[0], r.mni[1] - p.point[1], r.mni[2] - p.point[2]) }))
    .sort((a, b) => a.d - b.d)[0]
  picked.value = { ...p, mesh: brain.value?.meshes.find((m) => m.key === p.key)?.name, near: near && near.d < 25 ? near : null }
}
const pickNear = () => picked.value?.near && selectRegion(picked.value.near.r, { reveal: true })

// ---- legend
const TICKS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]
const LEGEND = `linear-gradient(90deg, ${Array.from({ length: 11 }, (_, i) => cssColor(SCALE.min * (SCALE.max / SCALE.min) ** (i / 10))).join(', ')})`
const tickPos = (v: number) => `${(Math.log10(v / SCALE.min) / Math.log10(SCALE.max / SCALE.min)) * 100}%`
const VIEWS: [ViewKey, string][] = [['iso', '3D'], ['left', 'Left'], ['right', 'Right'], ['front', 'Front'], ['back', 'Back'], ['top', 'Top']]
// call the scene directly so clicking the active view still resets the camera
function setView(v: ViewKey) {
  view.value = v
  scene.value?.setView(v)
}
const measureText = computed(() => (live.value ? 'instantaneous field' : metric.value === 'peak' ? 'peak over the phase' : 'root-mean-square over the phase'))

// One of a set of choices: filled when it is the current one.
const choice = (on: boolean) => ({ 'variant': on ? 'soft' : 'outline', 'color': on ? 'primary' : 'neutral', 'aria-pressed': on } as const)
</script>

<template>
  <div v-if="session" class="brain">
    <section ref="viewerEl" class="viewer panel grid gap-3 p-4 sm:p-5" :style="around ? { '--around': `${around}px` } : undefined" aria-label="Field on the brain">
      <div class="flex flex-wrap justify-between gap-2">
        <UFieldGroup size="sm" role="group" aria-label="View">
          <UButton v-for="[k, t] in VIEWS" :key="k" v-bind="choice(view === k)" class="max-[420px]:px-2" @click="setView(k)">{{ t }}</UButton>
        </UFieldGroup>
        <UFieldGroup size="sm" role="group" aria-label="Measure" :title="live ? 'Live shows the field at each instant' : undefined">
          <UButton v-bind="choice(metric === 'peak' && !live)" :disabled="!!live" @click="metric = 'peak'">Peak</UButton>
          <UButton v-bind="choice(metric === 'rms' && !live)" :disabled="!!live" @click="metric = 'rms'">Average (RMS)</UButton>
        </UFieldGroup>
      </div>

      <!-- long phase names wrap instead of widening the page -->
      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Phase">
        <UButton v-if="session.phases.length > 1" size="xs" class="rounded-full" v-bind="choice(phaseSel === 'all')" @click="pickPhase('all')">All phases (max)</UButton>
        <UButton v-for="(ph, i) in session.phases" :key="i" size="xs" class="max-w-full rounded-xl text-left" :ui="{ label: 'whitespace-normal' }" v-bind="choice(phaseSel === i)" @click="pickPhase(i)">
          {{ i + 1 }}. {{ ph.name }}, {{ fmtMinutes(ph.durationMs) }}
        </UButton>
      </div>

      <div class="controls">
        <IntensitySlider v-model="program.uT" :max="10" label="Intensity at 20 mm">
          <span v-if="maxField" class="text-sm text-muted">This helmet goes up to {{ fmtSetting(maxField) }}; Start uses the same value.</span>
        </IntensitySlider>
        <div class="flex items-center gap-1.5">
          <UButton size="sm" :icon="live ? 'i-lucide-square' : 'i-lucide-play'" :variant="live ? 'soft' : 'outline'" :color="live ? 'primary' : 'neutral'" @click="toggleLive">{{ live ? 'Stop live' : 'Live' }}</UButton>
          <USelect v-model="program.speed" :items="SPEEDS" size="sm" class="w-32" aria-label="Live speed" />
        </div>
      </div>

      <div ref="stageEl" class="brain-stage">
        <BrainStage :wait="waitText" :failed="!!(sceneError || loadError)" :reason="reason">
          <LazyBrainScene v-if="brain && !sceneError && !loadError" ref="scene" :brain="brain" :values="values" :coils="coils" :levels="liveLevels" :glass="glass"
            :show-deep="showDeep" :show-head="showHead" :show-sites="showSites" :highlight="highlight" :view="view" @pick="onPick" @ready="sceneReady = true" @error="noWebGL" />
          <p v-if="live && preview" class="overlay">Live, {{ speedText }}, phase {{ preview.phase + 1 }}, <span class="num">{{ (preview.phaseMs / 1000).toFixed(1) }} s</span></p>
          <div v-if="picked" class="overlay pick-card" role="status" :aria-live="live ? 'off' : 'polite'">
            <span class="text-muted">{{ picked.mesh }}</span>
            <b class="num font-display text-[1.4rem] leading-tight font-[620] text-highlighted">{{ fmtField(pickedUT) }}</b>
            <span class="num text-muted">MNI {{ picked.point.join(', ') }}</span>
            <UButton v-if="picked.near" variant="link" color="primary" class="justify-self-start p-0 text-left" :ui="{ label: 'whitespace-normal' }" @click="pickNear">
              Nearest target: {{ picked.near.r.name }} ({{ picked.near.d.toFixed(0) }} mm)
            </UButton>
            <UButton variant="ghost" size="xs" icon="i-lucide-x" aria-label="Close" class="absolute right-1 top-1" @click="picked = null" />
          </div>
        </BrainStage>
      </div>

      <div class="flex flex-wrap gap-x-5 gap-y-2">
        <UCheckbox v-model="glass" label="Glass brain" />
        <UCheckbox v-model="showDeep" label="Deep structures" />
        <UCheckbox v-model="showHead" label="Scalp" />
        <UCheckbox v-model="showSites" label="10-05 sites" />
      </div>

      <div class="grid gap-1">
        <div class="h-2.5 rounded-full" :style="{ background: LEGEND }"></div>
        <div class="ticks num"><span v-for="t in TICKS" :key="t" :style="{ left: tickPos(t) }">{{ Number(toDisplay(t).toPrecision(3)) }}</span></div>
        <details class="text-sm">
          <summary class="cursor-pointer text-muted hover:text-highlighted">{{ unitLabel() }}, log scale: {{ measureText }}; light contour lines at {{ fmtRef(0.1) }} and {{ fmtRef(1) }}</summary>
          <p class="mt-1 text-muted">For scale: the Earth's field is about {{ fmtRef(48) }} (static); the ICNIRP reference level for uniform 25–400 Hz fields is {{ fmtRef(200) }}.</p>
        </details>
      </div>
      <p class="text-sm text-muted">Estimated magnetic field of this program's coils on a standard brain (template MNI152, coil model). This is physics, not a map of brain activity: no study has shown that fields this weak switch on any region.</p>
      <p v-if="unknownSites.length" class="text-sm text-warning">Not drawn (unknown 10-05 site): {{ unknownSites.join(', ') }}</p>
    </section>

    <aside class="side">
      <section v-if="targets.length" class="panel grid gap-3 p-4 sm:p-5">
        <h2 class="text-xl">What this program aims at</h2>
        <div class="grid gap-1.5">
          <button v-for="r in targets" :key="r.region.id" type="button" class="target" :class="{ sel: selectedRegion === r.region }" :aria-pressed="selectedRegion === r.region" @click="selectRegion(r.region, { reveal: true })">
            <span class="dot" :style="{ background: cssColor(r[metric]) }"></span>
            <span class="grid gap-px">
              <b class="font-semibold text-highlighted">{{ r.region.name }}</b>
              <span class="num text-sm text-muted">{{ fmtField(r[metric]) }} {{ metricName }}, {{ Math.round(r.region.depthMm ?? 0) }} mm deep</span>
            </span>
          </button>
        </div>
        <p class="text-sm text-muted">Estimated field at each target's centre. The cortex right under a coil gets {{ fmtField(underMax) }}.</p>
        <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          Evidence for the original protocol: <EvidenceBadge v-if="doc.evidence" :level="doc.evidence" /><template v-else>not rated</template>
        </p>
      </section>

      <section class="panel grid gap-3 p-4 sm:p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 class="text-xl">Regions by field</h2>
          <span class="text-sm text-muted">{{ metric === 'peak' ? 'Peak' : 'RMS' }} {{ unitLabel() }} at the centre</span>
        </div>
        <p v-if="!ranked.length" class="text-sm text-muted" role="status">{{ loadError || 'Computing…' }}</p>
        <ol class="regions">
          <li v-for="r in rankedShown" :id="`region-${r.region.id}`" :key="r.region.id" :class="{ sel: selectedRegion === r.region }">
            <button type="button" class="region-row" :aria-expanded="selectedRegion === r.region" @click="selectRegion(r.region)">
              <span class="rname">
                <b>{{ r.region.name }}</b>
                <span class="flex items-center gap-1.5 text-sm text-muted">{{ KIND[r.region.kind] }}<UBadge v-if="targetIds.has(r.region.id)" color="primary" variant="outline" size="sm" class="rounded-full">target</UBadge></span>
              </span>
              <span class="rfield">
                <span class="num">{{ fmtField(r[metric], false) }}</span>
                <span class="bar"><i :style="{ width: `${(r[metric] / maxRegion) * 100}%`, background: cssColor(r[metric]) }"></i></span>
              </span>
              <span class="rdepth num">{{ r.region.depthMm != null ? `${Math.round(r.region.depthMm)} mm` : '–' }}<span v-if="r.region.depthMm != null" class="sr-only"> deep</span></span>
            </button>
            <div v-if="selectedRegion === r.region" class="region-detail">
              <p>{{ r.region.function }}</p>
              <p v-if="r.region.driven"><UBadge class="mr-1 rounded-full">electrodes / TMS</UBadge> {{ r.region.driven }}</p>
              <p v-if="r.region.terms" class="text-muted">Meta-analysis terms (Neurosynth): {{ r.region.terms }}</p>
              <p v-if="r.region.depthNote" class="text-muted">Depth: {{ r.region.depthNote }}.</p>
              <p v-if="r.region.claimed"><UBadge color="warning" class="mr-1 rounded-full">claim</UBadge> {{ r.region.claimed }}</p>
              <p v-if="r.region.murphy"><UBadge color="warning" class="mr-1 rounded-full">Murphy</UBadge> {{ r.region.murphy }}</p>
              <p class="text-muted">MNI <span class="num">{{ r.region.mni.join(', ') }}</span></p>
              <p v-if="openSources.length" class="text-muted">
                Sources:
                <template v-for="(s, i) in openSources" :key="i">
                  <a v-if="s.url" :href="s.url" target="_blank" rel="noopener" class="text-primary underline underline-offset-4">{{ s.title }}</a><span v-else>{{ s.title }}</span><template v-if="i < openSources.length - 1">; </template>
                </template>
              </p>
              <UButton variant="link" color="primary" size="sm" class="on-brain p-0" @click="showOnBrain">Show on the brain</UButton>
            </div>
          </li>
        </ol>
        <div v-if="ranked.length > TOP" class="flex flex-wrap items-center gap-2.5">
          <span class="text-sm text-muted">{{ showAll ? `All ${ranked.length} regions.` : `The ${TOP} strongest of ${ranked.length} regions.` }}</span>
          <UButton size="xs" variant="ghost" :aria-expanded="showAll" @click="showAll = !showAll">{{ showAll ? `Show top ${TOP}` : `Show all ${ranked.length}` }}</UButton>
        </div>
      </section>

      <section class="panel grid gap-3 p-4 sm:p-5">
        <h2 class="text-xl">Coils</h2>
        <div class="overflow-x-auto rounded-md border border-default">
          <table class="coils">
            <thead><tr><th>Coil</th><th>Site</th><th title="Single coil, cortex straight below">Cortex below</th><th>Use</th></tr></thead>
            <tbody>
              <tr v-for="(c, ch) in coils" :key="ch" :class="{ off: !c || !c.weight }">
                <td class="num">CH{{ ch + 1 }}</td>
                <td class="num" :title="c ? siteInfo.get(c.site)?.function : undefined">{{ c?.site ?? '–' }}</td>
                <td class="num">{{ under[ch] ? fmtField(under[ch].uT) : '–' }}</td>
                <td><div class="bar" role="img" :aria-label="`${percent(c?.weight ?? 0)} %`"><i :style="{ width: `${percent(c?.weight ?? 0)}%` }"></i></div></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="grid gap-2.5 text-sm">
          <div v-for="(ph, i) in phasesShown" :key="i" class="border-t border-default pt-1.5">
            <b class="font-semibold text-highlighted">{{ phaseSel === 'all' ? `${i + 1}. ` : '' }}{{ ph.name }}</b>
            <div class="text-muted">{{ describePattern(ph.pattern) }}; {{ describeSpatial(ph.spatial) }}</div>
            <div v-if="ph.track2" class="text-muted">Second track: {{ describePattern(ph.track2.pattern) }}; {{ describeSpatial(ph.track2.spatial) }}</div>
          </div>
        </div>
      </section>

      <details class="notes panel">
        <summary>How this is computed, and what it does not show</summary>
        <ul>
          <li><b>Coils:</b> each 19 × 12 mm, 495-turn coil with its core is modelled as 24 current loops (exact elliptic-integral field), its face 3 mm off the scalp, axis toward the head centre. Values are scaled so that the program intensity is the peak 20 mm in front of the coil, as in the calibration.</li>
          <li><b>Program:</b> the engine's own spatial gains and waveform give the peak and RMS of |B| over each phase; coils that fire together add as vectors.</li>
          <li><b>Brain:</b> Brainnetome atlas surfaces (MNI152) with cerebellum and brainstem from CerebrA; target centres from the project research. Real heads differ from the template by 5–10 mm, coil placement by tape by about the same.</li>
          <li><b>Not activation:</b> the induced electric field is microvolts per metre for smooth signals, with microsecond spikes of at most about 10 mV/m at the steps of the output: far below the brain's own fields (0.1–1 V/m) and TMS (about 100 V/m). Deep structures (amygdala, hippocampus) get 5–20× less than the cortex below a coil. Independent double-blind tests of this helmet design found no effect of the field (Granqvist 2005; Gendle &amp; McGrath 2012).</li>
          <li><b>Electrodes and TMS:</b> the "what stimulating it did" notes come from direct electrical stimulation in epilepsy surgery (milliamps on the brain surface or in deep electrodes) and from TMS (about 100 V/m). They show what these regions can do when driven that hard; this helmet's fields are many orders of magnitude weaker. Most stimulated cortical sites produce nothing reportable (Fox 2020: 37 % of 1,537 sites).</li>
          <li><b>Claims</b> are reported as claims: Persinger-lab results were not independently replicated and Murphy's region functions are his own descriptions.</li>
        </ul>
        <p v-if="brain">Data: {{ brain.sources.mesh }} 10-05 sites: MNE-Python fsaverage_1005 (BSD-3). See <NuxtLink to="/docs/brain-view" class="text-primary underline underline-offset-4">Brain view notes</NuxtLink>.</p>
      </details>
    </aside>
  </div>
</template>

<style scoped>
.brain { display: grid; grid-template-columns: minmax(0, 1fr) minmax(19rem, 23.75rem); gap: 1.25rem; align-items: start; }
/* Pinned under the header and the slim bar with the sub-pages. The stage takes what the window leaves
   beside the controls around it (--around, measured). A viewer that is still taller than the window
   (a dozen phases, a low window) is pinned by its foot instead, so the brain and the legend stay in view. */
.viewer { --pin: calc(var(--header-h, 3.75rem) + 3.75rem); --stage-h: max(260px, min(58vh, 560px, calc(100vh - var(--pin) - var(--around, 22rem) - 1rem)));
  min-width: 0; container-type: inline-size; position: sticky; top: min(var(--pin), calc(100vh - var(--around, 22rem) - var(--stage-h) - 1rem)); }
.controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem 1rem; align-items: end; }
.brain-stage { position: relative; min-width: 0; height: var(--stage-h); }
.overlay { position: absolute; left: 0.6rem; top: 0.6rem; margin: 0; padding: 0.25rem 0.6rem; font-size: 0.8125rem; color: var(--ui-text); pointer-events: none;
  background: color-mix(in srgb, var(--ui-bg) 88%, transparent); border: 1px solid var(--ui-border); border-radius: calc(var(--ui-radius) * 1.5); }
.pick-card { top: auto; bottom: 0.6rem; pointer-events: auto; display: grid; gap: 0.1rem; padding: 0.5rem 2.25rem 0.5rem 0.75rem; max-width: min(20rem, calc(100% - 1.2rem)); }
.ticks { position: relative; height: 1rem; font-size: 0.6875rem; line-height: 1rem; color: var(--ui-text-muted); }
.ticks span { position: absolute; transform: translateX(-50%); }
.ticks span:first-child { transform: none; }
.ticks span:last-child { transform: translateX(-100%); }

.side { display: grid; gap: 1.25rem; min-width: 0; }
.target { display: flex; align-items: flex-start; gap: 0.6rem; padding: 0.5rem 0.65rem; text-align: left; cursor: pointer; font-size: 0.9rem; line-height: 1.4;
  background: var(--ui-bg-muted); border: 1px solid var(--ui-border); border-radius: calc(var(--ui-radius) * 1.5); }
.target:hover { border-color: var(--ui-border-accented); }
.target.sel { border-color: var(--ui-primary); background: var(--accent-soft); }
.target .dot { flex: none; width: 0.75rem; height: 0.75rem; margin-top: 0.3rem; border-radius: 99px; box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--text) 40%, transparent); }
.regions { list-style: none; margin: 0 -0.4rem; padding: 0; display: grid; gap: 0.25rem; }
.regions li { border: 1px solid transparent; border-radius: calc(var(--ui-radius) * 1.5); scroll-margin-top: calc(var(--header-h, 3.75rem) + 4rem); }
.regions li.sel { border-color: var(--ui-primary); background: var(--accent-soft); }
.region-row { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 5.75rem 3.1rem; gap: 0.6rem; align-items: center; padding: 0.5rem 0.6rem; text-align: left; cursor: pointer; border-radius: calc(var(--ui-radius) * 1.5); }
.region-row:hover { background: var(--ui-bg-elevated); }
.regions li.sel .region-row:hover { background: none; }
.rname { display: grid; gap: 1px; min-width: 0; overflow-wrap: anywhere; line-height: 1.35; }
.rname b { font-weight: 600; font-size: 0.9rem; color: var(--ui-text-highlighted); }
.rfield { display: grid; gap: 0.25rem; font-size: 0.95rem; line-height: 1.2; color: var(--ui-text-highlighted); }
.bar { display: block; height: 6px; background: var(--ui-border); border-radius: 99px; overflow: hidden; }
.bar > i { display: block; height: 100%; background: var(--ui-primary); transition: width 0.4s; }
/* ring keeps the colour code but shows the length of very weak (near-black) bars */
.rfield .bar > i { min-width: 4px; border-radius: 99px; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 40%, transparent); }
.rdepth { text-align: right; font-size: 0.875rem; white-space: nowrap; color: var(--ui-text-muted); }
.region-detail { display: grid; gap: 0.4rem; padding: 0 0.6rem 0.65rem; font-size: 0.875rem; line-height: 1.45; }
.on-brain { justify-self: start; display: none; }

.coils { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.coils th, .coils td { text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--ui-border); vertical-align: middle; }
.coils tr:last-child td { border-bottom: 0; }
.coils th { font-size: 0.78rem; font-weight: 600; color: var(--ui-text-muted); background: var(--ui-bg-muted); white-space: nowrap; }
.coils td:last-child { width: 30%; min-width: 3.5rem; }
.coils tr.off td { opacity: 0.45; }

.notes summary { cursor: pointer; padding: 1rem 1.25rem; font-family: var(--font-display); font-stretch: 86%; font-weight: 620; font-size: 1.1rem; line-height: 1.25; color: var(--ui-text-highlighted); }
.notes ul { list-style: disc; margin: 0; padding: 0 1.25rem 0 2.4rem; display: grid; gap: 0.4rem; font-size: 0.875rem; line-height: 1.5; }
.notes > p { padding: 0.65rem 1.25rem 1rem; font-size: 0.875rem; line-height: 1.5; color: var(--ui-text-muted); overflow-wrap: anywhere; }

@media (max-width: 900px) {
  .brain { grid-template-columns: 1fr; }
  .viewer { position: static; }
  /* square on phones, wide and short in landscape; 100cqw is the viewer card's inner width */
  .brain-stage { height: min(100cqw, 70vh); min-height: 300px; }
  .on-brain { display: inline-flex; }
}
@media (max-width: 520px) {
  .controls { grid-template-columns: 1fr; }
}
</style>
