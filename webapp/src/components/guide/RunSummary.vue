<script setup>
// Summary of one guide run; the reveal of blinded audio / helmet conditions
// after the final rating (log.rate reveals the helmet's choice); and the late
// ARV reveal, once the real outcome is known.
import { computed, onBeforeUnmount, reactive, ref, useId } from 'vue'
import { device, call } from '../../ble/device.js'
import { listSets, manifestHash, getSet } from '../../lib/pool.js'
import { idb } from '../../lib/idb.js'
import { saveRun, inputSummary, plain, pendingArv, trialChecks, arvPrediction, arvPictureFor } from '../../lib/runs.js'
import { fmtDuration } from '../../lib/format.js'
import RatingInput from './RatingInput.vue'

const props = defineProps({ record: { type: Object, required: true }, guide: { type: Object, default: null } })
const emit = defineEmits(['saved'])
const uid = useId()

const rec = computed(() => props.record)
const stepOf = (id) => props.guide?.steps?.find((s) => s.id === id) ?? null
const ms = (a, b) => (a && b ? new Date(b) - new Date(a) : 0)
const when = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '–')
const nowIso = () => new Date().toISOString()

const needAudio = computed(() => !!rec.value.audio?.blind && !rec.value.reveal?.audio)
const needHelmet = computed(() => !!rec.value.helmet?.blind && !!rec.value.helmet?.logId && !rec.value.reveal?.helmet)
const pending = computed(() => needAudio.value || needHelmet.value)
// Answers given at an earlier (partial) reveal stay as they were.
const priorGuessHelmet = computed(() => rec.value.reveal?.guess?.helmet ?? '')
const priorRating = computed(() => rec.value.reveal?.rating ?? null)

const guess = reactive({ audio: '', helmet: '' })
const rating = ref(null)
const notes = ref(props.record.reveal?.notes ?? '')
const busy = ref(false)
const error = ref('')
const RATE = { items: [{ key: 'overall', label: 'Overall, how strong was the experience?', min: 0, max: 10, minLabel: 'nothing', maxLabel: 'very strong' }] }

const sameDevice = (d) => !d || (d.kind === device.kind && (!d.name || d.name === device.name))
const deviceName = (d) => (d?.kind === 'demo' ? 'the demo helmet' : d?.name ? `“${d.name}”` : 'another helmet')

// Log entry `id` on the connected helmet (log.list is newest first).
async function findLog(id, startedAt) {
  const since = startedAt ? Date.parse(startedAt) / 1000 - 86400 : 0
  for (let offset = 0; offset < 500; offset += 10) {
    const page = await call('log.list', { offset, limit: 10 })
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
  if (!device.kind) return 'Connect the helmet that ran this session to reveal its condition.'
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
    const prior = rec.value.reveal ?? {}
    const out = { ...prior, at: prior.at ?? nowIso(), rating: r, notes: notes.value.trim(), guess: { ...(prior.guess ?? {}) } }
    if (needAudio.value) {
      out.guess.audio = guess.audio || 'unsure'
      out.audio = rec.value.audio.sham ? 'sham' : 'real'
    }
    if (needHelmet.value) {
      out.guess.helmet = priorGuessHelmet.value || guess.helmet || 'unsure'
      const why = await helmetMismatch()
      if (why) error.value = `${why} The helmet condition stays hidden${needAudio.value ? '; the audio is revealed now' : ''}.`
      else {
        const entry = await call('log.rate', { id: rec.value.helmet.logId, rating: r, notes: notes.value.slice(0, 2000) })
        out.helmet = entry.condition
        out.helmetAt = nowIso()
      }
    }
    const updated = { ...plain(rec.value), reveal: out }
    await saveRun(updated)
    emit('saved', updated)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

// ---- ARV trials whose outcome was not known during the run
const arvPending = computed(() => pendingArv(rec.value, props.guide))
const arvDone = computed(() => Object.values(rec.value.arvReveals ?? {}))
const arvChoice = reactive({})
const arvError = ref('')
const feedback = reactive({}) // trialId -> object URL of the actual outcome's picture
const optionOf = (p) => arvChoice[p.trialId] ?? p.outcome ?? ''

async function loadFeedback(r) {
  try {
    const set = await getSet(r.set)
    const img = set?.images[r.feedbackIndex]
    if (!img) throw new Error(`Set "${r.set}" is missing on this phone.`)
    if (feedback[r.trialId]) URL.revokeObjectURL(feedback[r.trialId])
    feedback[r.trialId] = URL.createObjectURL(img.blob)
  } catch (e) {
    arvError.value = e.message
  }
}

async function revealArv(p) {
  arvError.value = ''
  const o = p.options.indexOf(optionOf(p))
  if (o < 0) return (arvError.value = 'Choose the outcome that happened.')
  if (!device.kind) return (arvError.value = `Connect the helmet that holds trial #${p.trialId}.`)
  if (!sameDevice(p.device)) return (arvError.value = `Trial #${p.trialId} is on ${deviceName(p.device)}, not on the helmet connected now.`)
  busy.value = true
  try {
    let t = await call('trial.get', { id: p.trialId })
    if (p.commitment && t.commitment !== p.commitment) throw new Error(`Trial #${p.trialId} on the connected helmet is a different trial.`)
    if (t.state !== 'revealed') {
      if (!t.ranked) throw new Error(`Trial #${p.trialId} was never judged, so there is no sealed prediction to score.`)
      t = await call('trial.reveal', { id: t.id })
    }
    const [all, resp] = await Promise.all([listSets(), idb.get('responses', t.id)])
    const checks = await trialChecks(t, { manifest: await manifestHash(all), response: resp })
    const prediction = arvPrediction(t)
    const at = nowIso()
    const result = {
      trialId: t.id, outcome: p.options[o], prediction: p.options[prediction], hit: prediction === o, pass: p.pass,
      targetRank: t.targetRank, setSize: t.setSize, condition: t.condition, set: t.set, feedbackIndex: arvPictureFor(t, o),
      checks, revealedAt: at,
    }
    const updated = plain(rec.value)
    updated.arvReveals = { ...(updated.arvReveals ?? {}), [t.id]: result }
    if (p.revealIdx >= 0) {
      const s = updated.steps[p.revealIdx]
      s.input = { ...(s.input ?? {}), ...result, action: 'reveal', arv: true, revealed: true, deferred: true }
    }
    if (p.outcomeIdx >= 0) {
      const s = updated.steps[p.outcomeIdx]
      s.input = { ...(s.input ?? {}), [p.key]: p.options[o], enteredAt: at }
    }
    await saveRun(updated)
    emit('saved', updated)
    await loadFeedback(result)
  } catch (e) {
    arvError.value = e.message
  } finally {
    busy.value = false
  }
}
onBeforeUnmount(() => Object.values(feedback).forEach((u) => URL.revokeObjectURL(u)))

const audioLabel = computed(() => {
  const a = rec.value.audio
  if (!a) return 'none'
  const cond = a.blind ? (rec.value.reveal?.audio ? `blind → ${rec.value.reveal.audio}` : 'blind (not revealed yet)') : 'real beats'
  const cuts = a.interruptions?.length ? ` · interrupted ${a.interruptions.length}×` : ''
  return `${a.mode}, T0 ${a.levelDb} dB, ${cond}${cuts}${a.error ? ` · ${a.error}` : ''}`
})
const helmetLabel = computed(() => {
  const h = rec.value.helmet
  if (!h?.enabled) return 'not used'
  if (!h.logId) return h.error || 'not started'
  const cond = h.blind ? (rec.value.reveal?.helmet ? `blind → ${rec.value.reveal.helmet}` : 'blind (not revealed yet)') : 'active'
  const field = h.fieldUT ? `, ${h.fieldUT} µT` : ''
  return `${h.presetId}${field}, log #${h.logId}${h.device?.name ? ` on ${h.device.name}` : ''}, ${cond}${h.error ? ` · ${h.error}` : ''}`
})
const env = computed(() => rec.value.env)
</script>

<template>
  <div class="stack">
    <div class="row between">
      <div class="stack tight">
        <span class="eyebrow">{{ when(rec.startedAt) }}</span>
        <h3>{{ rec.guideName || rec.guideId }}</h3>
      </div>
      <span class="chip" :class="{ on: rec.completed }">{{ rec.completed ? 'completed' : rec.stopped ? 'stopped' : 'in progress' }}</span>
    </div>
    <p class="small muted">Duration {{ fmtDuration(ms(rec.startedAt, rec.endedAt)) }} · {{ rec.steps.length }} step(s) recorded</p>

    <section v-if="pending" class="reveal stack" :aria-labelledby="`${uid}-reveal`">
      <h3 :id="`${uid}-reveal`">Rate, then reveal</h3>
      <fieldset v-if="needAudio" class="guess">
        <legend class="small">Your guess: was the audio real or sham?</legend>
        <label v-for="g in ['real', 'sham', 'unsure']" :key="g" class="check"><input v-model="guess.audio" type="radio" :name="`${uid}-audio`" :value="g" /> {{ g }}</label>
      </fieldset>
      <template v-if="needHelmet">
        <p v-if="priorGuessHelmet" class="small">Your guess about the helmet field (saved earlier): <b>{{ priorGuessHelmet }}</b></p>
        <fieldset v-else class="guess">
          <legend class="small">Your guess: was the helmet field active or sham?</legend>
          <label v-for="g in ['active', 'sham', 'unsure']" :key="g" class="check"><input v-model="guess.helmet" type="radio" :name="`${uid}-helmet`" :value="g" /> {{ g }}</label>
        </fieldset>
      </template>
      <p v-if="priorRating !== null" class="small">Your rating (saved before the first reveal): <b>{{ priorRating }}/10</b></p>
      <RatingInput v-else v-model="rating" :input="RATE" />
      <label class="field">Notes (optional)<textarea v-model="notes" rows="3"></textarea></label>
      <div class="row"><button type="button" class="btn primary" :disabled="busy" @click="reveal">Save rating and reveal</button></div>
    </section>
    <p v-if="error" class="small bad">{{ error }}</p>

    <section v-for="p in arvPending" :key="p.trialId" class="reveal stack" :aria-labelledby="`${uid}-arv-${p.trialId}`">
      <h3 :id="`${uid}-arv-${p.trialId}`">ARV trial #{{ p.trialId }}: enter the outcome</h3>
      <p class="small">Enter it only once the result is public and final. The helmet then reveals the mapping, and you see only the picture of the real outcome.<template v-if="p.device"> Needs {{ deviceName(p.device) }} connected.</template></p>
      <fieldset class="guess">
        <legend class="small">Which outcome happened?</legend>
        <label v-for="o in p.options" :key="o" class="check"><input type="radio" :name="`${uid}-arv-${p.trialId}`" :value="o" :checked="optionOf(p) === o" @change="arvChoice[p.trialId] = o" /> {{ o }}</label>
      </fieldset>
      <div class="row"><button type="button" class="btn primary" :disabled="busy" @click="revealArv(p)">Save outcome and reveal</button></div>
    </section>
    <section v-for="r in arvDone" :key="`done-${r.trialId}`" class="stack arv" aria-live="polite">
      <h3>ARV trial #{{ r.trialId }}: {{ r.pass ? 'Pass (not scored)' : r.hit ? 'Hit' : 'Miss' }}</h3>
      <p class="small">Prediction <b>{{ r.prediction }}</b> · outcome <b>{{ r.outcome }}</b> (entered {{ when(r.revealedAt) }})<template v-if="r.pass"> · the match ratings were less than 2 points apart</template></p>
      <ul class="small checks">
        <li :class="r.checks?.commitment ? 'ok' : 'bad'">{{ r.checks?.commitment ? '✓' : '✗' }} Commitment matches the revealed trial</li>
        <li :class="r.checks?.pool ? 'ok' : 'bad'">{{ r.checks?.pool ? '✓' : '✗' }} Picture pool unchanged</li>
        <li :class="r.checks?.response ? 'ok' : 'bad'">{{ r.checks?.response ? '✓' : '✗' }} Response unchanged since locking</li>
      </ul>
      <figure v-if="feedback[r.trialId]" class="feedback"><img :src="feedback[r.trialId]" alt="Feedback picture for the actual outcome" /><figcaption class="small muted">The picture of the actual outcome: your feedback.</figcaption></figure>
      <div v-else class="row"><button type="button" class="btn sm" @click="loadFeedback(r)">Show the feedback picture</button></div>
    </section>
    <p v-if="arvError" class="small bad">{{ arvError }}</p>

    <p v-if="rec.reveal" class="small" aria-live="polite">
      <template v-if="rec.reveal.audio">Audio was <b>{{ rec.reveal.audio }}</b> (your guess: {{ rec.reveal.guess?.audio || '–' }}). </template>
      <template v-if="rec.reveal.helmet">Helmet field was <b>{{ rec.reveal.helmet }}</b> (your guess: {{ rec.reveal.guess?.helmet || '–' }}). </template>
      Rating {{ rec.reveal.rating }}/10.
    </p>

    <div class="table-wrap">
      <table>
        <thead><tr><th>Step</th><th>Time</th><th>Input</th></tr></thead>
        <tbody>
          <tr v-for="(s, i) in rec.steps" :key="i">
            <td>{{ s.title || stepOf(s.id)?.title || s.id }}<span v-if="s.end === 'skip' || s.end === 'stop'" class="muted small"> ({{ s.end === 'skip' ? 'skipped' : 'stopped' }})</span></td>
            <td class="num">{{ fmtDuration(s.activeMs ?? ms(s.startedAt, s.endedAt)) }}</td>
            <td>
              <template v-if="stepOf(s.id)?.input?.type === 'text'"><span class="pre">{{ s.input?.[stepOf(s.id).input.key || 'text'] }}</span></template>
              <img v-else-if="stepOf(s.id)?.input?.type === 'sketch' && s.input?.[stepOf(s.id).input.key || 'sketch']" :src="s.input[stepOf(s.id).input.key || 'sketch']" class="thumb" alt="Sketch" />
              <template v-else>{{ inputSummary(stepOf(s.id)?.input, s.input) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <dl class="small facts">
      <dt>Audio</dt><dd>{{ audioLabel }}</dd>
      <dt>Helmet</dt><dd>{{ helmetLabel }}</dd>
      <dt>Kp</dt><dd>{{ env?.kpValid ? env.kp.toFixed(1) : '–' }}<template v-if="env?.kpValid && env.kpSource"> ({{ env.kpSource }})</template><span v-else-if="env?.kpNote" class="muted"> {{ env.kpNote }}</span></dd>
      <dt>LST</dt><dd>{{ env?.timeValid && env.lst >= 0 ? `${env.lst.toFixed(2)} h` : '–' }}<span v-if="!(env?.timeValid && env.lst >= 0) && env?.lstNote" class="muted"> {{ env.lstNote }}</span></dd>
      <dt>Guide version</dt><dd class="mono">{{ rec.guideHash ? rec.guideHash.slice(0, 16) : '–' }}</dd>
    </dl>
  </div>
</template>

<style scoped>
.between { justify-content: space-between; align-items: flex-start; }
.tight { gap: 2px; }
.reveal { border: 1px solid var(--accent); border-radius: 8px; padding: 12px; }
.guess { border: 0; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; }
.guess legend { width: 100%; padding: 0; margin-bottom: 4px; }
.pre { white-space: pre-wrap; }
.thumb { width: 96px; border-radius: 6px; display: block; }
.arv { border-top: 1px solid var(--line); padding-top: 10px; }
.checks { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; }
.feedback { margin: 0; max-width: 420px; display: grid; gap: 4px; }
.feedback img { width: 100%; border-radius: 6px; display: block; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; min-width: 0; }
</style>
