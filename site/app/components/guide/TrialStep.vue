<script setup lang="ts">
// Drives the helmet's blinded trial (trial.new / lock / judge / ranks / reveal)
// from inside a guide; same commitments and checks as the Trials tab.
// ARV (docs/GUIDES.md): 2-picture sets, the helmet's target is outcome A. The
// reveal waits for the outcome; if it is not known during the run, it is done
// later from the run summary. Stored as { action, trialId, ... }.
import { randomBelow } from '#core/lib/crypto.js'
import { device, call, start, errorMessage } from '~/lib/device'
import { GUIDE_RUN } from '~/lib/guideRun'
import { loadResponse, storeResponse } from '~/lib/responses'
import {
  listSets, usableSets, manifestHash, getSet,
  arvPrediction, arvPictureFor, arvPass, arvPassStep, arvOutcomeStep, trialStepIndex, trialChecks, responseHashOf, sketchDigests, markArvTrial,
  type CrvInputSpec, type InputValue, type JudgedTrial, type PictureSet, type RevealedTrial, type RunDevice, type Trial, type TrialAction, type TrialChecks, type TrialInputSpec, type TrialResponse,
} from '~/lib/guides'

interface Stored {
  action: TrialAction
  trialId?: number
  mode?: string
  arv?: boolean
  commitment?: string
  createdAt?: number
  device?: RunDevice
  responseHash?: string
  sketchCount?: number
  lockedAt?: number
  kp?: number | null
  lst?: number | null
  ratings?: (number | null)[]
  ranks?: number[]
  pass?: boolean | null
  randomRanks?: boolean
  targetRank?: number
  setSize?: number
  condition?: string
  checks?: TrialChecks
  revealed?: boolean
  revealedAt?: string
  prediction?: string
  outcome?: string | null
  hit?: boolean | null
  deferred?: boolean
}
const props = defineProps<{ input: TrialInputSpec, modelValue?: Stored | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: Stored] }>()
const run = inject(GUIDE_RUN, null)
const { safetyPath } = useAppNav()
const { online, lost } = useHelmetLink()

const action = props.input.action
const state = reactive<Stored>({ ...(props.modelValue ?? {}), action })
const save = () => emit('update:modelValue', { ...state })

const busy = ref(false)
const error = ref('')
const trial = computed(() => run?.ctx?.trial ?? null)
const setTrial = (t: Trial) => {
  if (run?.ctx) run.ctx.trial = t
  state.trialId = t.id
}

// The other steps of this trial (this input belongs to the current step while mounted).
const guide = run?.guide ?? null
const judgeIdx = guide ? trialStepIndex(guide, run!.index, 'judge') : -1
const passStep = guide ? arvPassStep(guide, judgeIdx) : null
const outcomeStep = guide ? arvOutcomeStep(guide, judgeIdx) : null
const arv = computed(() => !!(props.input.arv || run?.ctx?.arv || state.arv || (outcomeStep && trial.value?.setSize === 2)))

async function act(fn: () => Promise<void>) {
  error.value = ''
  busy.value = true
  try {
    await fn()
    save()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

// ---------------------------------------------------------------- create
const pool = ref<{ all: PictureSet[], offered: PictureSet[] } | null>(null)
async function loadPool() {
  const all = await listSets()
  pool.value = { all, offered: usableSets(all).filter((s) => !props.input.arv || s.images.length === 2) }
}
const create = () => act(async () => {
  await loadPool()
  if (!pool.value!.offered.length) throw new Error(props.input.arv ? 'ARV needs at least one set of exactly 2 pictures (Trials → Picture pool).' : 'Add at least one set of 2–8 pictures in Trials → Picture pool first.')
  // With a token: when the answer gets lost, the app finds the trial again instead of creating a second one.
  const t = await start<Trial>('trial.new', {
    mode: props.input.mode === 'telepathy' ? 'telepathy' : 'rv',
    manifestHash: await manifestHash(pool.value!.all),
    sets: pool.value!.offered.map((s) => ({ id: s.id, size: s.images.length })),
  })
  setTrial(t)
  if (run?.ctx) run.ctx.arv = !!props.input.arv
  // The device is recorded so that a later reveal (ARV) can check it talks to the same helmet.
  Object.assign(state, { mode: t.mode, arv: !!props.input.arv, commitment: t.commitment, createdAt: t.created, device: { kind: device.kind, name: device.name, helmetId: device.info?.helmetId ?? '' } })
  if (props.input.arv) await markArvTrial(t).catch(() => {})
})

// ---------------------------------------------------------------- lock
// The response is everything written since the create step (text, CRV data)
// and every sketch. It is hashed exactly as in the Trials tab, which keeps
// one sketch: with several, each sketch's SHA-256 is added to the text.
interface CrvValue { stage?: number, fields?: Record<string, unknown>, iterations?: Record<string, unknown>[], breaks?: { kind: string, text?: string }[] }
function crvText(v: CrvValue, inp: CrvInputSpec) {
  const lines = [`CRV stage ${v.stage}`]
  const labels: Record<string, string> = Object.fromEntries((inp?.fields ?? []).map((f) => [f.key, f.label || f.key]))
  const add = (vals: Record<string, unknown> | undefined, prefix = '') => {
    for (const [k, val] of Object.entries(vals ?? {})) {
      if (k === 'at') continue
      if (Array.isArray(val)) {
        if (val.length) lines.push(`${prefix}${labels[k] ?? k}: ${val.map((e: { text: string }) => e.text).join(', ')}`)
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
  for (let i = here - 1; i >= 0; i--) {
    const inp = steps[i]!.input
    if (inp?.type === 'trial' && inp.action === 'create') {
      from = i + 1
      break
    }
  }
  const parts: string[] = []
  const sketches: string[] = []
  for (let i = from; i < here; i++) {
    const inp = steps[i]!.input
    const v = run!.inputs[steps[i]!.id] as InputValue | null | undefined
    if (!inp || !v) continue
    if (inp.type === 'text') parts.push(String(v[inp.key || 'text'] ?? '').trim())
    if (inp.type === 'sketch' && v[inp.key || 'sketch']) sketches.push(v[inp.key || 'sketch'] as string)
    if (inp.type === 'crv') {
      const crv = v as CrvValue
      parts.push(crvText(crv, inp))
      for (const vals of crv.iterations ?? [crv.fields]) for (const val of Object.values(vals ?? {})) if (typeof val === 'string' && val.startsWith('data:image')) sketches.push(val)
    }
  }
  return { text: parts.filter(Boolean).join('\n\n'), sketches }
}
const SKETCH_BLOCK = '\n\nSketches (SHA-256, in order):\n'
const response = reactive<{ text: string, sketches: string[] }>({ text: '', sketches: [] })
const lock = () => act(async () => {
  const t = trial.value!
  const sketches = [...response.sketches]
  if (!response.text.trim() && !sketches.length) throw new Error('Write or sketch your impressions first.')
  let text = response.text
  if (sketches.length > 1) text = `${text}${SKETCH_BLOCK}${(await sketchDigests(sketches)).map((h, i) => `${i + 1}. ${h}`).join('\n')}`
  const rec: TrialResponse = { trialId: t.id, text, sketch: sketches.at(-1) ?? '', ...(sketches.length > 1 ? { sketches } : {}) }
  await storeResponse(rec)
  const responseHash = await responseHashOf(t.id, rec)
  sentLock = { responseHash, sketchCount: sketches.length }
  const nt = await call<Trial>('trial.lock', { id: t.id, responseHash })
  setTrial(nt)
  Object.assign(state, { responseHash, sketchCount: sketches.length, lockedAt: nt.lockedAt, kp: nt.kpValid ? nt.kp : null, lst: nt.lst >= 0 ? nt.lst : null })
})
// The lock that was sent last: when its answer got lost, the helmet's trial says whether it went through.
let sentLock: { responseHash: string, sketchCount: number } | null = null

// ---------------------------------------------------------------- judge
const pictures = ref<string[]>([]) // object URLs in display order
const ranks = ref<number[]>([])
const ratings = ref<(number | null)[]>([])
const locked = ref<TrialResponse | null>(null) // the locked response, shown while judging
const lockedText = computed(() => String(locked.value?.text ?? '').split(SKETCH_BLOCK)[0]!)
const lockedSketches = computed(() => (locked.value?.sketches?.length ? locked.value.sketches : locked.value?.sketch ? [locked.value.sketch] : []))
function revoke() {
  pictures.value.forEach((u) => URL.revokeObjectURL(u))
  pictures.value = []
}
async function loadPictures(t: JudgedTrial) {
  const set = await getSet(t.set)
  if (!set || set.images.length !== t.setSize) throw new Error(`Set "${t.set}" is missing or changed on this phone; judging needs the pool that started the trial.`)
  revoke()
  pictures.value = t.order.map((i) => URL.createObjectURL(set.images[i]!.blob))
  return set
}
const startJudging = () => act(async () => {
  // From judging on, the helmet names the set and the order on screen.
  let t = trial.value as JudgedTrial
  if (t.state === 'locked') t = await call<JudgedTrial>('trial.judge', { id: t.id })
  setTrial(t)
  await loadPictures(t)
  locked.value = (await loadResponse(t)) ?? null
  ranks.value = t.ranks?.length ? [...t.ranks] : new Array(t.setSize).fill(0)
  ratings.value = state.ratings?.length === t.setSize ? [...state.ratings] : new Array(t.setSize).fill(null)
})
// ARV judged here: rate both pictures 0–7; a margin under 2 points, equal
// ratings included, is a pass (not scored). With the guide's own pass-check
// step the pictures are simply ranked here.
const rateHere = computed(() => arv.value && trial.value?.setSize === 2 && !passStep)
const submitRanks = () => act(async () => {
  const t = trial.value!
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
  setTrial(await call<Trial>('trial.ranks', { id: t.id, ranks: r }))
  state.ranks = r
})
const rankItems = computed(() => Array.from({ length: trial.value?.setSize ?? 0 }, (_, i) => ({ value: i + 1, label: `${i + 1}${i === 0 ? ' (best)' : ''}` })))
const RATE_ITEMS = Array.from({ length: 8 }, (_, i) => ({ value: i, label: `${i}${i === 0 ? ' (none)' : i === 7 ? ' (excellent)' : ''}` }))

// ---------------------------------------------------------------- reveal
const outcomeOptions = computed(() => (outcomeStep?.input.options?.length ? outcomeStep.input.options : ['A', 'B']))
const outcome = computed(() => {
  const v = outcomeStep ? run!.inputs[outcomeStep.id]?.[outcomeStep.input.key || 'outcome'] as string | null | undefined : undefined
  const i = v == null ? -1 : outcomeOptions.value.indexOf(v)
  return i < 0 ? null : i
})
const passNow = () => (guide && judgeIdx >= 0 ? arvPass(guide, judgeIdx, (id) => run!.inputs[id]) : null) ?? run?.ctx?.arvPass ?? null
// ARV without a known outcome: the mapping stays sealed until it is entered.
const waiting = computed(() => action === 'reveal' && arv.value && outcome.value === null && trial.value?.state !== 'revealed')
function defer() {
  Object.assign(state, { trialId: trial.value!.id, arv: true, deferred: true, pass: passNow(), outcome: null, hit: null })
  save()
}
const checks = ref<TrialChecks | null>(null)
const feedbackPicture = ref('')
const reveal = () => act(async () => {
  let t = trial.value as RevealedTrial
  if (t.state !== 'revealed') t = await call<RevealedTrial>('trial.reveal', { id: t.id })
  setTrial(t)
  const [all, resp] = await Promise.all([listSets(), loadResponse(t)])
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
const targetPos = computed(() => (trial.value?.state === 'revealed' ? (trial.value.order ?? []).indexOf(trial.value.target ?? -1) : -1))
const arvVerdict = computed(() => (state.pass ? 'Pass' : state.hit == null ? 'Outcome pending' : state.hit ? 'Hit' : 'Miss'))

// ---------------------------------------------------------------- no trial in this run yet
const WANT: Partial<Record<TrialAction, string[]>> = { lock: ['open'], judge: ['locked', 'judging'], reveal: ['judging', 'revealed'] }
const candidates = ref<Trial[]>([])
const pick = ref(0)
const candidateItems = computed(() => candidates.value.map((t) => ({ value: t.id, label: `#${t.id}, ${t.mode}, ${t.state}` })))
async function loadCandidates() {
  if (!device.kind || action === 'create') return
  try {
    const page = await call<{ items: Trial[] }>('trial.list', { offset: 0, limit: 10 })
    candidates.value = page.items.filter((t) => WANT[action]?.includes(t.state))
    pick.value = candidates.value[0]?.id ?? 0
  } catch (e) {
    error.value = errorMessage(e)
  }
}
const usePicked = () => act(async () => {
  setTrial(await call<Trial>('trial.get', { id: pick.value }))
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
  if (action === 'create') loadPool().catch((e) => (error.value = errorMessage(e)))
  else prepare().catch((e) => (error.value = errorMessage(e)))
})
// Connected from inside this step: look for the helmet's open trials now.
// Back after a lost connection: the trial as the helmet has it now. A request
// whose answer got lost may have gone through all the same.
watch(online, async (on) => {
  if (!on) return
  const t = trial.value
  if (!t) return loadCandidates()
  try {
    const now = await call<Trial>('trial.get', { id: t.id })
    if (now.commitment !== t.commitment || (now.state === t.state && now.ranked === t.ranked)) return
    error.value = ''
    setTrial(now)
    if (action === 'lock' && now.state !== 'open' && !state.responseHash && sentLock?.responseHash === now.responseHash) {
      Object.assign(state, { ...sentLock, lockedAt: now.lockedAt, kp: now.kpValid ? now.kp : null, lst: now.lst >= 0 ? now.lst : null })
      save()
    }
    if (action === 'judge' && now.ranked && !state.ranks && now.ranks) {
      state.ranks = [...now.ranks]
      save()
    }
  } catch {
    /* the step's own buttons say what is wrong */
  }
})
onBeforeUnmount(() => {
  revoke()
  if (feedbackPicture.value) URL.revokeObjectURL(feedbackPicture.value)
})
const CHECKS: [keyof TrialChecks, string][] = [
  ['commitment', 'Commitment matches the revealed trial, pool, set, target and condition'],
  ['pool', 'Picture pool unchanged since the trial started'],
  ['response', 'Response unchanged since locking'],
]
</script>

<template>
  <div class="grid gap-4">
    <p v-if="input.prompt" class="text-highlighted">{{ input.prompt }}</p>

    <p v-if="lost && !state.revealed" class="measure text-sm text-warning" role="status">The connection to the helmet is lost; the app is reconnecting. The trial waits on the helmet, and this step continues when it is back.</p>

    <div v-if="!device.kind" class="grid gap-3">
      <p class="measure text-sm">Blinded trials run on the helmet (or the demo helmet), which picks and commits to the target.</p>
      <AppConnect />
    </div>

    <template v-else-if="action === 'create'">
      <template v-if="!state.trialId">
        <p class="measure text-sm">The helmet will pick a picture set and a target with its hardware RNG and publish a SHA-256 commitment before you begin.<template v-if="input.arv"> ARV: the target picture belongs to outcome A, the other one to B.</template></p>
        <p v-if="pool" class="text-sm text-muted">{{ pool.offered.length }} {{ input.arv ? 'two-picture' : 'usable' }} set(s) in your pool. <NuxtLink to="/app/trials/pictures" class="text-primary underline underline-offset-4">Picture pool</NuxtLink></p>
        <div><UButton color="primary" variant="solid" :disabled="busy" @click="create">Create trial</UButton></div>
      </template>
      <template v-else>
        <p><b class="text-highlighted">Trial #{{ state.trialId }}</b> created<template v-if="state.arv"> (ARV)</template>. Commitment:</p>
        <div class="break-all font-mono text-xs text-muted">{{ state.commitment }}</div>
        <p v-if="state.mode === 'telepathy'" class="measure text-sm text-warning">Sender: on a second phone with the same pool, open Trials → Sender, trial {{ state.trialId }}. The receiver must not see that screen.</p>
      </template>
    </template>

    <template v-else-if="!trial">
      <p class="text-sm">No trial was created earlier in this run.</p>
      <div v-if="candidates.length" class="flex flex-wrap items-center gap-2">
        <USelect v-model="pick" :items="candidateItems" aria-label="Trial to continue" class="w-64 max-w-full" />
        <UButton :disabled="busy" @click="usePicked">Continue this trial</UButton>
      </div>
      <p v-else class="text-sm text-muted">No suitable trial on the helmet. Skip this step.</p>
    </template>

    <template v-else-if="action === 'lock'">
      <template v-if="!state.responseHash">
        <UFormField :label="`Your response for trial #${trial.id} (collected from the previous steps; edit if needed)`" :ui="{ label: 'font-normal text-highlighted' }">
          <UTextarea v-model="response.text" :rows="8" autoresize :maxrows="20" class="w-full" />
        </UFormField>
        <div v-if="response.sketches.length" class="flex flex-wrap gap-2">
          <GuideSketchImage v-for="(src, i) in response.sketches" :key="i" :src="src" class="max-w-60" :alt="`Sketch ${i + 1} included in the response`" />
        </div>
        <p class="measure text-sm text-muted">Locking hashes this text{{ response.sketches.length > 1 ? ` and all ${response.sketches.length} sketches` : response.sketches.length ? ' and the sketch' : '' }} and sends the hash to the helmet. After that nothing can be changed.</p>
        <div><UButton color="primary" variant="solid" icon="i-lucide-lock" :disabled="busy || trial.state !== 'open'" @click="lock">Lock response</UButton></div>
        <p v-if="trial.state !== 'open'" class="text-sm text-warning">Trial #{{ trial.id }} is already {{ trial.state }}.</p>
      </template>
      <p v-else class="flex gap-1.5 text-sm text-success">
        <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span class="min-w-0">Response locked. Hash: <span class="break-all font-mono text-xs">{{ state.responseHash }}</span></span>
      </p>
    </template>

    <template v-else-if="action === 'judge'">
      <template v-if="!pictures.length && !state.ranks">
        <p class="measure text-sm">{{ rateHere ? 'You will see both pictures and rate how well each matches the response.' : 'You will see every picture of the set in random order and rank them.' }}</p>
        <p v-if="arv" class="measure text-sm text-muted">Ideally someone else judges, so the viewer only ever sees the picture of the real outcome.</p>
        <div><UButton color="primary" variant="solid" :disabled="busy || !['locked', 'judging'].includes(trial.state)" @click="startJudging">Show the pictures</UButton></div>
        <p v-if="!['locked', 'judging'].includes(trial.state)" class="text-sm text-warning">Trial #{{ trial.id }} is {{ trial.state }}; lock the response first.</p>
      </template>
      <template v-else-if="pictures.length">
        <details v-if="locked" class="grid gap-2 rounded-lg border border-default px-3 py-2" open>
          <summary class="cursor-pointer text-sm font-semibold text-highlighted">Your locked response (trial #{{ trial.id }})</summary>
          <p v-if="lockedText.trim()" class="mt-2 whitespace-pre-wrap text-sm">{{ lockedText }}</p>
          <div v-if="lockedSketches.length" class="mt-2 flex flex-wrap gap-2">
            <GuideSketchImage v-for="(src, i) in lockedSketches" :key="i" :src="src" class="max-w-40" :alt="`Sketch ${i + 1} of the response`" />
          </div>
        </details>
        <p v-else class="text-sm text-warning">The locked response is not stored on this phone; judge from memory or your notes.</p>
        <p v-if="arv && passStep" class="text-sm text-muted">Rank both pictures here; the next step asks how well each matches (the pass check).</p>
        <div class="pics">
          <figure v-for="(src, pos) in pictures" :key="pos" class="pic">
            <img :src="src" :alt="`Picture ${pos + 1}`">
            <UFormField v-if="rateHere" label="Match 0–7">
              <USelect :model-value="ratings[pos] ?? undefined" :items="RATE_ITEMS" placeholder="rate…" :disabled="trial.ranked" class="w-full" @update:model-value="(v) => (ratings[pos] = v)" />
            </UFormField>
            <USelect v-else :model-value="ranks[pos] || undefined" :items="rankItems" placeholder="rank…" :disabled="trial.ranked" :aria-label="`Rank for picture ${pos + 1}`" class="w-full" @update:model-value="(v) => (ranks[pos] = Number(v))" />
          </figure>
        </div>
        <div v-if="!trial.ranked"><UButton color="primary" variant="solid" :disabled="busy" @click="submitRanks">Submit</UButton></div>
        <p v-else class="flex gap-1.5 text-sm text-success">
          <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Judging recorded.<template v-if="rateHere && state.pass"> The margin is under 2 points: this trial counts as a pass (not scored).<template v-if="state.randomRanks"> Equal ratings: the ranks sent to the helmet were drawn at random.</template></template></span>
        </p>
      </template>
      <p v-else class="flex gap-1.5 text-sm text-success"><UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />Judging recorded for trial #{{ trial.id }}.</p>
    </template>

    <template v-else-if="action === 'reveal'">
      <div v-if="waiting" class="measure grid gap-2">
        <p class="text-sm"><b class="text-highlighted">The reveal waits for the outcome.</b> The mapping of trial #{{ trial.id }} stays sealed, so the only picture you will see is the one of the real outcome.</p>
        <p class="text-sm">Finish this session. When the outcome is known, open this run under <b class="text-highlighted">Past runs</b> in the Guides tab, enter the outcome there and reveal, with the same helmet<template v-if="device.name"> ({{ device.name }})</template> connected.</p>
      </div>
      <template v-else-if="trial.state !== 'revealed'">
        <div><UButton color="primary" variant="solid" :disabled="busy || !trial.ranked" @click="reveal">Reveal</UButton></div>
        <p v-if="!trial.ranked" class="text-sm text-warning">Rank the pictures first.</p>
      </template>
      <div v-else class="grid gap-2.5" aria-live="polite">
        <template v-if="arv">
          <div class="num font-display text-4xl font-[620] leading-tight" :class="state.hit && !state.pass ? 'text-success' : 'text-highlighted'">{{ arvVerdict }}</div>
          <p v-if="state.pass" class="measure text-sm">Pass (not scored): the two match ratings were less than 2 points apart, so this trial counts neither as a hit nor as a miss.</p>
          <p class="text-sm">Prediction: <b class="text-highlighted">{{ state.prediction }}</b>, actual outcome: <b class="text-highlighted">{{ state.outcome ?? 'not known yet' }}</b></p>
          <p v-if="state.hit == null" class="text-sm text-muted">Enter the outcome later from Past runs to score the trial and see your feedback picture.</p>
          <figure v-if="feedbackPicture" class="pic max-w-md"><img :src="feedbackPicture" alt="Feedback picture for the actual outcome"><figcaption class="text-sm text-muted">The picture of the actual outcome: your feedback.</figcaption></figure>
        </template>
        <template v-else>
          <div class="num font-display text-4xl font-[620] leading-tight" :class="trial.targetRank === 1 ? 'text-success' : 'text-highlighted'">{{ trial.targetRank === 1 ? 'Hit' : `Rank ${trial.targetRank} of ${trial.setSize}` }}</div>
          <p class="text-sm">Chance of a first-place hit: {{ Math.round(100 / (trial.setSize ?? 1)) }} %. The target is outlined.</p>
          <div v-if="pictures.length" class="pics">
            <figure v-for="(src, pos) in pictures" :key="pos" class="pic" :class="{ target: pos === targetPos }"><img :src="src" :alt="`Picture ${pos + 1}${pos === targetPos ? ' (target)' : ''}`"></figure>
          </div>
        </template>
        <ul v-if="checks" class="grid gap-1 text-sm">
          <li v-for="[k, label] in CHECKS" :key="k" class="flex gap-1.5" :class="checks[k] ? 'text-success' : 'text-error'">
            <UIcon :name="checks[k] ? 'i-lucide-check' : 'i-lucide-x'" class="mt-0.5 size-4 shrink-0" /><span class="sr-only">{{ checks[k] ? 'passed' : 'failed' }}: </span>{{ label }}
          </li>
        </ul>
        <p class="num text-sm text-muted">Kp at lock: {{ trial.kpValid ? trial.kp.toFixed(2) : '–' }}, LST: {{ trial.lst >= 0 ? trial.lst.toFixed(2) + ' h' : '–' }}</p>
      </div>
    </template>

    <p v-if="error" class="text-sm text-error" role="alert">{{ error }}<template v-if="/safety/.test(error)">{{ ' ' }}<NuxtLink :to="safetyPath()" class="underline underline-offset-4">Safety page</NuxtLink></template></p>
  </div>
</template>

<style scoped>
.pics { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.65rem; }
.pic { margin: 0; border: 1px solid var(--line); border-radius: calc(var(--ui-radius) * 2); padding: 0.4rem; display: grid; gap: 0.4rem; align-content: start; }
.pic img { width: 100%; border-radius: var(--ui-radius); display: block; }
.pic.target { border-color: var(--ok); box-shadow: 0 0 0 2px var(--ok); }
</style>
