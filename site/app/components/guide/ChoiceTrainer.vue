<script setup lang="ts">
// Forced-choice ESP training. Each target is drawn with the helmet's hardware
// RNG (rng.bytes; WebCrypto without a helmet or on error) and committed
// (SHA-256 of trial, target and nonce) before the guess; passes are not scored
// (Tart's ten-choice trainer). Stored as { [key]: {trials, summary} }.
import { randomBelow, randomHex, sha256Hex } from '#core/lib/crypto.js'
import { device, call, errorMessage } from '~/lib/device'
import {
  choicePreimage, choiceSummary, binomialTail, uniformFromHex,
  type ChoiceInputSpec, type ChoicePending, type ChoiceSummary, type ChoiceTrial,
} from '~/lib/guides'

interface Stored { options: string[], feedback: boolean, trials: ChoiceTrial[], pending: ChoicePending | null, summary: ChoiceSummary }
const props = defineProps<{ input: ChoiceInputSpec, modelValue?: Record<string, Stored> | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, Stored>] }>()

const key = props.input.key || 'choice'
const options = (props.input.options ?? []).map((o) => (typeof o === 'string' ? o : o.label ?? String(o)))
const total = Math.max(1, Number(props.input.trials) || 10)
const feedback = props.input.feedback !== false
const maxPasses = total

const saved = props.modelValue?.[key]
const state = reactive<{ trials: ChoiceTrial[], pending: ChoicePending | null, last: ChoiceTrial | null }>({ trials: saved?.trials ?? [], pending: saved?.pending ?? null, last: null })
const busy = ref(false)
const notice = ref('')

const scored = computed(() => state.trials.filter((t) => !t.pass).length)
const passes = computed(() => state.trials.length - scored.value)
const done = computed(() => scored.value >= total)
const summary = computed(() => choiceSummary(state.trials, options.length))
// Hits needed for p < 0.05 at this run length.
const needed = computed(() => {
  for (let k = 0; k <= total; k++) if (binomialTail(k, total, 1 / options.length) < 0.05) return k
  return null
})

watch(() => [state.trials.length, state.pending], () => {
  emit('update:modelValue', { [key]: { options, feedback, trials: state.trials, pending: state.pending, summary: summary.value } })
}, { deep: true })

// Target from the helmet's RNG by rejection sampling; WebCrypto as the fallback.
async function drawTarget(n: number): Promise<{ target: number, source: string }> {
  if (device.kind) {
    try {
      for (let i = 0; i < 4; i++) {
        const r = await call<{ hex?: unknown, source?: string } | null>('rng.bytes', { n: 8 })
        const v = uniformFromHex(r?.hex, n)
        if (v !== null) return { target: v, source: r?.source || device.kind }
        if (typeof r?.hex !== 'string' || !/^[0-9a-f]+$/i.test(r.hex)) break
      }
      notice.value = 'The helmet returned unusable random bytes; WebCrypto drew this target.'
    } catch (e) {
      notice.value = `Helmet RNG unavailable (${errorMessage(e)}); WebCrypto drew this target.`
    }
  }
  return { target: randomBelow(n), source: 'webcrypto' }
}

async function draw() {
  if (done.value || state.pending || busy.value) return
  busy.value = true
  try {
    const { target, source } = await drawTarget(options.length)
    const p: ChoicePending = { trial: state.trials.length + 1, target, source, nonce: randomHex(16), commitment: '', shownAt: 0 }
    p.commitment = await sha256Hex(choicePreimage(p))
    p.shownAt = Date.now()
    state.pending = p
    state.last = null
  } finally {
    busy.value = false
  }
}

const answering = ref(false)
async function answer(guess: number | null) {
  const p = state.pending
  if (!p || answering.value) return
  answering.value = true
  const pass = guess === null
  const verified = (await sha256Hex(choicePreimage(p))) === p.commitment
  answering.value = false
  const rec: ChoiceTrial = { trial: p.trial, commitment: p.commitment, nonce: p.nonce, target: p.target, targetLabel: options[p.target], source: p.source, guess: pass ? null : guess, pass, hit: !pass && guess === p.target, ms: Date.now() - p.shownAt, verified }
  state.trials.push(rec)
  state.pending = null
  state.last = feedback && !pass ? rec : null
  if (!done.value && (!feedback || pass)) await draw()
}

const fmtP = (p: number) => (p < 0.001 ? '< 0.001' : p.toFixed(3))
const source = computed(() => (device.kind === 'ble' || device.kind === 'usb' ? 'helmet hardware RNG' : device.kind === 'demo' ? 'demo helmet (WebCrypto)' : 'WebCrypto (helmet not connected)'))
if (!state.pending && !done.value && state.trials.length) draw()
</script>

<template>
  <div class="grid gap-4">
    <p class="text-highlighted">{{ input.prompt || 'Pick the option you sense as the hidden target.' }}</p>
    <p class="measure text-sm text-muted">
      {{ total }} scored trials, {{ options.length }} options: chance is {{ (100 / options.length).toFixed(0) }} % per trial
      ({{ (total / options.length).toFixed(1) }} hits expected<template v-if="needed !== null">; {{ needed }} or more give p &lt; 0.05</template>).
      {{ feedback ? 'You see the answer after each guess.' : 'Answers are shown at the end.' }} Pass skips a target without scoring.
      Targets: {{ source }}.
    </p>
    <p v-if="notice" class="text-sm text-warning">{{ notice }}</p>

    <div v-if="!state.trials.length && !state.pending">
      <UButton color="primary" variant="solid" :disabled="busy" @click="draw">Start</UButton>
    </div>

    <section v-if="state.pending" class="grid gap-2.5 border-t border-default pt-4" aria-live="polite">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <b class="text-highlighted">Trial {{ scored + 1 }} of {{ total }}</b>
        <span v-if="feedback" class="num text-sm text-muted">{{ summary.hits }} hits so far</span>
      </div>
      <div class="text-sm text-muted">Target fixed. Commitment (SHA-256):</div>
      <div class="break-all font-mono text-xs text-muted">{{ state.pending.commitment }}</div>
      <div class="options" role="group" aria-label="Your choice">
        <UButton v-for="(o, i) in options" :key="i" size="xl" block class="py-4" :disabled="answering" @click="answer(i)">{{ o }}</UButton>
      </div>
      <div>
        <UButton size="sm" variant="ghost" :disabled="answering || passes >= maxPasses" @click="answer(null)">Pass</UButton>
      </div>
    </section>

    <section v-if="state.last" class="grid gap-2 border-t border-default pt-4" aria-live="assertive">
      <div class="num font-display text-4xl font-[620] leading-tight" :class="state.last.hit ? 'text-success' : 'text-highlighted'">{{ state.last.hit ? 'Hit' : 'Miss' }}</div>
      <p class="text-sm">Target: <b class="text-highlighted">{{ state.last.targetLabel }}</b>, your choice: {{ options[state.last.guess ?? -1] }}</p>
      <p class="flex gap-1.5 text-sm" :class="state.last.verified ? 'text-success' : 'text-error'">
        <UIcon :name="state.last.verified ? 'i-lucide-check' : 'i-lucide-x'" class="mt-0.5 size-4 shrink-0" /><span class="sr-only">{{ state.last.verified ? 'verified' : 'not verified' }}: </span>
        <span class="min-w-0 break-words">Commitment matches trial {{ state.last.trial }}, target {{ state.last.target }}, nonce {{ state.last.nonce }}</span>
      </p>
      <div v-if="!done"><UButton color="primary" variant="solid" @click="draw">Next trial</UButton></div>
    </section>

    <section v-if="done" class="grid gap-2 border-t border-default pt-4" aria-live="polite">
      <h2 class="text-xl">Result</h2>
      <p class="num font-display text-4xl font-[620] leading-tight" :class="summary.p < 0.05 ? 'text-success' : 'text-highlighted'">{{ summary.hits }} / {{ summary.n }}</p>
      <p class="text-sm">Chance expectation {{ summary.expected.toFixed(1) }} hits. Exact binomial p (one-sided) = {{ fmtP(summary.p) }}.<template v-if="summary.passes">{{ ` ${summary.passes}` }} passes (not scored).</template></p>
      <p class="measure text-sm text-muted">A single run says little: count every run you do, and expect "good" runs to regress to chance on confirmation runs.</p>
      <div class="overflow-x-auto">
        <table class="w-full max-w-2xl text-left text-sm">
          <thead><tr class="border-b border-default text-muted"><th class="py-1.5 pr-4 font-normal">#</th><th class="py-1.5 pr-4 font-normal">Target</th><th class="py-1.5 pr-4 font-normal">Choice</th><th class="py-1.5 pr-4 font-normal"><span class="sr-only">Hit</span></th><th class="py-1.5 font-normal">Check</th></tr></thead>
          <tbody>
            <tr v-for="(t, i) in state.trials" :key="i" class="border-b border-default">
              <td class="num py-1.5 pr-4">{{ t.trial }}</td><td class="py-1.5 pr-4">{{ t.targetLabel }}</td><td class="py-1.5 pr-4">{{ t.pass ? 'pass' : options[t.guess ?? -1] }}</td>
              <td class="py-1.5 pr-4" :class="t.hit ? 'text-success' : ''">{{ t.pass ? '' : t.hit ? 'hit' : '' }}</td>
              <td class="py-1.5" :class="t.verified ? 'text-success' : 'text-error'"><UIcon :name="t.verified ? 'i-lucide-check' : 'i-lucide-x'" class="size-4 align-middle" /><span class="sr-only">{{ t.verified ? 'verified' : 'not verified' }}: </span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.options { display: grid; grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr)); gap: 0.5rem; }
</style>
