<script setup>
// Forced-choice ESP training. Each target is drawn with the helmet's hardware
// RNG (rng.bytes; WebCrypto without a helmet or on error) and committed
// (SHA-256 of trial, target and nonce) before the guess; passes are not scored
// (Tart's ten-choice trainer). Stored as { [key]: {trials, summary} }.
import { computed, reactive, ref, watch } from 'vue'
import { device, call } from '../../ble/device.js'
import { randomBelow, randomHex, sha256Hex } from '../../lib/crypto.js'
import { choicePreimage, choiceSummary, binomialTail, uniformFromHex } from '../../lib/runs.js'

const props = defineProps({ input: { type: Object, required: true }, modelValue: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])

const key = props.input.key || 'choice'
const options = (props.input.options ?? []).map((o) => (typeof o === 'string' ? o : o.label ?? String(o)))
const total = Math.max(1, Number(props.input.trials) || 10)
const feedback = props.input.feedback !== false
const maxPasses = total

const saved = props.modelValue?.[key]
const state = reactive({ trials: saved?.trials ?? [], pending: saved?.pending ?? null, last: null })
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
async function drawTarget(n) {
  if (device.kind) {
    try {
      for (let i = 0; i < 4; i++) {
        const r = await call('rng.bytes', { n: 8 })
        const v = uniformFromHex(r?.hex, n)
        if (v !== null) return { target: v, source: r.source || device.kind }
        if (typeof r?.hex !== 'string' || !/^[0-9a-f]+$/i.test(r.hex)) break
      }
      notice.value = 'The helmet returned unusable random bytes; WebCrypto drew this target.'
    } catch (e) {
      notice.value = `Helmet RNG unavailable (${e.message}); WebCrypto drew this target.`
    }
  }
  return { target: randomBelow(n), source: 'webcrypto' }
}

async function draw() {
  if (done.value || state.pending || busy.value) return
  busy.value = true
  try {
    const { target, source } = await drawTarget(options.length)
    const p = { trial: state.trials.length + 1, target, source, nonce: randomHex(16) }
    p.commitment = await sha256Hex(choicePreimage(p))
    p.shownAt = Date.now()
    state.pending = p
    state.last = null
  } finally {
    busy.value = false
  }
}

const answering = ref(false)
async function answer(guess) {
  const p = state.pending
  if (!p || answering.value) return
  answering.value = true
  const pass = guess === null
  const verified = (await sha256Hex(choicePreimage(p))) === p.commitment
  answering.value = false
  const rec = { trial: p.trial, commitment: p.commitment, nonce: p.nonce, target: p.target, targetLabel: options[p.target], source: p.source, guess: pass ? null : guess, pass, hit: !pass && guess === p.target, ms: Date.now() - p.shownAt, verified }
  state.trials.push(rec)
  state.pending = null
  state.last = feedback && !pass ? rec : null
  if (!done.value && (!feedback || pass)) await draw()
}

const fmtP = (p) => (p < 0.001 ? '< 0.001' : p.toFixed(3))
if (!state.pending && !done.value && state.trials.length) draw()
</script>

<template>
  <div class="stack">
    <p class="prompt">{{ input.prompt || 'Pick the option you sense as the hidden target.' }}</p>
    <p class="small muted">
      {{ total }} scored trials, {{ options.length }} options: chance is {{ (100 / options.length).toFixed(0) }} % per trial
      ({{ (total / options.length).toFixed(1) }} hits expected<template v-if="needed !== null">; {{ needed }} or more give p &lt; 0.05</template>).
      {{ feedback ? 'You see the answer after each guess.' : 'Answers are shown at the end.' }} Pass skips a target without scoring.
      Targets: {{ device.kind === 'ble' ? 'helmet hardware RNG' : device.kind === 'demo' ? 'demo helmet (WebCrypto)' : 'WebCrypto (helmet not connected)' }}.
    </p>
    <p v-if="notice" class="small warn">{{ notice }}</p>

    <div v-if="!state.trials.length && !state.pending" class="row">
      <button type="button" class="btn primary" :disabled="busy" @click="draw">Start</button>
    </div>

    <section v-if="state.pending" class="trial" aria-live="polite">
      <div class="row between">
        <b>Trial {{ scored + 1 }} of {{ total }}</b>
        <span v-if="feedback" class="small muted">{{ summary.hits }} hits so far</span>
      </div>
      <div class="small muted">Target fixed. Commitment (SHA-256):</div>
      <div class="mono">{{ state.pending.commitment }}</div>
      <div class="opts" role="group" aria-label="Your choice">
        <button v-for="(o, i) in options" :key="i" type="button" class="btn opt" :disabled="answering" @click="answer(i)">{{ o }}</button>
      </div>
      <div class="row">
        <button type="button" class="btn ghost sm" :disabled="answering || passes >= maxPasses" @click="answer(null)">Pass</button>
      </div>
    </section>

    <section v-if="state.last" class="trial" aria-live="assertive">
      <div class="big num" :class="state.last.hit ? 'ok' : ''">{{ state.last.hit ? 'Hit' : 'Miss' }}</div>
      <p class="small">Target: <b>{{ state.last.targetLabel }}</b> · your choice: {{ options[state.last.guess] }}</p>
      <p class="small" :class="state.last.verified ? 'ok' : 'bad'">{{ state.last.verified ? '✓' : '✗' }} Commitment matches trial {{ state.last.trial }}, target {{ state.last.target }}, nonce {{ state.last.nonce }}</p>
      <div v-if="!done" class="row"><button type="button" class="btn primary" @click="draw">Next trial</button></div>
    </section>

    <section v-if="done" class="trial" aria-live="polite">
      <h3>Result</h3>
      <p class="num big" :class="summary.p < 0.05 ? 'ok' : ''">{{ summary.hits }} / {{ summary.n }}</p>
      <p class="small">Chance expectation {{ summary.expected.toFixed(1) }} hits. Exact binomial p (one-sided) = {{ fmtP(summary.p) }}.<template v-if="summary.passes"> {{ summary.passes }} passes (not scored).</template></p>
      <p class="small muted">A single run says little: count every run you do, and expect "good" runs to regress to chance on confirmation runs.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Target</th><th>Choice</th><th></th><th>Check</th></tr></thead>
          <tbody>
            <tr v-for="(t, i) in state.trials" :key="i">
              <td class="num">{{ t.trial }}</td><td>{{ t.targetLabel }}</td><td>{{ t.pass ? 'pass' : options[t.guess] }}</td>
              <td :class="t.hit ? 'ok' : ''">{{ t.pass ? '' : t.hit ? 'hit' : '' }}</td><td :class="t.verified ? 'ok' : 'bad'">{{ t.verified ? '✓' : '✗' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.prompt { font-size: 15px; }
.trial { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
.between { justify-content: space-between; }
.opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.opt { padding: 16px 10px; font-size: 16px; }
.big { font-size: 34px; line-height: 1.1; }
</style>
