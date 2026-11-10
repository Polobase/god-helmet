<script setup lang="ts">
// Micro-PK intention task (May & Honorton paradigm). Bits come live from the
// helmet's hardware RNG (rng.bytes) when connected, else from WebCrypto, at the
// source protocol's rate, and are scored against an alternating target so a
// generator bias cancels. A trial is stored when it starts and grows with every
// chunk, so leaving part-way keeps the bits drawn so far (no optional stopping).
// Stored as { [key]: {trials, summary} } with the raw hex of every trial.
import { randomBelow, randomHex } from '#core/lib/crypto.js'
import { device, call, errorMessage } from '~/lib/device'
import {
  hexToBits, isHit, bitZ, rngSummary, alternatingHits, isHex, rngRate,
  type RngAim, type RngInputSpec, type RngSummary, type RngTrial,
} from '~/lib/guides'

interface Stored { aim: string, firstAim: 'high' | 'low', bitsPerTrial: number, bitsPerSecond: number, trials: RngTrial[], summary: RngSummary }
const props = defineProps<{ input: RngInputSpec, modelValue?: Record<string, Stored> | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, Stored>] }>()

const key = props.input.key || 'rng'
const total = Math.max(1, Number(props.input.trials) || 10)
const bits = Math.min(2048, Math.max(8, Number(props.input.bits) || 100))
const aimMode = ['high', 'low', 'alternate', 'none'].includes(props.input.aim ?? '') ? props.input.aim! : 'alternate'
const FOCUS_S = 3
const rate = rngRate(bits) // bits per second
const TICK_MS = 200
const perTick = Math.max(1, Math.round((rate * TICK_MS) / 1000))
const chunkBytes = Math.ceil(rate / 8) // about one second of bits per request
const BAND_HOLD_MS = 1000 // the band light changes at most once a second (no flicker)

const saved = props.modelValue?.[key]
const state = reactive<{ firstAim: 'high' | 'low', trials: RngTrial[] }>({ firstAim: saved?.firstAim ?? (randomBelow(2) ? 'high' : 'low'), trials: saved?.trials ?? [] })
const phase = ref<'ready' | 'focus' | 'running'>('ready')
const countdown = ref(0)
const shown = ref(0) // bits displayed in the current trial
const current = ref<RngTrial | null>(null) // the trial record being collected or last shown
const band = ref(false)
const notice = ref('')
let bandAt = 0
let timer: ReturnType<typeof setInterval> | 0 = 0
let fetching = false

const aimFor = (i: number): RngAim => (aimMode === 'alternate' ? ((i % 2 === 0) === (state.firstAim === 'high') ? 'high' : 'low') : aimMode as RngAim)
const nextAim = computed(() => aimFor(state.trials.length))
const allStarted = computed(() => state.trials.length >= total)
const done = computed(() => allStarted.value && phase.value === 'ready')
const summary = computed(() => rngSummary(state.trials))
// On screen, the trial being collected joins the totals only when it ends.
const settled = computed(() => rngSummary(state.trials.filter((t) => !(phase.value === 'running' && t === current.value))))
const cut = computed(() => state.trials.filter((t) => t.complete === false && t !== current.value))

watch(state, () => {
  emit('update:modelValue', { [key]: { aim: aimMode, firstAim: state.firstAim, bitsPerTrial: bits, bitsPerSecond: rate, trials: state.trials, summary: summary.value } })
}, { deep: true, immediate: true })

// Live gauge for the bits shown so far.
const gauge = computed(() => {
  const t = current.value
  if (!t) return null
  const seen = hexToBits(t.hex, Math.min(shown.value, t.bits))
  const hits = alternatingHits(seen)
  return { n: seen.length, hits, rate: seen.length ? hits / seen.length : 0.5 }
})
// Feedback band of the original study: last 10 bits at >= 70 % (high) or <= 30 % (low).
function inBandNow() {
  const t = current.value!
  const n = Math.min(shown.value, t.bits)
  if (n < 10) return false
  const last = hexToBits(t.hex, n).slice(-10)
  const hits = last.reduce((a, b, j) => a + (isHit(b, n - 10 + j) ? 1 : 0), 0)
  if (t.aim === 'none') return false // control block: no feedback
  return t.aim === 'high' ? hits >= 7 : hits <= 3
}

async function fetchBytes(n: number): Promise<{ hex: string, source: string }> {
  if (device.kind) {
    try {
      const r = await call<{ hex?: unknown, source?: string } | null>('rng.bytes', { n })
      const hex = r?.hex
      if (isHex(hex) && hex.length >= n * 2) return { hex: hex.slice(0, n * 2).toLowerCase(), source: r?.source || device.kind }
      notice.value = 'The helmet returned too few or malformed random bytes; WebCrypto filled in.'
    } catch (e) {
      notice.value = `Helmet RNG unavailable (${errorMessage(e)}); WebCrypto filled in.`
    }
  }
  return { hex: randomHex(n), source: 'webcrypto' }
}

async function fetchChunk(t: RngTrial) {
  if (fetching || t.bits >= bits || t.interrupted) return
  fetching = true
  try {
    const { hex, source } = await fetchBytes(Math.min(chunkBytes, Math.ceil((bits - t.bits) / 8)))
    if (t.interrupted) return
    t.hex += hex
    t.source = !t.source || t.source === source ? source : 'mixed'
    t.bits = Math.min(bits, t.hex.length * 4)
    t.hits = alternatingHits(hexToBits(t.hex, t.bits))
  } finally {
    fetching = false
  }
}

function tickTrial() {
  const t = current.value!
  shown.value = Math.min(t.bits, shown.value + perTick)
  if (t.bits - shown.value < perTick * 2) fetchChunk(t)
  const now = performance.now()
  const b = inBandNow()
  if (b !== band.value && now - bandAt >= BAND_HOLD_MS) {
    band.value = b
    bandAt = now
  }
  if (shown.value >= bits) {
    clearInterval(timer)
    Object.assign(t, { complete: true, endedAt: new Date().toISOString() })
    phase.value = 'ready'
  }
}

function startTrial() {
  if (phase.value !== 'ready' || allStarted.value) return
  phase.value = 'focus'
  countdown.value = FOCUS_S
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value > 0) return
    clearInterval(timer)
    state.trials.push({ trial: state.trials.length + 1, aim: nextAim.value, bits: 0, planned: bits, hits: 0, hex: '', source: '', at: new Date().toISOString(), complete: false })
    current.value = state.trials[state.trials.length - 1]!
    shown.value = 0
    band.value = false
    bandAt = 0
    phase.value = 'running'
    fetchChunk(current.value)
    timer = setInterval(tickTrial, TICK_MS)
  }, 1000)
}

onBeforeUnmount(() => {
  clearInterval(timer)
  const t = current.value
  if (t && t.complete === false) t.interrupted = true
})

const pct = (x: number | null) => `${Math.round((x ?? 0) * 100)} %`
const zOf = (t: RngTrial) => bitZ(t.aim === 'low' ? t.bits - t.hits : t.hits, t.bits)
const fmtP = (p: number) => (p < 0.001 ? '< 0.001' : p.toFixed(3))
const shownAim = computed(() => (current.value && phase.value === 'running' ? current.value.aim : nextAim.value))
const source = computed(() => (device.kind === 'ble' || device.kind === 'usb' ? 'helmet hardware RNG' : device.kind === 'demo' ? 'demo (WebCrypto)' : 'WebCrypto (helmet not connected)'))
</script>

<template>
  <div class="grid gap-4">
    <p class="text-highlighted">{{ input.prompt || 'Hold the aim in mind while the random generator runs.' }}</p>
    <p class="measure text-sm text-muted">
      {{ total }} trials of {{ bits }} random bits, drawn live at {{ rate }} bits per second. Each bit is compared with an alternating target; chance is 50 % hits.
      <template v-if="aimMode === 'alternate'">The aim alternates between HIGH (more hits) and LOW (fewer hits).</template>
      <template v-else-if="aimMode === 'none'">Control block: no aim, no feedback; let the bits run.</template>
      Source: {{ source }}.
    </p>

    <section v-if="!done || phase !== 'ready'" class="grid gap-2.5 border-t border-default pt-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <b class="text-highlighted">Trial {{ Math.min(state.trials.length + (phase === 'running' ? 0 : 1), total) }} of {{ total }}</b>
        <span class="aim" :class="shownAim">{{ shownAim === 'none' ? 'No aim' : `Aim: ${shownAim.toUpperCase()}` }}</span>
      </div>

      <div v-if="phase === 'focus'" class="num font-display text-4xl font-[620] leading-tight text-highlighted" aria-live="assertive">Focus… {{ countdown }}</div>
      <div v-else-if="phase === 'running' && !gauge?.n" class="text-sm text-muted">Collecting bits…</div>

      <div v-if="gauge && phase !== 'focus'" class="gauge" :class="{ band: band && phase === 'running' }" role="img" :aria-label="`${gauge.hits} hits of ${gauge.n} bits`">
        <div class="mid" />
        <div class="needle" :style="{ left: `${Math.max(0, Math.min(100, 50 + (gauge.rate - 0.5) * 250))}%` }" />
        <span class="lo">LOW</span><span class="hi">HIGH</span>
      </div>
      <p v-if="gauge && phase !== 'focus'" class="text-sm">
        <span class="num text-highlighted">{{ gauge.hits }} / {{ gauge.n }}</span> hits ({{ pct(gauge.rate) }})<template v-if="band && phase === 'running'">, <b class="text-success">in the aimed band</b></template>
      </p>

      <div v-if="phase === 'ready' && !done">
        <UButton color="primary" variant="solid" @click="startTrial">{{ state.trials.length ? 'Next trial' : 'Start trial' }}</UButton>
      </div>
    </section>

    <p v-if="notice" class="text-sm text-warning">{{ notice }}</p>

    <section v-if="settled.n" class="grid gap-2 border-t border-default pt-4" aria-live="polite">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <b class="text-highlighted">{{ done ? 'Result' : 'So far' }}</b>
        <span class="num text-highlighted">z = {{ settled.z.toFixed(2) }}, p = {{ fmtP(settled.p) }}</span>
      </div>
      <p class="text-sm">{{ settled.aimed }} of {{ settled.n }} bits {{ settled.control ? 'hit the target' : 'went the aimed way' }} ({{ pct(settled.rate) }}; chance 50 %).<template v-if="settled.diffZ !== null"> High-minus-low z = {{ settled.diffZ.toFixed(2) }}.</template></p>
      <p v-if="cut.length" class="text-sm text-warning">{{ cut.length }} trial(s) were cut short when you left the step; the bits drawn until then are kept and counted.</p>
      <div v-if="done" class="overflow-x-auto">
        <table class="w-full max-w-xl text-left text-sm">
          <thead><tr class="border-b border-default text-muted"><th class="py-1.5 pr-4 font-normal">#</th><th class="py-1.5 pr-4 font-normal">Aim</th><th class="py-1.5 pr-4 font-normal">Hits</th><th class="py-1.5 text-right font-normal">z</th></tr></thead>
          <tbody>
            <tr v-for="t in state.trials" :key="t.trial" class="border-b border-default">
              <td class="num py-1.5 pr-4">{{ t.trial }}</td><td class="py-1.5 pr-4">{{ t.aim }}</td>
              <td class="num py-1.5 pr-4">{{ t.hits }}/{{ t.bits }}<span v-if="t.complete === false" class="text-muted"> (cut short)</span></td>
              <td class="num py-1.5 text-right">{{ zOf(t).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="done" class="measure text-sm text-muted">Reported effects in this paradigm are tiny (a few in 10,000 per bit) and contested; one session cannot show them. Decide the number of sessions in advance and keep every one.</p>
    </section>
  </div>
</template>

<style scoped>
.aim { font: 620 0.85rem var(--font-display); letter-spacing: 0.08em; padding: 0.1rem 0.65rem; border-radius: 99px; border: 1px solid var(--line); color: var(--muted); }
.aim.high { border-color: var(--accent); color: var(--accent); }
.aim.low { border-color: var(--blue); color: var(--blue); }
.gauge { position: relative; height: 2.5rem; border: 1px solid var(--line); border-radius: calc(var(--ui-radius) * 1.5); background: var(--surface-2); overflow: hidden; transition: box-shadow 0.4s; }
.gauge.band { box-shadow: 0 0 0 2px var(--ok) inset; }
.mid { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--muted); }
.needle { position: absolute; top: 4px; bottom: 4px; width: 4px; margin-left: -2px; border-radius: 2px; background: var(--accent); transition: left 0.2s linear; }
.lo, .hi { position: absolute; bottom: 2px; color: var(--muted); font-size: 0.65rem; letter-spacing: 0.1em; }
.lo { left: 8px; }
.hi { right: 8px; }
</style>
