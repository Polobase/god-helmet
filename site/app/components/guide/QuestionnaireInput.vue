<script setup lang="ts">
// A questionnaire from the core's instruments.js: stored as { instrument, answers, scores, complete, alerts }.
// Items limited by askIf are hidden when the run context rules them out.
// Names, instructions, item texts, scale labels, citations and licences are shown exactly as the core gives them.
import { appPathFromHash } from '~~/shared/links'
import { errorMessage } from '~/lib/device'
import { GUIDE_RUN } from '~/lib/guideRun'
import {
  instrumentById, itemScale, isAsked, isComplete, sessionMinutes,
  type Answers, type AskContext, type InstrumentAlert, type InstrumentItem, type QuestionnaireInputSpec, type Scale,
} from '~/lib/guides'

interface Value {
  instrument: string
  answers: Answers
  scores: Record<string, number | null> | null
  complete: boolean
  alerts: { id: string, item: string, message: string }[]
  context?: AskContext
}
const props = defineProps<{ input: QuestionnaireInputSpec, modelValue?: Value | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: Value] }>()
const run = inject(GUIDE_RUN, null)
const uid = useId()

const inst = instrumentById(props.input.instrument)
const answers = reactive<Answers>({ ...(props.modelValue?.answers ?? {}) })
const submitted = ref(false)

// Which conditions of this run were blinded (for the blinding check).
const rec = run?.record
const context: AskContext | undefined = rec ? { blinded: { audio: !!rec.audio?.blind, helmet: !!(rec.helmet?.blind && rec.helmet?.logId) } } : undefined
const asked = (item: InstrumentItem) => isAsked(inst!, item, answers, context) !== false
const shown = computed(() => (inst?.items ?? []).filter(asked))

const scaleOf = (item: InstrumentItem): Scale => (inst && itemScale(inst, item)) ?? { min: 0, max: 10 }
const isNumber = (item: InstrumentItem) => item.kind === 'number'
// labels[i] belongs to min + i; a two-entry list on a longer scale names the ends.
const labelAt = (sc: Scale, i: number, n: number) => (sc.labels?.length === 2 && n > 2 ? (i === 0 ? sc.labels[0]! : i === n - 1 ? sc.labels[1]! : '') : sc.labels?.[i] ?? '')
const points = (sc: Scale) => {
  const n = sc.max - sc.min + 1
  return Array.from({ length: n }, (_, i) => ({ v: sc.min + i, label: labelAt(sc, i, n) }))
}
// Small, fully labelled scales show their words; the rest show numbers.
const worded = (sc: Scale) => sc.max - sc.min <= 4 && points(sc).every((p) => p.label)
const anchors = (sc: Scale) => points(sc).filter((p) => p.label)
const answered = (item: InstrumentItem) => answers[item.id] !== undefined && answers[item.id] !== null && answers[item.id] !== ''
const required = (item: InstrumentItem) => !item.optional && isAsked(inst!, item, answers, context) === true
const missing = computed(() => shown.value.filter((i) => required(i) && !answered(i)).length)
const legend = computed(() => {
  const sc = inst?.scale
  return sc && points(sc).every((p) => p.label) && !worded(sc) ? points(sc).map((p) => `${p.v} = ${p.label}`).join(', ') : ''
})
// Under an item on the shared scale the legend above already names every point: repeat only the two ends.
const itemAnchors = (item: InstrumentItem) => {
  const a = anchors(scaleOf(item))
  return legend.value && scaleOf(item) === inst!.scale ? [a[0]!, a.at(-1)!] : a
}
const wordOptions = (item: InstrumentItem) => points(scaleOf(item)).map((p) => ({ value: p.v, text: p.label }))
const numberOptions = (item: InstrumentItem) => points(scaleOf(item)).map((p) => ({ value: p.v, aria: p.label ? `${p.v}: ${p.label}` : String(p.v) }))

// Session time for a time estimate: the steps that played audio or ran the helmet.
const actualMinutes = () => {
  const m = run?.guide ? sessionMinutes(run.guide, run.record?.steps) : null
  return m === null ? undefined : Math.round(m * 10) / 10
}

const scoring = computed(() => {
  if (!inst) return { scores: null, error: '' }
  try {
    const s = inst.score({ ...answers }, { actualMinutes: actualMinutes() })
    return { scores: Object.fromEntries(Object.entries(s ?? {}).map(([k, v]) => [k, Number.isFinite(v) ? Math.round(v! * 1000) / 1000 : null])), error: '' }
  } catch (e) {
    return { scores: null, error: `Scoring failed: ${errorMessage(e)}` }
  }
})
const alerts = computed<InstrumentAlert[]>(() => {
  try {
    return inst ? inst.alerts({ ...answers }) : []
  } catch {
    return []
  }
})
// The core links its alerts to the old app's safety notes: the same page on this site.
const alertLink = (a: InstrumentAlert) => appPathFromHash(a.href) ?? '/docs/safety'

// Answers to items that are not asked (e.g. a confidence after "Don't know") are not stored.
const value = (): Value => {
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
const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '–' : Number.isInteger(v) ? String(v) : v.toFixed(2))
</script>

<template>
  <p v-if="!inst" class="text-sm text-error">Unknown questionnaire "{{ input.instrument }}". Skip this step with Next.</p>
  <div v-else class="grid gap-5">
    <div class="grid gap-2">
      <h2 class="text-xl">{{ inst.name }}</h2>
      <p v-if="inst.instructions" class="measure whitespace-pre-line text-sm">{{ inst.instructions }}</p>
      <p v-if="legend" class="text-sm text-muted">{{ legend }}</p>
    </div>

    <fieldset v-for="(item, n) in shown" :key="item.id" class="grid min-w-0 gap-2 border-t border-default pt-3">
      <!-- Floated, the legend is laid out as content below the divider instead of on top of it. -->
      <legend class="float-left w-full" :class="submitted && required(item) && !answered(item) ? 'text-warning' : 'text-highlighted'">
        <span class="num text-muted">{{ n + 1 }}.</span> {{ item.text }}<span v-if="item.optional" class="text-sm text-muted"> (optional)</span>
      </legend>

      <div v-if="isNumber(item)" class="flex items-center gap-2">
        <UInput :model-value="answers[item.id] ?? undefined" type="number" inputmode="decimal" :min="item.min" :max="item.max" :step="item.step ?? 1" :aria-label="item.text" class="w-36" @update:model-value="(v) => (answers[item.id] = v)" />
        <span v-if="item.unit" class="text-sm text-muted">{{ item.unit }}</span>
      </div>

      <GuideOptionRow v-else-if="worded(scaleOf(item))" v-model="answers[item.id]" :options="wordOptions(item)" :name="`${uid}-${item.id}`" words class="max-w-3xl" />

      <template v-else>
        <GuideOptionRow v-model="answers[item.id]" :options="numberOptions(item)" :name="`${uid}-${item.id}`" :cell="64" />
        <div v-if="itemAnchors(item).length" class="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm text-muted" :style="{ maxWidth: `${points(scaleOf(item)).length * 68 - 4}px` }">
          <span v-for="a in itemAnchors(item)" :key="a.v">{{ a.v }} = {{ a.label }}</span>
        </div>
      </template>
    </fieldset>

    <div v-if="alerts.length" class="grid gap-1 border-l-[3px] border-warning pl-3" role="alert">
      <p v-for="a in alerts" :key="a.id" class="text-sm text-warning">{{ a.message }} <NuxtLink :to="alertLink(a)" class="underline underline-offset-4">Read the safety notes</NuxtLink></p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UButton size="sm" @click="submit">{{ submitted ? 'Update scores' : 'Show scores' }}</UButton>
      <span class="text-sm text-muted">{{ missing ? `${missing} unanswered` : 'All answered. Your answers are saved when you move on.' }}</span>
    </div>
    <p v-if="scoring.error" class="text-sm text-error">{{ scoring.error }}</p>

    <div v-if="submitted && scoring.scores" class="overflow-x-auto" aria-live="polite">
      <table class="w-full max-w-xl text-left text-sm">
        <thead><tr class="border-b border-default text-muted"><th class="py-1.5 pr-4 font-normal">Scale</th><th class="py-1.5 text-right font-normal">Score</th></tr></thead>
        <tbody><tr v-for="(v, k) in scoring.scores" :key="k" class="border-b border-default"><td class="py-1.5 pr-4">{{ k }}</td><td class="num py-1.5 text-right text-highlighted">{{ fmt(v) }}</td></tr></tbody>
      </table>
    </div>
    <p class="text-sm text-muted">
      {{ inst.citation }}<template v-if="inst.url">{{ ' ' }}<a :href="inst.url" target="_blank" rel="noopener" class="text-primary underline underline-offset-4">Source</a></template>
    </p>
    <p v-if="inst.license" class="text-sm text-muted">Licence: {{ inst.license }}</p>
  </div>
</template>
