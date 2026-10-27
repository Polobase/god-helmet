<script setup>
// Questionnaire from lib/instruments.js: stored as { instrument, answers, scores, complete, alerts }.
// Items limited by askIf are hidden when the run context rules them out.
import { computed, inject, reactive, ref, useId, watch } from 'vue'
import { instrumentById, itemScale, isAsked, isComplete, sessionMinutes } from '../../lib/instruments.js'

const props = defineProps({ input: { type: Object, required: true }, modelValue: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])
const run = inject('guideRun', null)
const uid = useId()

const inst = instrumentById(props.input.instrument)
const answers = reactive({ ...(props.modelValue?.answers ?? {}) })
const submitted = ref(false)

// Which conditions of this run were blinded (for the blinding check).
const rec = run?.record
const context = rec ? { blinded: { audio: !!rec.audio?.blind, helmet: !!(rec.helmet?.blind && rec.helmet?.logId) } } : undefined
const asked = (item) => isAsked(inst, item, answers, context) !== false
const shown = computed(() => (inst?.items ?? []).filter(asked))

const scaleOf = (item) => itemScale(inst, item) ?? { min: 0, max: 10 }
const isNumber = (item) => item.kind === 'number'
// labels[i] belongs to min + i; a two-entry list on a longer scale names the ends.
const labelAt = (sc, i, n) => (sc.labels?.length === 2 && n > 2 ? (i === 0 ? sc.labels[0] : i === n - 1 ? sc.labels[1] : '') : sc.labels?.[i] ?? '')
const points = (sc) => {
  const n = sc.max - sc.min + 1
  return Array.from({ length: n }, (_, i) => ({ v: sc.min + i, label: labelAt(sc, i, n) }))
}
// Small, fully labelled scales show their words; the rest show numbers.
const worded = (sc) => sc.max - sc.min <= 4 && points(sc).every((p) => p.label)
const anchors = (sc) => points(sc).filter((p) => p.label)
const answered = (item) => answers[item.id] !== undefined && answers[item.id] !== null && answers[item.id] !== ''
const required = (item) => !item.optional && isAsked(inst, item, answers, context) === true
const missing = computed(() => shown.value.filter((i) => required(i) && !answered(i)).length)
const legend = computed(() => {
  const sc = inst?.scale
  return sc && points(sc).every((p) => p.label) && !worded(sc) ? points(sc).map((p) => `${p.v} = ${p.label}`).join(' · ') : ''
})

// Session time for a time estimate: the steps that played audio or ran the helmet.
const actualMinutes = () => {
  const m = run?.guide ? sessionMinutes(run.guide, run.record?.steps) : null
  return m === null ? undefined : Math.round(m * 10) / 10
}

const scoring = computed(() => {
  if (!inst) return { scores: null, error: '' }
  try {
    const s = inst.score({ ...answers }, { actualMinutes: actualMinutes() })
    return { scores: Object.fromEntries(Object.entries(s ?? {}).map(([k, v]) => [k, Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null])), error: '' }
  } catch (e) {
    return { scores: null, error: `Scoring failed: ${e.message}` }
  }
})
const alerts = computed(() => {
  try {
    return inst ? inst.alerts({ ...answers }) : []
  } catch {
    return []
  }
})

// Answers to items that are not asked (e.g. a confidence after "Don't know") are not stored.
const value = () => {
  const kept = Object.fromEntries(Object.entries(answers).filter(([id]) => {
    const item = inst?.items.find((i) => i.id === id)
    return !item || asked(item)
  }))
  return {
    instrument: props.input.instrument, answers: kept, scores: scoring.value.scores,
    complete: inst ? isComplete(inst, kept, context) : false,
    alerts: alerts.value.map(({ id, item, message }) => ({ id, item, message })),
    ...(context ? { context } : {}),
  }
}
watch(answers, () => emit('update:modelValue', value()), { deep: true })

function submit() {
  submitted.value = true
  emit('update:modelValue', value())
}
const fmt = (v) => (v === null || v === undefined ? '–' : Number.isInteger(v) ? String(v) : v.toFixed(2))
</script>

<template>
  <div v-if="!inst" class="small bad">Unknown questionnaire "{{ input.instrument }}". Skip this step with Next.</div>
  <div v-else class="stack">
    <div class="stack">
      <h3>{{ inst.name }}</h3>
      <p v-if="inst.instructions" class="small pre">{{ inst.instructions }}</p>
      <p v-if="legend" class="small muted">{{ legend }}</p>
    </div>

    <fieldset v-for="(item, n) in shown" :key="item.id" class="item" :class="{ open: submitted && required(item) && !answered(item) }">
      <legend><span class="muted num">{{ n + 1 }}.</span> {{ item.text }}<span v-if="item.optional" class="muted small"> (optional)</span></legend>

      <div v-if="isNumber(item)" class="row">
        <input v-model.number="answers[item.id]" type="number" inputmode="decimal" :min="item.min" :max="item.max" :step="item.step ?? 1" :aria-label="item.text" style="max-width: 140px" />
        <span v-if="item.unit" class="small muted">{{ item.unit }}</span>
      </div>

      <div v-else-if="worded(scaleOf(item))" class="words">
        <label v-for="p in points(scaleOf(item))" :key="p.v" class="opt">
          <input v-model.number="answers[item.id]" type="radio" :name="`${uid}-${item.id}`" :value="p.v" />
          <span>{{ p.label }}</span>
        </label>
      </div>

      <template v-else>
        <div class="scale">
          <label v-for="p in points(scaleOf(item))" :key="p.v" class="opt">
            <input v-model.number="answers[item.id]" type="radio" :name="`${uid}-${item.id}`" :value="p.v" :aria-label="p.label ? `${p.v}: ${p.label}` : String(p.v)" />
            <span class="num">{{ p.v }}</span>
          </label>
        </div>
        <div v-if="anchors(scaleOf(item)).length" class="anchors small muted">
          <span v-for="a in anchors(scaleOf(item))" :key="a.v">{{ a.v }} = {{ a.label }}</span>
        </div>
      </template>
    </fieldset>

    <div v-if="alerts.length" class="alerts" role="alert">
      <p v-for="a in alerts" :key="a.id" class="small warn">{{ a.message }} <a :href="a.href">Read the safety notes</a></p>
    </div>

    <div class="row">
      <button type="button" class="btn primary" @click="submit">{{ submitted ? 'Score again' : 'Submit answers' }}</button>
      <span v-if="missing" class="small muted">{{ missing }} unanswered</span>
    </div>
    <p v-if="scoring.error" class="small bad">{{ scoring.error }}</p>

    <div v-if="submitted && scoring.scores" class="table-wrap" aria-live="polite">
      <table>
        <thead><tr><th>Scale</th><th>Score</th></tr></thead>
        <tbody><tr v-for="(v, k) in scoring.scores" :key="k"><td>{{ k }}</td><td class="num">{{ fmt(v) }}</td></tr></tbody>
      </table>
    </div>
    <p class="small muted">
      {{ inst.citation }}<template v-if="inst.url"> · <a :href="inst.url" target="_blank" rel="noopener">source</a></template>
    </p>
    <p v-if="inst.license" class="small muted">Licence: {{ inst.license }}</p>
  </div>
</template>

<style scoped>
.pre { white-space: pre-line; }
.item { border: 0; border-top: 1px solid var(--line); padding: 10px 0 0; margin: 0; display: grid; gap: 8px; min-width: 0; }
.item.open legend { color: var(--warn); }
legend { padding: 0; font-size: 15px; }
.scale, .words { display: flex; flex-wrap: wrap; gap: 4px; }
.opt { position: relative; }
.scale .opt { flex: 1 1 0; min-width: 0; max-width: 64px; }
.words .opt { flex: 1 1 auto; }
.opt input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.opt span { display: block; text-align: center; padding: 9px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface-2); }
.scale .opt span { padding-inline: 0; font-size: 16px; }
.opt input:checked + span { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.opt input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
.alerts { display: grid; gap: 4px; border-left: 3px solid var(--warn); padding-left: 10px; }
.alerts p { margin: 0; }
.anchors { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; }
</style>
