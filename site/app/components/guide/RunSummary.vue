<script setup lang="ts">
// Summary of one guide run; the reveal of blinded audio / helmet conditions
// after the final rating (log.rate reveals the helmet's choice); and the late
// ARV reveal, once the real outcome is known.
import { fmtDuration } from '#core/lib/format.js'
import { fmtSetting } from '#core/lib/units.js'
import { device, call, errorMessage } from '~/lib/device'
import { live } from '~/lib/guideRun'
import { ratingDone } from '~/lib/rating'
import { loadResponse } from '~/lib/responses'
import {
  listSets, manifestHash, getSet, saveRun, inputSummary, plain, pendingArv, trialChecks, arvPrediction, arvPictureFor,
  type ArvReveal, type GuideDoc, type PendingArv, type RatingInputSpec, type RunDevice, type RunRecord, type RunReveal, type RunStepRecord,
  type RevealedTrial, type Trial, type TrialChecks,
} from '~/lib/guides'

const props = defineProps<{ record: RunRecord, guide?: GuideDoc | null }>()
const emit = defineEmits<{ saved: [record: RunRecord] }>()
const uid = useId()

const rec = computed(() => props.record)
const stepOf = (id: string) => props.guide?.steps?.find((s) => s.id === id) ?? null
const ms = (a: string | null | undefined, b: string | null | undefined) => (a && b ? new Date(b).getTime() - new Date(a).getTime() : 0)
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '–')
const nowIso = () => new Date().toISOString()

const needAudio = computed(() => !!rec.value.audio?.blind && !rec.value.reveal?.audio)
const needHelmet = computed(() => !!rec.value.helmet?.blind && !!rec.value.helmet?.logId && !rec.value.reveal?.helmet)
const pending = computed(() => needAudio.value || needHelmet.value)
// Answers given at an earlier (partial) reveal stay as they were.
const priorGuessHelmet = computed(() => rec.value.reveal?.guess?.helmet ?? '')
const priorRating = computed(() => rec.value.reveal?.rating ?? null)

const guess = reactive({ audio: '', helmet: '' })
const rating = ref<Record<string, number | null> | null>(null)
const notes = ref(props.record.reveal?.notes ?? '')
const busy = ref(false)
const error = ref('')
const RATE: RatingInputSpec = { items: [{ key: 'overall', label: 'Overall, how strong was the experience?', min: 0, max: 10, minLabel: 'nothing', maxLabel: 'very strong' }] }

const { online, lost } = useHelmetLink()
// The same helmet: by its fixed id where both are known (then USB or Bluetooth makes no difference), else by how it is reached and its name.
const sameDevice = (d: RunDevice | null | undefined) => !d || (d.helmetId && device.info?.helmetId ? d.helmetId === device.info.helmetId : d.kind === device.kind && (!d.name || d.name === device.name))
const NEEDS_HELMET = computed(() => (lost.value ? 'The connection to the helmet is lost; this works again once it is back.' : ''))
const deviceName = (d: RunDevice | null | undefined) => (d?.kind === 'demo' ? 'the demo helmet' : d?.name ? `“${d.name}”` : 'another helmet')

// Log entry `id` on the connected helmet (log.list is newest first).
interface LogEntry { id: number, start: number, presetId?: string }
async function findLog(id: number, startedAt: string | null) {
  const since = startedAt ? Date.parse(startedAt) / 1000 - 86400 : 0
  for (let offset = 0; offset < 500; offset += 10) {
    const page = await call<{ items: LogEntry[], total: number }>('log.list', { offset, limit: 10 })
    const hit = page.items.find((e) => e.id === id)
    if (hit) return hit
    if (!page.items.length || offset + page.items.length >= page.total) return null
    if (since && page.items.every((e) => e.start > 1e9 && e.start < since)) return null
  }
  return null
}

// A log id alone could name another helmet's entry: check the device and the entry first.
async function helmetMismatch() {
  const h = rec.value.helmet
  if (!online.value) return NEEDS_HELMET.value || 'Connect the helmet that ran this session to reveal its condition.'
  if (!sameDevice(h.device)) return `This session ran on ${deviceName(h.device)}, not on the helmet connected now.`
  const entry = await findLog(h.logId, h.startedAt)
  if (!entry) return `Log entry #${h.logId} is not on the connected helmet.`
  const startS = h.startedAt ? Date.parse(h.startedAt) / 1000 : 0
  if ((h.presetId && entry.presetId && entry.presetId !== h.presetId) || (startS && entry.start > 1e9 && Math.abs(entry.start - startS) > 900)) {
    return `Log entry #${h.logId} on the connected helmet belongs to another session.`
  }
  return ''
}

async function reveal() {
  error.value = ''
  const r = priorRating.value ?? rating.value?.overall
  if (r == null) return (error.value = 'Rate the session first.')
  busy.value = true
  try {
    const prior: Partial<RunReveal> = rec.value.reveal ?? {}
    const out: RunReveal = { ...prior, at: prior.at ?? nowIso(), rating: r, notes: notes.value.trim(), guess: { ...(prior.guess ?? {}) } }
    if (needAudio.value) {
      out.guess.audio = guess.audio || 'unsure'
      out.audio = rec.value.audio.sham ? 'sham' : 'real'
    }
    if (needHelmet.value) {
      out.guess.helmet = priorGuessHelmet.value || guess.helmet || 'unsure'
      const why = await helmetMismatch()
      if (why) error.value = `${why} The helmet condition stays hidden${needAudio.value ? '; the audio is revealed now' : ''}.`
      else {
        const entry = await call<{ condition: string }>('log.rate', { id: rec.value.helmet.logId, rating: r, notes: notes.value.slice(0, 2000) })
        out.helmet = entry.condition
        out.helmetAt = nowIso()
        ratingDone(rec.value.helmet.logId)
      }
    }
    const updated: RunRecord = { ...plain(rec.value), reveal: out }
    await saveRun(updated)
    emit('saved', updated)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

// ---- ARV trials whose outcome was not known during the run
const arvPending = computed(() => pendingArv(rec.value, props.guide ?? null))
const arvDone = computed(() => Object.values(rec.value.arvReveals ?? {}))
const arvChoice = reactive<Record<string, string>>({})
const arvError = ref('')
const feedback = reactive<Record<string, string>>({}) // trialId -> object URL of the actual outcome's picture
const optionOf = (p: PendingArv) => arvChoice[p.trialId] ?? p.outcome ?? ''

async function loadFeedback(r: Pick<ArvReveal, 'trialId' | 'set' | 'feedbackIndex'>) {
  try {
    const set = await getSet(r.set)
    const img = set?.images[r.feedbackIndex]
    if (!img) throw new Error(`Set "${r.set}" is missing on this phone.`)
    if (feedback[r.trialId]) URL.revokeObjectURL(feedback[r.trialId]!)
    feedback[r.trialId] = URL.createObjectURL(img.blob)
  } catch (e) {
    arvError.value = errorMessage(e)
  }
}

async function revealArv(p: PendingArv) {
  arvError.value = ''
  const o = p.options.indexOf(optionOf(p))
  if (o < 0) return (arvError.value = 'Choose the outcome that happened.')
  if (!online.value) return (arvError.value = NEEDS_HELMET.value || `Connect the helmet that holds trial #${p.trialId}.`)
  if (!sameDevice(p.device)) return (arvError.value = `Trial #${p.trialId} is on ${deviceName(p.device)}, not on the helmet connected now.`)
  busy.value = true
  try {
    let t = await call<Trial>('trial.get', { id: p.trialId })
    if (p.commitment && t.commitment !== p.commitment) throw new Error(`Trial #${p.trialId} on the connected helmet is a different trial.`)
    if (t.state !== 'revealed') {
      if (!t.ranked) throw new Error(`Trial #${p.trialId} was never judged, so there is no sealed prediction to score.`)
      t = await call<Trial>('trial.reveal', { id: t.id })
    }
    const shown = t as RevealedTrial // revealed: set, target and rank are known
    const [all, resp] = await Promise.all([listSets(), loadResponse(t)])
    const checks = await trialChecks(shown, { manifest: await manifestHash(all), response: resp })
    const prediction = arvPrediction(shown)
    const at = nowIso()
    const result: ArvReveal = {
      trialId: t.id, outcome: p.options[o]!, prediction: p.options[prediction]!, hit: prediction === o, pass: p.pass,
      targetRank: shown.targetRank, setSize: shown.setSize, condition: t.condition, set: shown.set, feedbackIndex: arvPictureFor(shown, o),
      checks, revealedAt: at,
    }
    const updated = plain(rec.value)
    updated.arvReveals = { ...(updated.arvReveals ?? {}), [t.id]: result }
    if (p.revealIdx >= 0) {
      const s = updated.steps[p.revealIdx]!
      s.input = { ...(s.input ?? {}), ...result, action: 'reveal', arv: true, revealed: true, deferred: true }
    }
    if (p.outcomeIdx >= 0) {
      const s = updated.steps[p.outcomeIdx]!
      s.input = { ...(s.input ?? {}), [p.key]: p.options[o], enteredAt: at }
    }
    await saveRun(updated)
    emit('saved', updated)
    await loadFeedback(result)
  } catch (e) {
    arvError.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
onBeforeUnmount(() => Object.values(feedback).forEach((u) => URL.revokeObjectURL(u)))

const audioLabel = computed(() => {
  const a = rec.value.audio
  if (!a?.enabled) return 'none' // a guide without sound
  const cond = a.blind ? (rec.value.reveal?.audio ? `blind → ${rec.value.reveal.audio}` : 'blind (not revealed yet)') : 'real beats'
  const cuts = a.interruptions?.length ? `, interrupted ${a.interruptions.length}×` : ''
  return `${a.mode}, T0 ${a.levelDb} dB, ${cond}${cuts}${a.error ? `, ${a.error}` : ''}`
})
const helmetLabel = computed(() => {
  const h = rec.value.helmet
  if (!h?.enabled) return 'not used'
  if (!h.logId) return h.error || 'not started'
  const cond = h.blind ? (rec.value.reveal?.helmet ? `blind → ${rec.value.reveal.helmet}` : 'blind (not revealed yet)') : 'active'
  const field = h.fieldUT ? `, ${fmtSetting(h.fieldUT)}` : ''
  return `${h.presetId}${field}, log #${h.logId}${h.device?.name ? ` on ${h.device.name}` : ''}, ${cond}${h.linkNote ? `, ${h.linkNote}` : ''}${h.error ? `, ${h.error}` : ''}`
})
// Drops and returns of the helmet connection during the run.
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const FOUND: Record<string, string> = { running: 'the program was still running', ended: 'the program had ended', restarted: 'the helmet had restarted', other: 'another helmet', back: '' }
const links = computed(() => (rec.value.links ?? []).map((l) => (l.event === 'lost' ? `lost ${time(l.at)}` : `back ${time(l.at)}${l.found && FOUND[l.found] ? ` (${FOUND[l.found]})` : ''}`)))
// A stored run that neither completed nor was stopped was cut off (the page was reloaded or closed).
const state = computed(() => (rec.value.completed ? 'completed' : rec.value.stopped ? 'stopped' : live.record?.id === rec.value.id ? 'in progress' : 'unfinished'))
const env = computed(() => rec.value.env)
const lstKnown = computed(() => !!env.value?.timeValid && (env.value.lst ?? -1) >= 0)

// What a step's input wrote, for the table.
const inputOf = (s: RunStepRecord) => stepOf(s.id)?.input
const textOf = (s: RunStepRecord) => {
  const inp = inputOf(s)
  return inp?.type === 'text' ? String(s.input?.[inp.key || 'text'] ?? '') : null
}
const sketchOf = (s: RunStepRecord) => {
  const inp = inputOf(s)
  return inp?.type === 'sketch' ? (s.input?.[inp.key || 'sketch'] as string | undefined) || '' : ''
}
// The core joins several ratings or scores with a middle dot: one line each here.
const summaryLines = (s: RunStepRecord) => inputSummary(inputOf(s), s.input).split(' · ').filter(Boolean)
const CHECKS: [keyof TrialChecks, string][] = [
  ['commitment', 'Commitment matches the revealed trial'],
  ['pool', 'Picture pool unchanged'],
  ['response', 'Response unchanged since locking'],
]
const GUESS_UI = { fieldset: 'flex-wrap gap-x-5 gap-y-1.5' }
const GUESS_AUDIO = ['real', 'sham', 'unsure']
const GUESS_HELMET = ['active', 'sham', 'unsure']
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="grid gap-0.5">
        <span class="text-sm text-muted">{{ when(rec.startedAt) }}</span>
        <h3 class="text-xl">{{ rec.guideName || rec.guideId }}</h3>
      </div>
      <UBadge :color="rec.completed ? 'primary' : 'neutral'" :variant="rec.completed ? 'subtle' : 'outline'">{{ state }}</UBadge>
    </div>
    <p class="num text-sm text-muted">Duration {{ fmtDuration(ms(rec.startedAt, rec.endedAt)) }}, {{ rec.steps.length }} step(s) recorded</p>

    <section v-if="pending" class="grid gap-4 rounded-lg border border-primary p-4" :aria-labelledby="`${uid}-reveal`">
      <h3 :id="`${uid}-reveal`" class="text-xl">Rate, then reveal</h3>
      <URadioGroup v-if="needAudio" v-model="guess.audio" :items="GUESS_AUDIO" orientation="horizontal" :ui="GUESS_UI" legend="Your guess: was the audio real or sham?" />
      <template v-if="needHelmet">
        <p v-if="priorGuessHelmet" class="text-sm">Your guess about the helmet field (saved earlier): <b class="text-highlighted">{{ priorGuessHelmet }}</b></p>
        <URadioGroup v-else v-model="guess.helmet" :items="GUESS_HELMET" orientation="horizontal" :ui="GUESS_UI" legend="Your guess: was the helmet field active or sham?" />
      </template>
      <p v-if="priorRating !== null" class="text-sm">Your rating (saved before the first reveal): <b class="num text-highlighted">{{ priorRating }}/10</b></p>
      <GuideRatingInput v-else v-model="rating" :input="RATE" />
      <UFormField label="Notes (optional)">
        <UTextarea v-model="notes" :rows="3" class="w-full max-w-xl" />
      </UFormField>
      <div><UButton color="primary" variant="solid" :disabled="busy" @click="reveal">Save rating and reveal</UButton></div>
    </section>
    <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>

    <section v-for="p in arvPending" :key="p.trialId" class="grid gap-3 rounded-lg border border-primary p-4" :aria-labelledby="`${uid}-arv-${p.trialId}`">
      <h3 :id="`${uid}-arv-${p.trialId}`" class="text-xl">ARV trial #{{ p.trialId }}: enter the outcome</h3>
      <p class="measure text-sm">Enter it only once the result is public and final. The helmet then reveals the mapping, and you see only the picture of the real outcome.<template v-if="p.device"> Needs {{ deviceName(p.device) }} connected.</template></p>
      <URadioGroup :model-value="optionOf(p)" :items="p.options" orientation="horizontal" :ui="GUESS_UI" legend="Which outcome happened?" @update:model-value="(o) => (arvChoice[p.trialId] = String(o))" />
      <div class="flex flex-wrap items-center gap-3">
        <UButton color="primary" variant="solid" :disabled="busy" @click="revealArv(p)">Save outcome and reveal</UButton>
        <AppConnect v-if="!device.kind" size="xs" />
      </div>
    </section>
    <section v-for="r in arvDone" :key="`done-${r.trialId}`" class="grid gap-2 border-t border-default pt-3" aria-live="polite">
      <h3 class="text-xl">ARV trial #{{ r.trialId }}: {{ r.pass ? 'Pass (not scored)' : r.hit ? 'Hit' : 'Miss' }}</h3>
      <p class="text-sm">Prediction <b class="text-highlighted">{{ r.prediction }}</b>, outcome <b class="text-highlighted">{{ r.outcome }}</b> (entered {{ when(r.revealedAt) }})<template v-if="r.pass">; the match ratings were less than 2 points apart</template></p>
      <ul class="grid gap-1 text-sm">
        <li v-for="[k, label] in CHECKS" :key="k" class="flex gap-1.5" :class="r.checks?.[k] ? 'text-success' : 'text-error'">
          <UIcon :name="r.checks?.[k] ? 'i-lucide-check' : 'i-lucide-x'" class="mt-0.5 size-4 shrink-0" /><span class="sr-only">{{ r.checks?.[k] ? 'passed' : 'failed' }}: </span>{{ label }}
        </li>
      </ul>
      <figure v-if="feedback[r.trialId]" class="m-0 grid max-w-md gap-1">
        <img :src="feedback[r.trialId]" alt="Feedback picture for the actual outcome" class="block w-full rounded-md">
        <figcaption class="text-sm text-muted">The picture of the actual outcome: your feedback.</figcaption>
      </figure>
      <div v-else><UButton size="sm" icon="i-lucide-image" @click="loadFeedback(r)">Show the feedback picture</UButton></div>
    </section>
    <p v-if="arvError" class="text-sm text-error" role="alert">{{ arvError }}</p>

    <p v-if="rec.reveal" class="text-sm" aria-live="polite">
      <template v-if="rec.reveal.audio">Audio was <b class="text-highlighted">{{ rec.reveal.audio }}</b> (your guess: {{ rec.reveal.guess?.audio || '–' }}). </template>
      <template v-if="rec.reveal.helmet">Helmet field was <b class="text-highlighted">{{ rec.reveal.helmet }}</b> (your guess: {{ rec.reveal.guess?.helmet || '–' }}). </template>
      Rating {{ rec.reveal.rating }}/10.
    </p>

    <!-- On a phone each step is two lines: its name and time, then what was entered. -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm max-sm:block" role="table">
        <thead class="max-sm:sr-only" role="rowgroup">
          <tr class="border-b border-default text-muted" role="row"><th class="py-1.5 pr-4 font-normal" role="columnheader">Step</th><th class="py-1.5 pr-4 text-right font-normal" role="columnheader">Time</th><th class="py-1.5 font-normal" role="columnheader">Input</th></tr>
        </thead>
        <tbody class="max-sm:block" role="rowgroup">
          <tr v-for="(s, i) in rec.steps" :key="i" class="border-b border-default align-top max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:py-2" role="row">
            <td class="py-1.5 pr-4 text-highlighted max-sm:p-0" role="cell">{{ s.title || stepOf(s.id)?.title || s.id }}<span v-if="s.end === 'skip' || s.end === 'stop'" class="text-muted"> ({{ s.end === 'skip' ? 'skipped' : 'stopped' }})</span></td>
            <td class="num py-1.5 pr-4 text-right max-sm:p-0" role="cell">{{ fmtDuration(s.activeMs ?? ms(s.startedAt, s.endedAt)) }}</td>
            <td class="py-1.5 max-sm:col-span-2 max-sm:p-0 sm:min-w-40" role="cell">
              <span v-if="textOf(s) !== null" class="whitespace-pre-wrap">{{ textOf(s) }}</span>
              <GuideSketchImage v-else-if="sketchOf(s)" :src="sketchOf(s)" class="w-24 max-sm:mt-1" alt="Sketch" />
              <template v-else><span v-for="(line, j) in summaryLines(s)" :key="j" class="block">{{ line }}</span></template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <dl class="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
      <dt class="text-muted">Audio</dt><dd class="m-0">{{ audioLabel }}</dd>
      <dt class="text-muted">Helmet</dt><dd class="m-0">{{ helmetLabel }}</dd>
      <template v-if="links.length"><dt class="text-muted">Connection</dt><dd class="num m-0" data-test="run-links">{{ links.join(', ') }}</dd></template>
      <dt class="text-muted">Kp</dt>
      <dd class="m-0">{{ env?.kpValid ? env.kp?.toFixed(1) : '–' }}<template v-if="env?.kpValid && env.kpSource"> ({{ env.kpSource }})</template><span v-else-if="env?.kpNote" class="ml-1 text-muted">{{ env.kpNote }}</span></dd>
      <dt class="text-muted">LST</dt>
      <dd class="m-0">{{ lstKnown ? `${env!.lst!.toFixed(2)} h` : '–' }}<span v-if="!lstKnown && env?.lstNote" class="ml-1 text-muted">{{ env.lstNote }}</span></dd>
      <dt class="text-muted">Guide version</dt><dd class="m-0 font-mono text-xs leading-6">{{ rec.guideHash ? rec.guideHash.slice(0, 16) : '–' }}</dd>
    </dl>
  </div>
</template>
