<script setup>
// Micro-PK intention task (May & Honorton paradigm). Bits come live from the
// helmet's hardware RNG (rng.bytes) when connected, else from WebCrypto, at the
// source protocol's rate, and are scored against an alternating target so a
// generator bias cancels. A trial is stored when it starts and grows with every
// chunk, so leaving part-way keeps the bits drawn so far (no optional stopping).
// Stored as { [key]: {trials, summary} } with the raw hex of every trial.
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { device, call } from '../../ble/device.js'
import { randomBelow, randomHex } from '../../lib/crypto.js'
import { hexToBits, isHit, bitZ, rngSummary, alternatingHits, isHex, rngRate } from '../../lib/runs.js'

const props = defineProps({ input: { type: Object, required: true }, modelValue: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])

const key = props.input.key || 'rng'
const total = Math.max(1, Number(props.input.trials) || 10)
const bits = Math.min(2048, Math.max(8, Number(props.input.bits) || 100))
const aimMode = ['high', 'low', 'alternate', 'none'].includes(props.input.aim) ? props.input.aim : 'alternate'
const FOCUS_S = 3
const rate = rngRate(bits) // bits per second
const TICK_MS = 200
const perTick = Math.max(1, Math.round((rate * TICK_MS) / 1000))
const chunkBytes = Math.ceil(rate / 8) // about one second of bits per request
const BAND_HOLD_MS = 1000 // the band light changes at most once a second (no flicker)

const saved = props.modelValue?.[key]
const state = reactive({ firstAim: saved?.firstAim ?? (randomBelow(2) ? 'high' : 'low'), trials: saved?.trials ?? [] })
const phase = ref('ready') // ready | focus | running
const countdown = ref(0)
const shown = ref(0) // bits displayed in the current trial
const current = ref(null) // the trial record being collected or last shown
const band = ref(false)
const notice = ref('')
let bandAt = 0
let timer = 0
let fetching = false

const aimFor = (i) => (aimMode === 'alternate' ? ((i % 2 === 0) === (state.firstAim === 'high') ? 'high' : 'low') : aimMode)
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
  const t = current.value
  const n = Math.min(shown.value, t.bits)
  if (n < 10) return false
  const last = hexToBits(t.hex, n).slice(-10)
  const hits = last.reduce((a, b, j) => a + (isHit(b, n - 10 + j) ? 1 : 0), 0)
  if (t.aim === 'none') return false // control block: no feedback
  return t.aim === 'high' ? hits >= 7 : hits <= 3
}

async function fetchBytes(n) {
  if (device.kind) {
    try {
      const r = await call('rng.bytes', { n })
      if (isHex(r?.hex) && r.hex.length >= n * 2) return { hex: r.hex.slice(0, n * 2).toLowerCase(), source: r.source || device.kind }
      notice.value = 'The helmet returned too few or malformed random bytes; WebCrypto filled in.'
    } catch (e) {
      notice.value = `Helmet RNG unavailable (${e.message}); WebCrypto filled in.`
    }
  }
  return { hex: randomHex(n), source: 'webcrypto' }
}

async function fetchChunk(t) {
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
  const t = current.value
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
    current.value = state.trials[state.trials.length - 1]
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

const pct = (x) => `${Math.round(x * 100)} %`
const zOf = (t) => bitZ(t.aim === 'low' ? t.bits - t.hits : t.hits, t.bits)
const fmtP = (p) => (p < 0.001 ? '< 0.001' : p.toFixed(3))
const shownAim = computed(() => (current.value && phase.value === 'running' ? current.value.aim : nextAim.value))
</script>

<template>
  <div class="stack">
    <p class="prompt">{{ input.prompt || 'Hold the aim in mind while the random generator runs.' }}</p>
    <p class="small muted">
      {{ total }} trials of {{ bits }} random bits, drawn live at {{ rate }} bits per second. Each bit is compared with an alternating target; chance is 50 % hits.
      <template v-if="aimMode === 'alternate'">The aim alternates between HIGH (more hits) and LOW (fewer hits).</template>
      <template v-else-if="aimMode === 'none'">Control block: no aim, no feedback; let the bits run.</template>
      Source: {{ device.kind === 'ble' ? 'helmet hardware RNG' : device.kind === 'demo' ? 'demo (WebCrypto)' : 'WebCrypto (helmet not connected)' }}.
    </p>

    <section v-if="!done || phase !== 'ready'" class="trial">
      <div class="row between">
        <b>Trial {{ Math.min(state.trials.length + (phase === 'running' ? 0 : 1), total) }} of {{ total }}</b>
        <span class="aim" :class="shownAim">{{ shownAim === 'none' ? 'No aim' : `Aim: ${shownAim.toUpperCase()}` }}</span>
      </div>

      <div v-if="phase === 'focus'" class="big num" aria-live="assertive">Focus… {{ countdown }}</div>
      <div v-else-if="phase === 'running' && !gauge?.n" class="small muted">Collecting bits…</div>

      <div v-if="gauge && phase !== 'focus'" class="gauge" :class="{ band: band && phase === 'running' }" role="img" :aria-label="`${gauge.hits} hits of ${gauge.n} bits`">
        <div class="mid"></div>
        <div class="needle" :style="{ left: `${Math.max(0, Math.min(100, 50 + (gauge.rate - 0.5) * 250))}%` }"></div>
        <span class="lo small">LOW</span><span class="hi small">HIGH</span>
      </div>
      <p v-if="gauge && phase !== 'focus'" class="small">
        <span class="num">{{ gauge.hits }} / {{ gauge.n }}</span> hits ({{ pct(gauge.rate) }})<template v-if="band && phase === 'running'"> · <b class="ok">in the aimed band</b></template>
      </p>

      <div v-if="phase === 'ready' && !done" class="row">
        <button type="button" class="btn primary" @click="startTrial">{{ state.trials.length ? 'Next trial' : 'Start trial' }}</button>
      </div>
    </section>

    <p v-if="notice" class="small warn">{{ notice }}</p>

    <section v-if="settled.n" class="trial" aria-live="polite">
      <div class="row between">
        <b>{{ done ? 'Result' : 'So far' }}</b>
        <span class="num">z = {{ settled.z.toFixed(2) }} · p = {{ fmtP(settled.p) }}</span>
      </div>
      <p class="small">{{ settled.aimed }} of {{ settled.n }} bits {{ settled.control ? 'hit the target' : 'went the aimed way' }} ({{ pct(settled.rate) }}; chance 50 %).<template v-if="settled.diffZ !== null"> High-minus-low z = {{ settled.diffZ.toFixed(2) }}.</template></p>
      <p v-if="cut.length" class="small warn">{{ cut.length }} trial(s) were cut short when you left the step; the bits drawn until then are kept and counted.</p>
      <div v-if="done" class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Aim</th><th>Hits</th><th>z</th></tr></thead>
          <tbody><tr v-for="t in state.trials" :key="t.trial"><td class="num">{{ t.trial }}</td><td>{{ t.aim }}</td><td class="num">{{ t.hits }}/{{ t.bits }}<span v-if="t.complete === false" class="muted"> (cut short)</span></td><td class="num">{{ zOf(t).toFixed(2) }}</td></tr></tbody>
        </table>
      </div>
      <p v-if="done" class="small muted">Reported effects in this paradigm are tiny (a few in 10,000 per bit) and contested; one session cannot show them. Decide the number of sessions in advance and keep every one.</p>
    </section>
  </div>
</template>

<style scoped>
.prompt { font-size: 15px; }
.trial { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
.between { justify-content: space-between; }
.aim { font: 600 14px var(--font-display); letter-spacing: .08em; padding: 2px 10px; border-radius: 99px; border: 1px solid var(--line); }
.aim.high { border-color: var(--accent); color: var(--accent); }
.aim.low { border-color: var(--blue); color: var(--blue); }
.big { font-size: 34px; line-height: 1.1; }
.gauge { position: relative; height: 40px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); overflow: hidden; transition: box-shadow .4s; }
.gauge.band { box-shadow: 0 0 0 2px var(--ok) inset; }
.mid { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--muted); }
.needle { position: absolute; top: 4px; bottom: 4px; width: 4px; margin-left: -2px; border-radius: 2px; background: var(--accent); transition: left .2s linear; }
.lo, .hi { position: absolute; bottom: 2px; color: var(--muted); font-size: 10px; letter-spacing: .1em; }
.lo { left: 8px; } .hi { right: 8px; }
</style>
