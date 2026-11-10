<script setup lang="ts">
// Blinded remote-viewing and telepathy trials. The helmet picks the set, the
// target and real/sham, and commits to them before you answer; this page walks
// one trial from describing to the reveal, and keeps the statistics.
import { downloadBlob } from '#core/lib/format.js'
import { device, call, start, helmetKey, errorMessage } from '~/lib/device'
import { presetById } from '~/lib/programs'
import {
  trialForm, isActive, listSets, usableSets, manifestHash, getSet, loadResponse, storeResponse, responseHash, verifyTrial, arvTrials, isArvTrial,
  type Trial, type TrialPage, type PictureSet, type TrialResponse, type TrialChecks, type ArvTrial,
} from '~/lib/trials'

useHead({ title: 'Trials' })
const { safetyPath } = useAppNav()
const confirm = useConfirm()

const sets = ref<PictureSet[]>([])
const trials = ref<Trial[]>([])
// ARV trials (Guides) rank "predicted outcome A", not a hit: they are judged and
// revealed from their run summary, and stay out of the hit statistics.
const arv = ref<ArvTrial[]>([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const current = ref<Trial | null>(null)
const cardEl = ref<HTMLElement>()
const response = ref<TrialResponse>({ trialId: 0, text: '', sketch: '' })
const ranks = ref<number[]>([])
const pictures = ref<string[]>([]) // object URLs in display order
const checks = ref<TrialChecks | null>(null) // reveal verification results

const { online } = useHelmetLink()
// The helmet the open trial is on (helmetKey()): its response is stored under it.
let openedOn = ''

const usable = computed(() => usableSets(sets.value))
const unfinished = computed(() => trials.value.find((t) => isActive(t) && !isArvTrial(arv.value, t)))

async function loadPool() {
  sets.value = await listSets()
}

async function loadTrials() {
  if (!online.value) return
  loading.value = true
  try {
    const all: Trial[] = []
    for (let offset = 0; ; offset += 10) {
      const page = await call<TrialPage>('trial.list', { offset, limit: 10 })
      all.push(...page.items)
      if (all.length >= page.total || page.items.length === 0) break
    }
    trials.value = all
    arv.value = await arvTrials().catch(() => [])
    const open = all.find((t) => isActive(t) && !isArvTrial(arv.value, t))
    if (open && !current.value) await openTrial(open)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadPool()
  await loadTrials()
})
// The helmet is (back) on: its trials, and the open one as the helmet has it
// now. A request whose answer got lost may have gone through, so the card must
// not go on showing what it was before.
watch(online, async (on) => {
  if (!on) return
  if (current.value && openedOn !== helmetKey()) close() // another helmet: not its trial
  const shown = current.value
  await loadTrials()
  if (shown && current.value?.id === shown.id) await reread()
})

async function reread() {
  const shown = current.value
  if (!shown || !online.value) return
  try {
    const t = await call<Trial>('trial.get', { id: shown.id })
    if (current.value?.id !== shown.id) return
    // The helmet's trial of that number is another one (its trials were erased).
    if (t.commitment !== shown.commitment) return close()
    if (t.state === shown.state && t.ranked === shown.ranked) return
    replace(t)
    error.value = ''
    if (t.ranks) ranks.value = [...t.ranks]
    else if (ranks.value.length !== (t.setSize ?? 0)) ranks.value = new Array<number>(t.setSize ?? 0).fill(0)
    if (t.set && !pictures.value.length) await loadPictures(t)
    if (t.state === 'revealed') await verify(t)
  } catch (e) {
    if (/not found/.test(errorMessage(e))) close()
  }
}

// ---------------------------------------------------------------- trial flow
// Runs a trial action; its error shows next to the trial's buttons.
async function run(fn: () => unknown) {
  error.value = ''
  busy.value = true
  try {
    await fn()
  } catch (e) {
    error.value = errorMessage(e)
    // No answer: the helmet may have done it all the same. Ask what the trial is now.
    if (['timeout', 'send'].includes((e as { code?: string }).code ?? '')) await reread()
  } finally {
    busy.value = false
  }
}

async function newTrial() {
  if (!usable.value.length) throw new Error('Add at least one set of 2–8 pictures to the picture pool first.')
  const preset = presetById(trialForm.presetId)
  let t: Trial
  try {
    // With a token: when the answer gets lost, the app finds the trial again instead of creating a second one.
    t = await start<Trial>('trial.new', {
      mode: trialForm.mode,
      manifestHash: await manifestHash(sets.value),
      sets: usable.value.map((s) => ({ id: s.id, size: s.images.length })),
      ...(preset ? { session: preset.doc, presetId: preset.doc.id } : {}),
      blind: trialForm.blind,
      fieldUT: device.info?.defaultFieldUT ?? 1,
    })
  } catch (e) {
    // The helmet refuses a field until the safety page is accepted; the form waits for the way back.
    if (/safety/.test(errorMessage(e))) navigateTo(safetyPath())
    throw e
  }
  trials.value.unshift(t)
  await pickTrial(t)
}

const dropPictures = () => {
  pictures.value.forEach((u) => URL.revokeObjectURL(u))
  pictures.value = []
}

let openSeq = 0
async function openTrial(t: Trial) {
  const seq = ++openSeq
  flushSave()
  error.value = ''
  checks.value = null
  // Load the stored response before showing the trial: the sketch pad reads it when it mounts.
  const helmet = helmetKey()
  const r = await loadResponse(t, helmet)
  if (seq !== openSeq) return
  openedOn = helmet
  response.value = r
  current.value = t
  ranks.value = t.ranks ? [...t.ranks] : new Array<number>(t.setSize ?? 0).fill(0)
  dropPictures()
  if (t.set) await loadPictures(t)
  if (seq === openSeq && t.state === 'revealed') await verify(t)
}

// Opens a trial and scrolls to it (the card sits above the list).
async function pickTrial(t: Trial) {
  await openTrial(t)
  await nextTick()
  cardEl.value?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
}

function resume() {
  const t = unfinished.value
  if (t) run(() => pickTrial(t))
}

function close() {
  flushSave()
  error.value = ''
  current.value = null
}

function replace(t: Trial) {
  const i = trials.value.findIndex((x) => x.id === t.id)
  if (i >= 0) trials.value[i] = t
  current.value = t
}

// The response is saved on this phone 300 ms after the last change.
let saveTimer = 0
let pendingSave: { r: TrialResponse, helmet: string } | null = null
function saveResponse() {
  if (!current.value) return
  clearTimeout(saveTimer)
  pendingSave = { r: { ...response.value, trialId: current.value.id }, helmet: openedOn }
  saveTimer = window.setTimeout(flushSave, 300)
}
function flushSave() {
  clearTimeout(saveTimer)
  if (pendingSave) storeResponse(pendingSave.r, pendingSave.helmet)
  pendingSave = null
}
watch(() => response.value.text, saveResponse)
function setSketch(dataUrl: string) {
  response.value.sketch = dataUrl
  saveResponse()
}

async function lock() {
  const t = current.value!
  if (!response.value.text.trim() && !response.value.sketch) {
    error.value = 'Write or sketch your impressions first.'
    return
  }
  await storeResponse({ ...response.value, trialId: t.id }, openedOn)
  replace(await call<Trial>('trial.lock', { id: t.id, responseHash: await responseHash(t.id, response.value) }))
}

async function loadPictures(t: Trial) {
  const set = await getSet(t.set!)
  if (current.value?.id !== t.id) return // another trial was opened meanwhile
  if (!set || set.images.length !== t.setSize) {
    error.value = `Set "${t.set}" is missing or changed on this device; judging needs the same pool that started the trial.`
    return
  }
  dropPictures()
  pictures.value = t.order!.map((i) => URL.createObjectURL(set.images[i]!.blob))
}

async function judge() {
  const t = await call<Trial>('trial.judge', { id: current.value!.id })
  replace(t)
  ranks.value = new Array<number>(t.setSize ?? 0).fill(0)
  await loadPictures(t)
}

async function submitRanks() {
  const r = ranks.value.map(Number)
  if (r.includes(0) || new Set(r).size !== r.length) {
    error.value = 'Give every picture a different rank.'
    return
  }
  replace(await call<Trial>('trial.ranks', { id: current.value!.id, ranks: r }))
}

async function reveal() {
  const t = await call<Trial>('trial.reveal', { id: current.value!.id })
  replace(t)
  await verify(t)
}

async function verify(t: Trial) {
  const c = await verifyTrial(t, sets.value, response.value)
  if (current.value?.id === t.id) checks.value = c
}

async function abort() {
  const id = current.value!.id
  const yes = await confirm({
    title: `Abort trial #${id}?`,
    description: 'It stays in the list as aborted, is not scored and cannot be resumed.',
    confirmLabel: 'Abort trial',
    cancelLabel: 'Keep it',
    danger: true,
  })
  if (!yes) return
  await call('trial.abort', { id })
  // Mark it locally so the "not finished" note does not flash before the list reloads.
  const i = trials.value.findIndex((x) => x.id === id)
  if (i >= 0) trials.value[i] = { ...trials.value[i]!, state: 'aborted' }
  current.value = null
  await loadTrials()
}

function exportTrials() {
  // ARV trials are marked so tools/trial_stats.py can leave them out of the hit statistics.
  const list = trials.value.map((t) => (isArvTrial(arv.value, t) ? { ...t, arv: true } : t))
  downloadBlob(new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' }), 'godhelmet-trials.json')
}

onBeforeUnmount(() => {
  flushSave()
  dropPictures()
})
</script>

<template>
  <div class="grid grid-cols-1 gap-5">
    <header class="grid grid-cols-1 gap-2">
      <p class="text-sm font-semibold text-muted">Blinded trials</p>
      <h2 class="text-2xl">Remote viewing &amp; telepathy</h2>
      <p class="measure text-sm text-muted">The helmet picks the picture set, the target and real/sham with its hardware random generator, and publishes a SHA-256 commitment before you answer. Your response is hashed when you lock it. After you rank all pictures, the reveal shows everything, and the app checks that nothing was changed.</p>
      <AppConnect v-if="!device.kind" class="mt-1" />
    </header>

    <div v-if="current" ref="cardEl" class="scroll-mt-[calc(var(--header-h,3.75rem)+1rem)]">
      <TrialCard v-model:text="response.text" v-model:ranks="ranks" :trial="current" :sketch="response.sketch" :response-loaded="response.trialId === current.id"
        :pictures="pictures" :checks="checks" :busy="busy" :error="error"
        @close="close" @sketch="setSketch" @lock="run(lock)" @abort="run(abort)" @judge="run(judge)" @submit-ranks="run(submitRanks)" @reveal="run(reveal)" />
    </div>
    <TrialNewForm v-else :usable-count="usable.length" :unfinished="unfinished" :busy="busy" :error="error" @create="run(newTrial)" @resume="resume" />

    <TrialResults :trials="trials" :arv="arv" :loading="loading" :current-id="current?.id" @pick="(t) => run(() => pickTrial(t))" @export="exportTrials" />
    <TrialSender :sets="sets" />
  </div>
</template>
