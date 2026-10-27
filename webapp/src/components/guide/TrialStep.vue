<script setup>
// Drives the helmet's blinded trial (trial.new / lock / judge / ranks / reveal)
// from inside a guide; same commitments and checks as the Experiment tab.
// ARV (docs/GUIDES.md): 2-picture sets, the helmet's target is outcome A. The
// reveal waits for the outcome; if it is not known during the run, it is done
// later from the run summary. Stored as { action, trialId, ... }.
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { device, call, connect } from '../../ble/device.js'
import { listSets, usableSets, manifestHash, getSet } from '../../lib/pool.js'
import { idb } from '../../lib/idb.js'
import { randomBelow } from '../../lib/crypto.js'
import {
  arvPrediction, arvPictureFor, arvPass, arvPassStep, arvOutcomeStep, trialStepIndex, trialChecks,
  responseHashOf, sketchDigests, markArvTrial,
} from '../../lib/runs.js'

const props = defineProps({ input: { type: Object, required: true }, modelValue: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])
const run = inject('guideRun', null)

const action = props.input.action
const state = reactive({ ...(props.modelValue ?? {}), action })
const save = () => emit('update:modelValue', { ...state })

const busy = ref(false)
const error = ref('')
const trial = computed(() => run?.ctx?.trial ?? null)
const setTrial = (t) => {
  if (run?.ctx) run.ctx.trial = t
  state.trialId = t.id
}

// The other steps of this trial (this input belongs to the current step while mounted).
const guide = run?.guide ?? null
const judgeIdx = guide ? trialStepIndex(guide, run.index, 'judge') : -1
const passStep = guide ? arvPassStep(guide, judgeIdx) : null
const outcomeStep = guide ? arvOutcomeStep(guide, judgeIdx) : null
const arv = computed(() => !!(props.input.arv || run?.ctx?.arv || state.arv || (outcomeStep && trial.value?.setSize === 2)))

async function act(fn) {
  error.value = ''
  busy.value = true
  try {
    await fn()
    save()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

// ---------------------------------------------------------------- create
const pool = ref(null) // { all, offered }
async function loadPool() {
  const all = await listSets()
  pool.value = { all, offered: usableSets(all).filter((s) => !props.input.arv || s.images.length === 2) }
}
const create = () => act(async () => {
  await loadPool()
  if (!pool.value.offered.length) throw new Error(props.input.arv ? 'ARV needs at least one set of exactly 2 pictures (Targets tab).' : 'Add at least one set of 2–8 pictures in the Targets tab first.')
  const t = await call('trial.new', {
    mode: props.input.mode === 'telepathy' ? 'telepathy' : 'rv',
    manifestHash: await manifestHash(pool.value.all),
    sets: pool.value.offered.map((s) => ({ id: s.id, size: s.images.length })),
  })
  setTrial(t)
  if (run?.ctx) run.ctx.arv = !!props.input.arv
  // The device is recorded so that a later reveal (ARV) can check it talks to the same helmet.
  Object.assign(state, { mode: t.mode, arv: !!props.input.arv, commitment: t.commitment, createdAt: t.created, device: { kind: device.kind, name: device.name } })
  if (props.input.arv) await markArvTrial(t).catch(() => {})
})

// ---------------------------------------------------------------- lock
// The response is everything written since the create step (text, CRV data)
// and every sketch. It is hashed exactly as in the Experiment tab, which keeps
// one sketch: with several, each sketch's SHA-256 is added to the text.
function crvText(v, inp) {
  const lines = [`CRV stage ${v.stage}`]
  const labels = Object.fromEntries((inp?.fields ?? []).map((f) => [f.key, f.label || f.key]))
  const add = (vals, prefix = '') => {
    for (const [k, val] of Object.entries(vals ?? {})) {
      if (k === 'at') continue
      if (Array.isArray(val)) {
        if (val.length) lines.push(`${prefix}${labels[k] ?? k}: ${val.map((e) => e.text).join(', ')}`)
      } else if (typeof val === 'string' && val.trim() && !val.startsWith('data:')) lines.push(`${prefix}${labels[k] ?? k}: ${val.trim()}`)
    }
  }
  if (v.iterations) v.iterations.forEach((it, i) => add(it, `${i + 1}. `))
  else add(v.fields)
  for (const b of v.breaks ?? []) lines.push(`${b.kind} break${b.text ? `: ${b.text}` : ''}`)
  return lines.join('\n')
}
function composeResponse() {
  const steps = run?.guide?.steps ?? []
  const here = run?.index ?? steps.length
  let from = 0
  for (let i = here - 1; i >= 0; i--) if (steps[i].input?.type === 'trial' && steps[i].input.action === 'create') { from = i + 1; break }
  const parts = []
  const sketches = []
  for (let i = from; i < here; i++) {
    const inp = steps[i].input
    const v = run.inputs[steps[i].id]
    if (!inp || !v) continue
    if (inp.type === 'text') parts.push(String(v[inp.key || 'text'] ?? '').trim())
    if (inp.type === 'sketch' && v[inp.key || 'sketch']) sketches.push(v[inp.key || 'sketch'])
    if (inp.type === 'crv') {
      parts.push(crvText(v, inp))
      for (const vals of v.iterations ?? [v.fields]) for (const val of Object.values(vals ?? {})) if (typeof val === 'string' && val.startsWith('data:image')) sketches.push(val)
    }
  }
  return { text: parts.filter(Boolean).join('\n\n'), sketches }
}
const SKETCH_BLOCK = '\n\nSketches (SHA-256, in order):\n'
const response = reactive({ text: '', sketches: [] })
const lock = () => act(async () => {
  const t = trial.value
  const sketches = [...response.sketches]
  if (!response.text.trim() && !sketches.length) throw new Error('Write or sketch your impressions first.')
  let text = response.text
  if (sketches.length > 1) text = `${text}${SKETCH_BLOCK}${(await sketchDigests(sketches)).map((h, i) => `${i + 1}. ${h}`).join('\n')}`
  const rec = { trialId: t.id, text, sketch: sketches.at(-1) ?? '', ...(sketches.length > 1 ? { sketches } : {}) }
  await idb.put('responses', rec)
  const responseHash = await responseHashOf(t.id, rec)
  const nt = await call('trial.lock', { id: t.id, responseHash })
  setTrial(nt)
  Object.assign(state, { responseHash, sketchCount: sketches.length, lockedAt: nt.lockedAt, kp: nt.kpValid ? nt.kp : null, lst: nt.lst >= 0 ? nt.lst : null })
})

// ---------------------------------------------------------------- judge
const pictures = ref([]) // object URLs in display order
const ranks = ref([])
const ratings = ref([])
const locked = ref(null) // the locked response, shown while judging
const lockedText = computed(() => String(locked.value?.text ?? '').split(SKETCH_BLOCK)[0])
const lockedSketches = computed(() => (locked.value?.sketches?.length ? locked.value.sketches : locked.value?.sketch ? [locked.value.sketch] : []))
function revoke() {
  pictures.value.forEach(URL.revokeObjectURL)
  pictures.value = []
}
async function loadPictures(t) {
  const set = await getSet(t.set)
  if (!set || set.images.length !== t.setSize) throw new Error(`Set "${t.set}" is missing or changed on this phone; judging needs the pool that started the trial.`)
  revoke()
  pictures.value = t.order.map((i) => URL.createObjectURL(set.images[i].blob))
  return set
}
const startJudging = () => act(async () => {
  let t = trial.value
  if (t.state === 'locked') t = await call('trial.judge', { id: t.id })
  setTrial(t)
  await loadPictures(t)
  locked.value = (await idb.get('responses', t.id)) ?? null
  ranks.value = t.ranks?.length ? [...t.ranks] : new Array(t.setSize).fill(0)
  ratings.value = state.ratings?.length === t.setSize ? [...state.ratings] : new Array(t.setSize).fill(null)
})
// ARV judged here: rate both pictures 0–7; a margin under 2 points, equal
// ratings included, is a pass (not scored). With the guide's own pass-check
// step the pictures are simply ranked here.
const rateHere = computed(() => arv.value && trial.value?.setSize === 2 && !passStep)
const submitRanks = () => act(async () => {
  const t = trial.value
  let r = ranks.value.map(Number)
  if (rateHere.value) {
    const [a, b] = ratings.value
    if (a == null || b == null) throw new Error('Rate both pictures.')
    // The helmet needs distinct ranks; for equal ratings (a pass) they are drawn at random.
    r = a === b ? (randomBelow(2) ? [1, 2] : [2, 1]) : a > b ? [1, 2] : [2, 1]
    Object.assign(state, { ratings: [a, b], pass: Math.abs(a - b) < 2, randomRanks: a === b })
    if (run?.ctx) run.ctx.arvPass = state.pass
  }
  if (r.includes(0) || new Set(r).size !== r.length) throw new Error('Give every picture a different rank.')
  setTrial(await call('trial.ranks', { id: t.id, ranks: r }))
  state.ranks = r
})

// ---------------------------------------------------------------- reveal
const outcomeOptions = computed(() => (outcomeStep?.input.options?.length ? outcomeStep.input.options : ['A', 'B']))
const outcome = computed(() => {
  const v = outcomeStep ? run.inputs[outcomeStep.id]?.[outcomeStep.input.key || 'outcome'] : undefined
  const i = v == null ? -1 : outcomeOptions.value.indexOf(v)
  return i < 0 ? null : i
})
const passNow = () => (guide && judgeIdx >= 0 ? arvPass(guide, judgeIdx, (id) => run.inputs[id]) : null) ?? run?.ctx?.arvPass ?? null
// ARV without a known outcome: the mapping stays sealed until it is entered.
const waiting = computed(() => action === 'reveal' && arv.value && outcome.value === null && trial.value?.state !== 'revealed')
function defer() {
  Object.assign(state, { trialId: trial.value.id, arv: true, deferred: true, pass: passNow(), outcome: null, hit: null })
  save()
}
const checks = ref(null)
const feedbackPicture = ref('')
const reveal = () => act(async () => {
  let t = trial.value
  if (t.state !== 'revealed') t = await call('trial.reveal', { id: t.id })
  setTrial(t)
  const [all, resp] = await Promise.all([listSets(), idb.get('responses', t.id)])
  checks.value = await trialChecks(t, { manifest: await manifestHash(all), response: resp })
  Object.assign(state, { targetRank: t.targetRank, setSize: t.setSize, condition: t.condition, checks: checks.value, arv: arv.value, revealed: true, revealedAt: new Date().toISOString() })
  if (arv.value) {
    const prediction = arvPrediction(t)
    const o = outcome.value
    Object.assign(state, { prediction: outcomeOptions.value[prediction], outcome: o === null ? null : outcomeOptions.value[o], hit: o === null ? null : prediction === o, pass: passNow(), deferred: o === null })
    if (o !== null) {
      const set = await getSet(t.set)
      const img = set?.images[arvPictureFor(t, o)]
      if (img) feedbackPicture.value = URL.createObjectURL(img.blob)
    }
  } else {
    await loadPictures(t)
  }
})
const targetPos = computed(() => (trial.value?.state === 'revealed' ? trial.value.order.indexOf(trial.value.target) : -1))
const arvVerdict = computed(() => (state.pass ? 'Pass' : state.hit == null ? 'Outcome pending' : state.hit ? 'Hit' : 'Miss'))

// ---------------------------------------------------------------- no trial in this run yet
const WANT = { lock: ['open'], judge: ['locked', 'judging'], reveal: ['judging', 'revealed'] }
const candidates = ref([])
const pick = ref(0)
async function loadCandidates() {
  if (!device.kind || action === 'create') return
  try {
    const page = await call('trial.list', { offset: 0, limit: 10 })
    candidates.value = page.items.filter((t) => WANT[action]?.includes(t.state))
    pick.value = candidates.value[0]?.id ?? 0
  } catch (e) {
    error.value = e.message
  }
}
const usePicked = () => act(async () => {
  setTrial(await call('trial.get', { id: pick.value }))
  await prepare()
})

async function prepare() {
  const t = trial.value
  if (!t) return loadCandidates()
  if (action === 'lock' && !state.responseHash) Object.assign(response, composeResponse())
  if (action === 'judge' && t.state === 'judging') await startJudging()
  if (action === 'reveal' && t.state === 'revealed') await reveal()
  else if (waiting.value) defer()
}

onMounted(() => {
  if (action === 'create') loadPool().catch((e) => (error.value = e.message))
  else prepare().catch((e) => (error.value = e.message))
})
onBeforeUnmount(() => {
  revoke()
  if (feedbackPicture.value) URL.revokeObjectURL(feedbackPicture.value)
})
</script>

<template>
  <div class="stack">
    <p v-if="input.prompt" class="prompt">{{ input.prompt }}</p>

    <div v-if="!device.kind" class="stack">
      <p class="small">Blinded trials run on the helmet (or the demo helmet), which picks and commits to the target.</p>
      <div class="row">
        <button type="button" class="btn primary" :disabled="!device.bluetooth || device.connecting" @click="connect('ble')">Connect helmet</button>
        <button type="button" class="btn" @click="connect('demo')">Use the demo</button>
      </div>
    </div>

    <template v-else-if="action === 'create'">
      <template v-if="!state.trialId">
        <p class="small">The helmet will pick a picture set and a target with its hardware RNG and publish a SHA-256 commitment before you begin.<template v-if="input.arv"> ARV: the target picture belongs to outcome A, the other one to B.</template></p>
        <p v-if="pool" class="small muted">{{ pool.offered.length }} {{ input.arv ? 'two-picture' : 'usable' }} set(s) in your pool. <a href="#targets">Targets tab</a></p>
        <div class="row"><button type="button" class="btn primary" :disabled="busy" @click="create">Create trial</button></div>
      </template>
      <template v-else>
        <p><b>Trial #{{ state.trialId }}</b> created<template v-if="state.arv"> (ARV)</template>. Commitment:</p>
        <div class="mono">{{ state.commitment }}</div>
        <p v-if="state.mode === 'telepathy'" class="small warn">Sender: on a second phone with the same pool, open Experiment → Sender, trial {{ state.trialId }}. The receiver must not see that screen.</p>
      </template>
    </template>

    <template v-else-if="!trial">
      <p class="small">No trial was created earlier in this run.</p>
      <div v-if="candidates.length" class="row">
        <select v-model.number="pick" aria-label="Trial to continue" style="max-width: 260px">
          <option v-for="t in candidates" :key="t.id" :value="t.id">#{{ t.id }} · {{ t.mode }} · {{ t.state }}</option>
        </select>
        <button type="button" class="btn" :disabled="busy" @click="usePicked">Continue this trial</button>
      </div>
      <p v-else class="small muted">No suitable trial on the helmet. Skip this step.</p>
    </template>

    <template v-else-if="action === 'lock'">
      <template v-if="!state.responseHash">
        <label class="field"><span class="lbl">Your response for trial #{{ trial.id }} (collected from the previous steps; edit if needed)</span>
          <textarea v-model="response.text" rows="8"></textarea>
        </label>
        <div v-if="response.sketches.length" class="row">
          <img v-for="(src, i) in response.sketches" :key="i" :src="src" class="sketch" :alt="`Sketch ${i + 1} included in the response`" />
        </div>
        <p class="small muted">Locking hashes this text{{ response.sketches.length > 1 ? ` and all ${response.sketches.length} sketches` : response.sketches.length ? ' and the sketch' : '' }} and sends the hash to the helmet. After that nothing can be changed.</p>
        <div class="row"><button type="button" class="btn primary" :disabled="busy || trial.state !== 'open'" @click="lock">Lock response</button></div>
        <p v-if="trial.state !== 'open'" class="small warn">Trial #{{ trial.id }} is already {{ trial.state }}.</p>
      </template>
      <p v-else class="small ok">✓ Response locked. Hash: <span class="mono">{{ state.responseHash }}</span></p>
    </template>

    <template v-else-if="action === 'judge'">
      <template v-if="!pictures.length && !state.ranks">
        <p class="small">{{ rateHere ? 'You will see both pictures and rate how well each matches the response.' : 'You will see every picture of the set in random order and rank them.' }}</p>
        <p v-if="arv" class="small muted">Ideally someone else judges, so the viewer only ever sees the picture of the real outcome.</p>
        <div class="row"><button type="button" class="btn primary" :disabled="busy || !['locked', 'judging'].includes(trial.state)" @click="startJudging">Show the pictures</button></div>
        <p v-if="!['locked', 'judging'].includes(trial.state)" class="small warn">Trial #{{ trial.id }} is {{ trial.state }}; lock the response first.</p>
      </template>
      <template v-else-if="pictures.length">
        <details v-if="locked" class="locked" open>
          <summary class="small">Your locked response (trial #{{ trial.id }})</summary>
          <p v-if="lockedText.trim()" class="small pre">{{ lockedText }}</p>
          <div v-if="lockedSketches.length" class="row">
            <img v-for="(src, i) in lockedSketches" :key="i" :src="src" class="sketch" :alt="`Sketch ${i + 1} of the response`" />
          </div>
        </details>
        <p v-else class="small warn">The locked response is not stored on this phone; judge from memory or your notes.</p>
        <p v-if="arv && passStep" class="small muted">Rank both pictures here; the next step asks how well each matches (the pass check).</p>
        <div class="pics">
          <figure v-for="(src, pos) in pictures" :key="pos" class="pic">
            <img :src="src" :alt="`Picture ${pos + 1}`" />
            <label v-if="rateHere" class="field">Match 0–7
              <select v-model.number="ratings[pos]" :disabled="trial.ranked">
                <option :value="null">rate…</option>
                <option v-for="r in 8" :key="r" :value="r - 1">{{ r - 1 }}{{ r === 1 ? ' (none)' : r === 8 ? ' (excellent)' : '' }}</option>
              </select>
            </label>
            <select v-else v-model.number="ranks[pos]" :disabled="trial.ranked" :aria-label="`Rank for picture ${pos + 1}`">
              <option :value="0">rank…</option>
              <option v-for="r in trial.setSize" :key="r" :value="r">{{ r }}{{ r === 1 ? ' (best)' : '' }}</option>
            </select>
          </figure>
        </div>
        <div v-if="!trial.ranked" class="row"><button type="button" class="btn primary" :disabled="busy" @click="submitRanks">Submit</button></div>
        <p v-else class="small ok">✓ Judging recorded.<template v-if="rateHere && state.pass"> The margin is under 2 points: this trial counts as a pass (not scored).<template v-if="state.randomRanks"> Equal ratings: the ranks sent to the helmet were drawn at random.</template></template></p>
      </template>
      <p v-else class="small ok">✓ Judging recorded for trial #{{ trial.id }}.</p>
    </template>

    <template v-else-if="action === 'reveal'">
      <div v-if="waiting" class="stack">
        <p class="small"><b>The reveal waits for the outcome.</b> The mapping of trial #{{ trial.id }} stays sealed, so the only picture you will see is the one of the real outcome.</p>
        <p class="small">Finish this session. When the outcome is known, open this run under <b>Past runs</b> in the Guides tab, enter the outcome there and reveal, with the same helmet<template v-if="device.name"> ({{ device.name }})</template> connected.</p>
      </div>
      <template v-else-if="trial.state !== 'revealed'">
        <div class="row"><button type="button" class="btn primary" :disabled="busy || !trial.ranked" @click="reveal">Reveal</button></div>
        <p v-if="!trial.ranked" class="small warn">Rank the pictures first.</p>
      </template>
      <div v-else class="reveal" aria-live="polite">
        <template v-if="arv">
          <div class="big num" :class="state.hit && !state.pass ? 'ok' : ''">{{ arvVerdict }}</div>
          <p v-if="state.pass" class="small">Pass (not scored): the two match ratings were less than 2 points apart, so this trial counts neither as a hit nor as a miss.</p>
          <p class="small">Prediction: <b>{{ state.prediction }}</b> · actual outcome: <b>{{ state.outcome ?? 'not known yet' }}</b></p>
          <p v-if="state.hit == null" class="small muted">Enter the outcome later from Past runs to score the trial and see your feedback picture.</p>
          <figure v-if="feedbackPicture" class="pic feedback"><img :src="feedbackPicture" alt="Feedback picture for the actual outcome" /><figcaption class="small muted">The picture of the actual outcome: your feedback.</figcaption></figure>
        </template>
        <template v-else>
          <div class="big num" :class="trial.targetRank === 1 ? 'ok' : ''">{{ trial.targetRank === 1 ? 'Hit' : `Rank ${trial.targetRank} of ${trial.setSize}` }}</div>
          <p class="small">Chance of a first-place hit: {{ Math.round(100 / trial.setSize) }} %. The target is outlined.</p>
          <div v-if="pictures.length" class="pics">
            <figure v-for="(src, pos) in pictures" :key="pos" class="pic" :class="{ target: pos === targetPos }"><img :src="src" :alt="`Picture ${pos + 1}${pos === targetPos ? ' (target)' : ''}`" /></figure>
          </div>
        </template>
        <ul v-if="checks" class="small checks">
          <li :class="checks.commitment ? 'ok' : 'bad'">{{ checks.commitment ? '✓' : '✗' }} Commitment matches the revealed trial, pool, set, target and condition</li>
          <li :class="checks.pool ? 'ok' : 'bad'">{{ checks.pool ? '✓' : '✗' }} Picture pool unchanged since the trial started</li>
          <li :class="checks.response ? 'ok' : 'bad'">{{ checks.response ? '✓' : '✗' }} Response unchanged since locking</li>
        </ul>
        <p class="small muted">Kp at lock: {{ trial.kpValid ? trial.kp.toFixed(2) : '–' }} · LST: {{ trial.lst >= 0 ? trial.lst.toFixed(2) + ' h' : '–' }}</p>
      </div>
    </template>

    <p v-if="error" class="small bad">{{ error }}<template v-if="/safety/.test(error)"> <a href="#safety">Safety page</a></template></p>
  </div>
</template>

<style scoped>
.prompt { font-size: 15px; }
.lbl { color: var(--text); font-size: 14px; }
.sketch { max-width: 240px; border-radius: 6px; }
.locked { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; display: grid; gap: 6px; }
.locked summary { cursor: pointer; font-weight: 600; }
.locked .sketch { max-width: 160px; }
.pre { white-space: pre-wrap; margin: 0; }
.pics { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.pic { margin: 0; border: 1px solid var(--line); border-radius: 8px; padding: 6px; display: grid; gap: 6px; }
.pic img { width: 100%; border-radius: 6px; display: block; }
.pic.target { border-color: var(--ok); box-shadow: 0 0 0 2px var(--ok); }
.feedback { max-width: 420px; }
.big { font-size: 34px; line-height: 1.1; }
.reveal { display: grid; gap: 8px; }
.checks { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; }
</style>
