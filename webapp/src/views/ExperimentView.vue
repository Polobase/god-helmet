<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { device, call, connect } from '../ble/device.js'
import { presets, presetById } from '../lib/presets.js'
import { listSets, usableSets, manifestHash, getSet } from '../lib/pool.js'
import { idb } from '../lib/idb.js'
import { sha256Hex } from '../lib/crypto.js'
import { summarise } from '../lib/stats.js'
import { arvTrials, isArvTrial } from '../lib/runs.js'
import { fmtDate, downloadBlob } from '../lib/format.js'
import { go } from '../lib/nav.js'
import SketchPad from '../components/SketchPad.vue'

const sets = ref([])
const trials = ref([])
const loading = ref(false)
const error = ref('')
const current = ref(null)
const response = ref({ text: '', sketch: '' })
const ranks = ref([])
const pictures = ref([])  // object URLs in display order
const checks = ref(null)  // reveal verification results

const mode = ref('rv')
const presetId = ref('remote-viewing')
const blind = ref(true)
const psiPresets = presets.filter((p) => p.session)

const usable = computed(() => usableSets(sets.value))

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
    const open = all.find((t) => ['open', 'locked', 'judging'].includes(t.state) && !isArvTrial(arv.value, t))
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
const stats = computed(() => {
  const revealed = trials.value.filter((t) => t.state === 'revealed' && !isArvTrial(arv.value, t))
  return [
    ['All revealed', revealed],
    ['Active field', revealed.filter((t) => t.condition === 'active')],
    ['Sham', revealed.filter((t) => t.condition === 'sham')],
    ['No stimulation', revealed.filter((t) => t.condition === 'none')],
  ].map(([label, list]) => ({ label, s: summarise(list) })).filter((r) => r.s)
})

// ---------------------------------------------------------------- trial flow
async function newTrial() {
  error.value = ''
  try {
    if (!usable.value.length) throw new Error('Add at least one set of 2–8 pictures in Targets first.')
    const preset = presetById(presetId.value)
    const t = await call('trial.new', {
      mode: mode.value,
      manifestHash: await manifestHash(sets.value),
      sets: usable.value.map((s) => ({ id: s.id, size: s.images.length })),
      ...(preset ? { session: preset.doc, presetId: preset.doc.id } : {}),
      blind: blind.value,
      fieldUT: device.info?.defaultFieldUT ?? 1,
    })
    trials.value.unshift(t)
    await openTrial(t)
  } catch (e) {
    error.value = e.message
    if (/safety/.test(e.message)) go('safety')
  }
}

async function openTrial(t) {
  checks.value = null
  current.value = t
  response.value = (await idb.get('responses', t.id)) ?? { trialId: t.id, text: '', sketch: '' }
  ranks.value = t.ranks ? [...t.ranks] : new Array(t.setSize ?? 0).fill(0)
  pictures.value.forEach(URL.revokeObjectURL)
  pictures.value = []
  if (t.set) await loadPictures(t)
  if (t.state === 'revealed') await verify(t)
}

function replace(t) {
  const i = trials.value.findIndex((x) => x.id === t.id)
  if (i >= 0) trials.value[i] = t
  current.value = t
}

let saveTimer = 0
function saveResponse() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => idb.put('responses', { ...response.value, trialId: current.value.id }), 300)
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
  checks.value = {
    commitment: (await sha256Hex(t.preimage)) === t.commitment,
    pool: (await manifestHash(sets.value)) === t.manifestHash,
    response: (await responseHash(t)) === t.responseHash,
  }
}

async function abort() {
  await call('trial.abort', { id: current.value.id })
  current.value = null
  await loadTrials()
}

const targetPos = computed(() => (current.value?.state === 'revealed' ? current.value.order.indexOf(current.value.target) : -1))

function exportTrials() {
  downloadBlob(new Blob([JSON.stringify(trials.value, null, 2)], { type: 'application/json' }), 'godhelmet-trials.json')
}

// ---------------------------------------------------------------- telepathy sender
const senderId = ref('')
const senderPicture = ref('')
async function showSender() {
  error.value = ''
  try {
    const s = await call('trial.sender', { id: Number(senderId.value) })
    const set = await getSet(s.set)
    if (!set) throw new Error(`Set "${s.set}" is not on this device: import the same pool file first.`)
    if ((await manifestHash(sets.value)) !== s.manifestHash) throw new Error('This device has a different pool than the receiver; import the same pool file.')
    senderPicture.value = URL.createObjectURL(set.images[s.target].blob)
  } catch (e) {
    error.value = e.message
  }
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

    <p v-if="error" class="card bad small">{{ error }}</p>

    <section v-if="current" class="card">
      <div class="row" style="justify-content: space-between">
        <h2>Trial #{{ current.id }} · {{ current.mode === 'rv' ? 'remote viewing' : 'telepathy' }}</h2>
        <span class="chip on">{{ current.state }}{{ current.blind ? ' · blind' : '' }}</span>
      </div>
      <div class="small"><span class="muted">Stimulation:</span> {{ current.presetName || 'none' }} · <span class="muted">Sets offered:</span> {{ current.setCount }}</div>
      <div class="small muted">Commitment</div>
      <div class="mono">{{ current.commitment }}</div>
      <p v-if="current.mode === 'telepathy' && current.state === 'open'" class="small warn">
        Sender: on a second phone with the same pool imported, open this app, connect to the helmet, Experiment → Sender, trial {{ current.id }}. The receiver must not see that screen.
      </p>

      <template v-if="current.state === 'open'">
        <h3>Your impressions</h3>
        <p class="muted small">First impressions: shapes, colours, textures, temperature, feelings. Avoid naming things. Saved on this phone as you type.</p>
        <textarea v-model="response.text"></textarea>
        <SketchPad :key="current.id" :initial="response.sketch" @change="(d) => { response.sketch = d; saveResponse() }" />
        <div class="row">
          <button class="btn primary" @click="lock">Lock response</button>
          <button class="btn ghost" @click="abort">Abort trial</button>
        </div>
      </template>

      <template v-else>
        <h3>Response (locked {{ fmtDate(current.lockedAt) }})</h3>
        <p class="small" style="white-space: pre-wrap">{{ response.text || '(no text)' }}</p>
        <img v-if="response.sketch" :src="response.sketch" class="sketch" alt="Your sketch" />
      </template>

      <div v-if="current.state === 'locked'" class="row">
        <button class="btn primary" @click="judge">Show the pictures and rank them</button>
        <button class="btn ghost" @click="abort">Abort trial</button>
      </div>

      <template v-if="['judging', 'revealed'].includes(current.state) && pictures.length">
        <h3>Rank every picture: 1 = best match to your response</h3>
        <div class="pics">
          <figure v-for="(src, pos) in pictures" :key="pos" class="pic" :class="{ target: pos === targetPos }">
            <img :src="src" :alt="`Picture ${pos + 1}`" />
            <select v-model.number="ranks[pos]" :disabled="current.ranked">
              <option :value="0">rank…</option>
              <option v-for="r in current.setSize" :key="r" :value="r">{{ r }}{{ r === 1 ? ' (best)' : '' }}</option>
            </select>
          </figure>
        </div>
        <div class="row">
          <button v-if="!current.ranked" class="btn primary" @click="submitRanks">Submit ranks</button>
          <button v-if="current.ranked && current.state !== 'revealed'" class="btn primary" @click="reveal">Reveal</button>
        </div>
      </template>

      <div v-if="current.state === 'revealed'" class="reveal">
        <div class="big num" :class="current.targetRank === 1 ? 'ok' : ''">{{ current.targetRank === 1 ? 'Hit' : `Rank ${current.targetRank} of ${current.setSize}` }}</div>
        <p class="small">The target is outlined. Condition: <b>{{ current.condition }}</b>. Chance of a first-place hit: {{ Math.round(100 / current.setSize) }} %.</p>
        <ul v-if="checks" class="small checks">
          <li :class="checks.commitment ? 'ok' : 'bad'">{{ checks.commitment ? '✓' : '✗' }} Commitment matches the revealed choice</li>
          <li :class="checks.pool ? 'ok' : 'bad'">{{ checks.pool ? '✓' : '✗' }} Picture pool unchanged since the trial started</li>
          <li :class="checks.response ? 'ok' : 'bad'">{{ checks.response ? '✓' : '✗' }} Your response unchanged since locking</li>
        </ul>
        <p class="small muted">Kp at lock: {{ current.kpValid ? current.kp.toFixed(2) : '–' }} · LST: {{ current.lst >= 0 ? current.lst.toFixed(2) + ' h' : '–' }}</p>
        <div class="mono muted">{{ current.preimage }}</div>
      </div>
      <button class="btn ghost sm" @click="current = null">Close</button>
    </section>

    <section v-if="!current" class="card">
      <h2>New trial</h2>
      <div class="grid2">
        <label class="field">Mode
          <select v-model="mode">
            <option value="rv">Remote viewing: you describe the hidden picture</option>
            <option value="telepathy">Telepathy: a sender looks at it on another phone</option>
          </select>
        </label>
        <label class="field">Stimulation during the trial
          <select v-model="presetId">
            <option value="">None</option>
            <option v-for="p in psiPresets" :key="p.doc.id" :value="p.doc.id">{{ p.doc.name }}</option>
          </select>
        </label>
      </div>
      <label class="check"><input v-model="blind" type="checkbox" :disabled="!presetId" /> Blind real/sham (recommended)</label>
      <p class="small muted">Pool: {{ usable.length }} usable set(s). Ideally someone else builds it (Targets tab). Decide the number of trials in advance and count every trial.</p>
      <div class="row"><button class="btn primary" :disabled="!device.kind" @click="newTrial">Create trial</button></div>
    </section>

    <section class="card">
      <h2>Results</h2>
      <div v-if="stats.length" class="table-wrap">
        <table>
          <thead><tr><th></th><th>N</th><th>1st-place hits</th><th>p</th><th>Mean rank</th><th>Rank z (p)</th></tr></thead>
          <tbody>
            <tr v-for="r in stats" :key="r.label">
              <td>{{ r.label }}</td><td class="num">{{ r.s.n }}</td><td class="num">{{ r.s.hits }} (exp. {{ r.s.expected.toFixed(1) }})</td>
              <td class="num">{{ r.s.pHits.toFixed(3) }}</td><td class="num">{{ r.s.meanRank.toFixed(2) }}</td><td class="num">{{ r.s.z.toFixed(2) }} ({{ r.s.pZ.toFixed(3) }})</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="muted small">No revealed trials yet.</p>
      <p v-if="arvCount" class="muted small">{{ arvCount }} associative remote-viewing trial(s) from Guides are left out: their result is scored in the guide's run summary.</p>
      <p class="muted small">One-sided p-values against chance. With 30 trials at 5 pictures, chance gives about 6 hits; about 11 are needed for p &lt; 0.05. A real effect of the field shows as active better than sham.</p>
      <div v-if="trials.length" class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>When</th><th>Mode</th><th>State</th><th>Condition</th><th>Rank</th></tr></thead>
          <tbody>
            <tr v-for="t in trials" :key="t.id" class="clickable" @click="openTrial(t)">
              <td class="num">{{ t.id }}</td><td>{{ fmtDate(t.created) }}</td><td>{{ t.mode }}</td><td>{{ t.state }}</td><td>{{ t.condition }}</td>
              <td class="num">{{ t.state === 'revealed' ? `${t.targetRank}/${t.setSize}` : '–' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="loading" class="muted small">Loading trials…</p>
      <div v-if="trials.length" class="row"><button class="btn sm" @click="exportTrials">Export trials (for tools/trial_stats.py)</button></div>
    </section>

    <section class="card">
      <h2>Sender</h2>
      <p class="small muted">For telepathy trials, on the sender's phone (same pool imported, connected to the helmet as a second app).</p>
      <div class="row">
        <input v-model="senderId" type="number" placeholder="Trial number" style="max-width: 160px" />
        <button class="btn" :disabled="!device.kind" @click="showSender">Show the target</button>
      </div>
      <img v-if="senderPicture" :src="senderPicture" class="sender" alt="Target picture for the sender" />
    </section>
  </div>
</template>

<style scoped>
.pics { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.pic { margin: 0; border: 1px solid var(--line); border-radius: 8px; padding: 6px; display: grid; gap: 6px; }
.pic img { width: 100%; border-radius: 6px; display: block; }
.pic.target { border-color: var(--ok); box-shadow: 0 0 0 2px var(--ok); }
.sketch { max-width: 240px; border-radius: 6px; }
.big { font-size: 40px; line-height: 1.1; }
.reveal { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
.checks { margin: 0; padding-left: 0; list-style: none; display: grid; gap: 2px; }
.sender { max-width: 100%; border-radius: 8px; }
</style>
