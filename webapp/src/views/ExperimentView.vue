<script>
// The new-trial form lives at module level, so it survives the remount on a
// tab change (e.g. the detour to the safety page) and the trial starts as chosen.
import { ref as moduleRef } from 'vue'
const form = { mode: moduleRef('rv'), presetId: moduleRef('remote-viewing'), blind: moduleRef(true) }
</script>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { device, call, connect } from '../ble/device.js'
import { presetById, groupedPresets } from '../lib/presets.js'
import { listSets, usableSets, manifestHash, getSet } from '../lib/pool.js'
import { idb } from '../lib/idb.js'
import { sha256Hex } from '../lib/crypto.js'
import { summarise } from '../lib/stats.js'
import { arvTrials, isArvTrial } from '../lib/runs.js'
import { fmtDate, downloadBlob } from '../lib/format.js'
import { goSafety } from '../lib/nav.js'
import SketchPad from '../components/SketchPad.vue'

const sets = ref([])
const trials = ref([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const current = ref(null)
const trialCard = ref(null)
const response = ref({ text: '', sketch: '' })
const ranks = ref([])
const pictures = ref([])  // object URLs in display order
const checks = ref(null)  // reveal verification results

const { mode, presetId, blind } = form
// Presets that can run during a trial, by category, remote viewing & telepathy first.
const psiGroups = groupedPresets()
  .map((g) => ({ ...g, items: g.items.filter((p) => p.session) }))
  .filter((g) => g.items.length)
  .sort((a, b) => (b.key === 'psi') - (a.key === 'psi'))
const presetName = computed(() => presetById(presetId.value)?.doc.name ?? '')

const usable = computed(() => usableSets(sets.value))
const ACTIVE = ['open', 'locked', 'judging']

async function loadPool() {
  sets.value = await listSets()
}

async function loadTrials() {
  if (!device.kind) return
  loading.value = true
  try {
    const all = []
    for (let offset = 0; ; offset += 10) {
      const page = await call('trial.list', { offset, limit: 10 })
      all.push(...page.items)
      if (all.length >= page.total || page.items.length === 0) break
    }
    trials.value = all
    arv.value = await arvTrials().catch(() => [])
    // ARV trials (Guides) are judged and revealed from their run summary, not here.
    const open = all.find((t) => ACTIVE.includes(t.state) && !isArvTrial(arv.value, t))
    if (open && !current.value) await openTrial(open)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadPool()
  await loadTrials()
})
watch(() => device.kind, loadTrials)

// ARV trials rank "predicted outcome A", not a hit, so they stay out of the hit statistics.
const arv = ref([])
const arvCount = computed(() => trials.value.filter((t) => isArvTrial(arv.value, t)).length)
const unfinished = computed(() => trials.value.find((t) => ACTIVE.includes(t.state) && !isArvTrial(arv.value, t)))
const stats = computed(() => {
  const revealed = trials.value.filter((t) => t.state === 'revealed' && !isArvTrial(arv.value, t))
  return [
    ['All revealed', revealed],
    ['Active field', revealed.filter((t) => t.condition === 'active')],
    ['Sham', revealed.filter((t) => t.condition === 'sham')],
    ['No stimulation', revealed.filter((t) => t.condition === 'none')],
  ].map(([label, list]) => ({ label, s: summarise(list) })).filter((r) => r.s)
})
const overview = computed(() => {
  const s = stats.value[0]?.s
  if (!s) return null
  return { s, verdict: s.pHits < 0.05 ? 'That is more than chance usually gives (p < 0.05).' : 'That is still within what chance alone gives.' }
})

// ---------------------------------------------------------------- trial flow
// Runs a trial action; its error shows next to the trial's buttons.
async function run(fn) {
  error.value = ''
  busy.value = true
  try {
    await fn()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function newTrial() {
  if (!usable.value.length) throw new Error('Add at least one set of 2–8 pictures in Targets first.')
  const preset = presetById(presetId.value)
  let t
  try {
    t = await call('trial.new', {
      mode: mode.value,
      manifestHash: await manifestHash(sets.value),
      sets: usable.value.map((s) => ({ id: s.id, size: s.images.length })),
      ...(preset ? { session: preset.doc, presetId: preset.doc.id } : {}),
      blind: blind.value,
      fieldUT: device.info?.defaultFieldUT ?? 1,
    })
  } catch (e) {
    if (/safety/.test(e.message)) goSafety('experiment')
    throw e
  }
  trials.value.unshift(t)
  await pickTrial(t)
}

let openSeq = 0
async function openTrial(t) {
  const seq = ++openSeq
  flushSave()
  error.value = ''
  checks.value = null
  // Load the stored response before showing the trial: the sketch pad reads it when it mounts.
  const r = (await idb.get('responses', t.id)) ?? { trialId: t.id, text: '', sketch: '' }
  if (seq !== openSeq) return
  response.value = r
  current.value = t
  ranks.value = t.ranks ? [...t.ranks] : new Array(t.setSize ?? 0).fill(0)
  pictures.value.forEach(URL.revokeObjectURL)
  pictures.value = []
  if (t.set) await loadPictures(t)
  if (seq === openSeq && t.state === 'revealed') await verify(t)
}

// Opens a trial and scrolls to it (the card sits above the list).
async function pickTrial(t) {
  await openTrial(t)
  await nextTick()
  trialCard.value?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
}

function close() {
  flushSave()
  error.value = ''
  current.value = null
}

function replace(t) {
  const i = trials.value.findIndex((x) => x.id === t.id)
  if (i >= 0) trials.value[i] = t
  current.value = t
}

let saveTimer = 0
let pendingSave = null
function saveResponse() {
  if (!current.value) return
  clearTimeout(saveTimer)
  pendingSave = { ...response.value, trialId: current.value.id }
  saveTimer = setTimeout(flushSave, 300)
}
function flushSave() {
  clearTimeout(saveTimer)
  if (pendingSave) idb.put('responses', pendingSave)
  pendingSave = null
}
watch(() => response.value.text, saveResponse)

const responseHash = (t) => sha256Hex(JSON.stringify({ trialId: t.id, text: response.value.text, sketch: response.value.sketch }))

async function lock() {
  if (!response.value.text.trim() && !response.value.sketch) return (error.value = 'Write or sketch your impressions first.')
  await idb.put('responses', { ...response.value, trialId: current.value.id })
  replace(await call('trial.lock', { id: current.value.id, responseHash: await responseHash(current.value) }))
}

async function loadPictures(t) {
  const set = await getSet(t.set)
  if (current.value?.id !== t.id) return  // another trial was opened meanwhile
  if (!set || set.images.length !== t.setSize) {
    error.value = `Set "${t.set}" is missing or changed on this device; judging needs the same pool that started the trial.`
    return
  }
  pictures.value = t.order.map((i) => URL.createObjectURL(set.images[i].blob))
}

async function judge() {
  const t = await call('trial.judge', { id: current.value.id })
  replace(t)
  ranks.value = new Array(t.setSize).fill(0)
  await loadPictures(t)
}

async function submitRanks() {
  const r = ranks.value.map(Number)
  if (r.includes(0) || new Set(r).size !== r.length) return (error.value = 'Give every picture a different rank.')
  replace(await call('trial.ranks', { id: current.value.id, ranks: r }))
}

async function reveal() {
  const t = await call('trial.reveal', { id: current.value.id })
  replace(t)
  await verify(t)
}

async function verify(t) {
  const c = {
    commitment: (await sha256Hex(t.preimage)) === t.commitment,
    pool: (await manifestHash(sets.value)) === t.manifestHash,
    response: (await responseHash(t)) === t.responseHash,
  }
  if (current.value?.id === t.id) checks.value = c
}

async function abort() {
  if (!confirm(`Abort trial #${current.value.id}? It stays in the list as aborted, is not scored and cannot be resumed.`)) return
  const id = current.value.id
  await call('trial.abort', { id })
  // Mark it locally so the "not finished" note does not flash before the list reloads.
  const i = trials.value.findIndex((x) => x.id === id)
  if (i >= 0) trials.value[i] = { ...trials.value[i], state: 'aborted' }
  current.value = null
  await loadTrials()
}

const targetPos = computed(() => (current.value?.state === 'revealed' ? current.value.order.indexOf(current.value.target) : -1))

// Where the open trial is in the flow: 0 describe, 1 rank, 2 reveal, 3 done.
const STEPS = ['Describe', 'Rank', 'Reveal']
const step = computed(() => {
  const t = current.value
  return t ? ({ open: 0, locked: 1, judging: t.ranked ? 2 : 1, revealed: 3 }[t.state] ?? -1) : -1
})

function exportTrials() {
  // ARV trials are marked so tools/trial_stats.py can leave them out of the hit statistics.
  const list = trials.value.map((t) => (isArvTrial(arv.value, t) ? { ...t, arv: true } : t))
  downloadBlob(new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' }), 'godhelmet-trials.json')
}

// ---------------------------------------------------------------- telepathy sender
const senderId = ref('')
const senderPicture = ref('')
const senderError = ref('')
async function showSender() {
  senderError.value = ''
  hideSender()
  if (!senderId.value) return (senderError.value = 'Enter the trial number first.')
  try {
    const s = await call('trial.sender', { id: Number(senderId.value) })
    const set = await getSet(s.set)
    if (!set) throw new Error(`Set "${s.set}" is not on this device: import the same pool file first.`)
    if ((await manifestHash(sets.value)) !== s.manifestHash) throw new Error('This device has a different pool than the receiver; import the same pool file.')
    senderPicture.value = URL.createObjectURL(set.images[s.target].blob)
  } catch (e) {
    senderError.value = e.message
  }
}
function hideSender() {
  if (senderPicture.value) URL.revokeObjectURL(senderPicture.value)
  senderPicture.value = ''
}
</script>

<template>
  <div class="page">
    <header class="card">
      <span class="eyebrow">Blinded trials</span>
      <h2>Remote viewing &amp; telepathy</h2>
      <p class="small">The helmet picks the picture set, the target and real/sham with its hardware random generator, and publishes a SHA-256 commitment before you answer. Your response is hashed when you lock it. After you rank all pictures, the reveal shows everything, and the app checks that nothing was changed.</p>
      <p v-if="!device.kind" class="row">
        <button class="btn primary" :disabled="!device.bluetooth" @click="connect('ble')">Connect helmet</button>
        <button class="btn" @click="connect('demo')">Try the demo</button>
      </p>
    </header>

    <section v-if="current" ref="trialCard" class="card trial-card">
      <div class="row" style="justify-content: space-between">
        <h2>Trial #{{ current.id }} · {{ current.mode === 'rv' ? 'remote viewing' : 'telepathy' }}</h2>
        <div class="row">
          <span class="chip on">{{ current.state }}{{ current.blind ? ' · blind' : '' }}</span>
          <button class="btn ghost sm" @click="close">{{ ACTIVE.includes(current.state) ? 'Close for now' : 'Close' }}</button>
        </div>
      </div>
      <ol v-if="step >= 0" class="steps" aria-label="Trial steps">
        <li v-for="(s, i) in STEPS" :key="s" class="chip" :class="{ on: i === step, done: i < step }" :aria-current="i === step ? 'step' : null">{{ i < step ? '✓' : i + 1 }} {{ s }}</li>
      </ol>
      <p v-if="!device.kind && ACTIVE.includes(current.state)" class="small warn">Helmet disconnected. Reconnect it to continue this trial.{{ current.state === 'open' ? ' Your response is saved on this phone.' : '' }}</p>
      <div class="small"><span class="muted">Stimulation:</span> {{ current.presetName || 'none' }} · <span class="muted">Sets offered:</span> {{ current.setCount }}</div>
      <div class="small muted">Commitment</div>
      <div class="mono">{{ current.commitment }}</div>
      <p v-if="current.mode === 'telepathy' && current.state === 'open'" class="small warn">
        Sender: on a second phone with the same pool imported, open this app, connect to the helmet, Experiment → Sender, trial {{ current.id }}. The receiver must not see that screen.
      </p>

      <template v-if="current.state === 'open'">
        <h3>Your impressions</h3>
        <p class="muted small">First impressions: shapes, colours, textures, temperature, feelings. Avoid naming things. Saved on this phone as you type.</p>
        <textarea v-model="response.text" aria-label="Your impressions"></textarea>
        <SketchPad v-if="response.trialId === current.id" :key="current.id" label="Sketch (optional)" :initial="response.sketch" @change="(d) => { response.sketch = d; saveResponse() }" />
        <div class="row">
          <button class="btn primary" :disabled="busy || !device.kind" @click="run(lock)">Lock response</button>
          <button class="btn ghost danger push" :disabled="busy || !device.kind" @click="run(abort)">Abort trial</button>
        </div>
      </template>

      <template v-else>
        <h3>Response (locked {{ fmtDate(current.lockedAt) }})</h3>
        <p class="small" style="white-space: pre-wrap">{{ response.text || '(no text)' }}</p>
        <img v-if="response.sketch" :src="response.sketch" class="sketch" alt="Your sketch" />
      </template>

      <div v-if="current.state === 'locked'" class="row">
        <button class="btn primary" :disabled="busy || !device.kind" @click="run(judge)">Show the pictures and rank them</button>
        <button class="btn ghost danger push" :disabled="busy || !device.kind" @click="run(abort)">Abort trial</button>
      </div>

      <template v-if="['judging', 'revealed'].includes(current.state) && pictures.length">
        <h3>{{ current.state === 'revealed' ? 'Your ranking' : 'Rank every picture: 1 = best match to your response' }}</h3>
        <div class="pics">
          <figure v-for="(src, pos) in pictures" :key="pos" class="pic" :class="{ target: pos === targetPos }">
            <figcaption v-if="pos === targetPos" class="chip on">Target</figcaption>
            <img :src="src" :alt="`Picture ${pos + 1}`" />
            <select v-model.number="ranks[pos]" :disabled="current.ranked" :aria-label="`Rank for picture ${pos + 1}`">
              <option :value="0">rank…</option>
              <option v-for="r in current.setSize" :key="r" :value="r">{{ r }}{{ r === 1 ? ' (best)' : '' }}</option>
            </select>
          </figure>
        </div>
        <div v-if="current.state !== 'revealed'" class="row">
          <button v-if="!current.ranked" class="btn primary" :disabled="busy || !device.kind" @click="run(submitRanks)">Submit ranks</button>
          <button v-else class="btn primary" :disabled="busy || !device.kind" @click="run(reveal)">Reveal</button>
        </div>
      </template>
      <!-- Until the ranks are in, a judging trial can still be abandoned (e.g. its pictures are gone). -->
      <div v-if="current.state === 'judging' && !current.ranked" class="row">
        <button class="btn ghost danger push" :disabled="busy || !device.kind" @click="run(abort)">Abort trial</button>
      </div>

      <div v-if="current.state === 'revealed'" class="reveal">
        <div class="big num" :class="current.targetRank === 1 ? 'ok' : ''">{{ current.targetRank === 1 ? 'Hit' : `Rank ${current.targetRank} of ${current.setSize}` }}</div>
        <p class="small">The target is marked “Target”. Condition: <b>{{ current.condition }}</b>. Chance of a first-place hit: {{ Math.round(100 / current.setSize) }} %.</p>
        <ul v-if="checks" class="small checks">
          <li :class="checks.commitment ? 'ok' : 'bad'">{{ checks.commitment ? '✓' : '✗' }} Commitment matches the revealed choice</li>
          <li :class="checks.pool ? 'ok' : 'bad'">{{ checks.pool ? '✓' : '✗' }} Picture pool unchanged since the trial started</li>
          <li :class="checks.response ? 'ok' : 'bad'">{{ checks.response ? '✓' : '✗' }} Your response unchanged since locking</li>
        </ul>
        <p class="small muted">Kp at lock: {{ current.kpValid ? current.kp.toFixed(2) : '–' }} · LST: {{ current.lst >= 0 ? current.lst.toFixed(2) + ' h' : '–' }}</p>
        <div class="mono muted">{{ current.preimage }}</div>
      </div>
      <p v-if="error" class="bad small" role="alert">{{ error }}</p>
    </section>

    <section v-if="!current" class="card">
      <h2>New trial</h2>
      <p v-if="unfinished" class="small warn">Trial #{{ unfinished.id }} is not finished yet. <button class="linkbtn" @click="run(() => pickTrial(unfinished))">Resume it</button>, or abort it before you start another.</p>
      <div class="grid2">
        <label class="field">Mode
          <select v-model="mode">
            <option value="rv">Remote viewing</option>
            <option value="telepathy">Telepathy (with a sender)</option>
          </select>
          <span class="small muted">{{ mode === 'rv' ? 'You describe a hidden picture.' : 'A sender looks at the picture on another phone while you describe it.' }}</span>
        </label>
        <label class="field">Stimulation during the trial
          <select v-model="presetId">
            <option value="">None</option>
            <optgroup v-for="g in psiGroups" :key="g.key" :label="g.label">
              <option v-for="p in g.items" :key="p.doc.id" :value="p.doc.id">{{ p.doc.name }}</option>
            </optgroup>
          </select>
          <span v-if="presetName" class="small muted full-name">{{ presetName }}</span>
        </label>
      </div>
      <label class="check" :class="{ muted: !presetId }">
        <input type="checkbox" :checked="blind && !!presetId" :disabled="!presetId" @change="blind = $event.target.checked" />
        <span>Blind real/sham (recommended)<span v-if="!presetId" class="small">: only with stimulation</span></span>
      </label>
      <p v-if="presetId && device.info && !device.info.safetyAccepted" class="small warn">Stimulation needs the <a href="#safety/experiment">safety page</a> accepted first. Accept it, or choose Stimulation: None.</p>
      <p v-if="!usable.length" class="small warn">No usable picture sets yet. <a href="#targets">Add a set of 2–8 pictures in Targets</a>, then come back.</p>
      <p v-else class="small muted">Pool: {{ usable.length }} usable set(s) (<a href="#targets">Targets</a>). Ideally someone else builds it. Decide the number of trials in advance and count every trial.</p>
      <div class="row"><button class="btn primary" :disabled="busy || !device.kind || !usable.length || !!unfinished" @click="run(newTrial)">{{ busy ? 'Creating…' : 'Create trial' }}</button></div>
      <p v-if="error" class="bad small" role="alert">{{ error }}</p>
    </section>

    <section class="card">
      <h2>Results</h2>
      <p v-if="overview" class="small"><b>{{ overview.s.hits }} first-place hit(s) in {{ overview.s.n }} revealed trial(s).</b> Chance alone would give about {{ overview.s.expected.toFixed(1) }}. {{ overview.verdict }}</p>
      <div v-if="stats.length" class="table-wrap">
        <table class="stats">
          <thead>
            <tr>
              <th></th><th>N</th><th title="Trials where the target got rank 1, with the number chance would give">Hits</th>
              <th title="Chance of at least this many hits if the target is just guessed">p</th><th>Mean rank</th>
              <th title="How much better than average the target was ranked, in standard deviations; with its p-value">Rank z</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in stats" :key="r.label">
              <td>{{ r.label }}</td><td class="num">{{ r.s.n }}</td><td class="num">{{ r.s.hits }}<br /><span class="muted small">exp. {{ r.s.expected.toFixed(1) }}</span></td>
              <td class="num">{{ r.s.pHits.toFixed(3) }}</td><td class="num">{{ r.s.meanRank.toFixed(2) }}</td><td class="num">{{ r.s.z.toFixed(2) }}<br /><span class="muted small">p {{ r.s.pZ.toFixed(3) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="muted small">No revealed trials yet.</p>
      <p v-if="arvCount" class="muted small">{{ arvCount }} associative remote-viewing trial(s) from Guides are left out: their result is scored in the guide's run summary.</p>
      <p class="muted small">One-sided p-values against chance. With 30 trials at 5 pictures, chance gives about 6 hits; about 11 are needed for p &lt; 0.05. A real effect of the field shows as active better than sham.</p>
      <template v-if="trials.length">
        <p class="muted small">Tap a row to open that trial.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>When</th><th class="wide-only">Mode</th><th>State</th><th>Condition</th><th>Rank</th></tr></thead>
            <tbody>
              <tr v-for="t in trials" :key="t.id" class="clickable" :class="{ active: current?.id === t.id }" tabindex="0" @click="run(() => pickTrial(t))" @keydown.enter="run(() => pickTrial(t))">
                <td class="num">{{ t.id }}</td><td>{{ fmtDate(t.created) }}</td><td class="wide-only">{{ t.mode }}</td><td>{{ t.state }}</td><td>{{ t.condition }}</td>
                <td class="num">{{ t.state === 'revealed' ? `${t.targetRank}/${t.setSize}` : '–' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <p v-if="loading" class="muted small">Loading trials…</p>
      <div v-if="trials.length" class="row"><button class="btn sm" @click="exportTrials">Export trials (for tools/trial_stats.py)</button></div>
    </section>

    <section class="card">
      <details>
        <summary><h2>Sender</h2> <span class="small muted">telepathy only, on a second phone</span></summary>
        <div class="stack sender-body">
          <p class="small muted">For telepathy trials, on the sender's phone (same pool imported, connected to the helmet as a second app). The receiver must not see this screen.</p>
          <div class="row">
            <input v-model="senderId" type="number" min="1" placeholder="Trial number" aria-label="Trial number" style="max-width: 160px" />
            <button class="btn" :disabled="!device.kind || !senderId" @click="showSender">Show the target</button>
            <button v-if="senderPicture" class="btn ghost sm" @click="hideSender">Hide picture</button>
          </div>
          <p v-if="senderError" class="bad small" role="alert">{{ senderError }}</p>
          <img v-if="senderPicture" :src="senderPicture" class="sender" alt="Target picture for the sender" />
        </div>
      </details>
    </section>
  </div>
</template>

<style scoped>
.trial-card { scroll-margin-top: 110px; }
.grid2 > .field { align-content: start; }
.steps { list-style: none; margin: 0; padding: 0; display: flex; gap: 6px; flex-wrap: wrap; }
.steps .done { color: var(--ok); border-color: var(--ok); }
.push { margin-left: auto; }
.pics { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.pic { margin: 0; border: 1px solid var(--line); border-radius: 8px; padding: 6px; display: grid; gap: 6px; position: relative; }
.pic img { width: 100%; border-radius: 6px; display: block; }
.pic.target { border-color: var(--ok); box-shadow: 0 0 0 2px var(--ok); }
/* Sits on the picture so the target lines up with the others. */
.pic figcaption { position: absolute; top: 12px; left: 12px; }
.sketch { max-width: 240px; border-radius: 6px; filter: invert(.9); }
:root[data-theme="night"] .sketch { filter: invert(1) sepia(1) saturate(6) hue-rotate(-55deg) brightness(.6); }
:root[data-theme="light"] .sketch { filter: none; }
@media (prefers-color-scheme: light) { :root:not([data-theme]) .sketch { filter: none; } }
.big { font-size: 40px; line-height: 1.1; }
.reveal { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
.checks { margin: 0; padding-left: 0; list-style: none; display: grid; gap: 2px; }
.stats td.num { white-space: nowrap; }
tr.active td { background: var(--accent-soft); }
summary { cursor: pointer; }
summary h2 { display: inline; margin-right: 6px; }
.sender-body { margin-top: 12px; }
.sender { max-width: 100%; border-radius: 8px; }
@media (min-width: 601px) { .full-name { display: none; } }
@media (max-width: 600px) { .wide-only { display: none; } th, td { padding-inline: 6px; } }
</style>
