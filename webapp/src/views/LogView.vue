<script setup>
import { onMounted, ref, watch } from 'vue'
import { device, call, connect } from '../ble/device.js'
import { fmtDate, downloadBlob } from '../lib/format.js'

const items = ref([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const rating = ref({})  // id -> { value, notes, err }

async function load(more = false) {
  if (!device.kind) return
  loading.value = true
  error.value = ''
  try {
    const page = await call('log.list', { offset: more ? items.value.length : 0, limit: 10 })
    items.value = more ? [...items.value, ...page.items] : page.items
    total.value = page.total
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(() => load())
watch(() => device.kind, () => load())
// When a session ends, refresh the newest page and merge it in by id, so its
// row shows the result while older pages, an open rating form and an export
// in progress stay as they are.
let exporting = false
async function refreshTop() {
  if (!device.kind || exporting) return
  try {
    const page = await call('log.list', { offset: 0, limit: 10 })
    const fresh = new Set(page.items.map((x) => x.id))
    items.value = [...page.items, ...items.value.filter((x) => !fresh.has(x.id))].sort((a, b) => b.id - a.id)
    total.value = page.total
  } catch (e) {
    error.value = e.message
  }
}
watch(() => device.status?.state, (st, prev) => { if (st === 'idle' && prev && prev !== 'idle') refreshTop() })

// Rating reveals real or sham, so the running session cannot be rated yet. An
// unfinished entry while the helmet is idle was cut off (e.g. power loss) and can.
const live = (e) => !e.finished && device.status?.state !== 'idle'

async function rate(e) {
  const r = rating.value[e.id]
  r.err = ''
  try {
    const updated = await call('log.rate', { id: e.id, rating: Number(r.value), notes: r.notes })
    items.value = items.value.map((x) => (x.id === e.id ? updated : x))
    delete rating.value[e.id]
  } catch (err) {
    r.err = err.message
  }
}

async function exportAll() {
  exporting = true
  try {
    while (items.value.length < total.value) await load(true)
  } finally {
    exporting = false
  }
  downloadBlob(new Blob([JSON.stringify(items.value, null, 2)], { type: 'application/json' }), 'godhelmet-sessions.json')
}
</script>

<template>
  <div class="page">
    <header class="card">
      <div class="row" style="justify-content: space-between">
        <h2>Session log</h2>
        <button class="btn sm" :disabled="!items.length" @click="exportAll">Export JSON</button>
      </div>
      <p class="small muted">Stored on the helmet. Blind sessions show "hidden" until you rate them.</p>
      <p v-if="!device.kind" class="row">
        <span class="warn small">Connect the helmet (or the demo) to see its log.</span>
        <button class="btn primary sm" :disabled="!device.bluetooth" @click="connect('ble')">Connect helmet</button>
        <button class="btn sm" @click="connect('demo')">Try the demo</button>
      </p>
      <p v-if="error" class="small bad">{{ error }}</p>
    </header>

    <section v-if="items.length" class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Program</th><th>Condition</th><th class="keep-case" title="Field at 20 mm">µT</th><th title="Minutes">Min</th><th class="keep-case" title="Geomagnetic Kp index">Kp</th><th>Rating</th></tr></thead>
          <tbody>
            <template v-for="e in items" :key="e.id">
              <tr>
                <td class="when">{{ fmtDate(e.start) }}</td>
                <td>{{ e.presetName }}<span v-if="!e.completed" class="muted small"> ({{ e.reason || 'running' }})</span>
                  <div class="muted small phone-only">{{ e.fieldUT.toFixed(1) }} µT · {{ Math.round(e.elapsedMs / 60000) }} min · Kp {{ e.kpValid ? e.kp.toFixed(1) : '–' }}</div>
                  <div v-if="e.notes" class="muted small note">{{ e.notes }}</div></td>
                <td>{{ e.blind ? '🔒 ' : '' }}{{ e.condition }}</td>
                <td class="num">{{ e.fieldUT.toFixed(1) }}</td>
                <td class="num">{{ Math.round(e.elapsedMs / 60000) }}</td>
                <td class="num">{{ e.kpValid ? e.kp.toFixed(1) : '–' }}</td>
                <td>
                  <span v-if="e.rating >= 0" class="num">{{ e.rating }}</span>
                  <span v-else-if="live(e)" class="muted small">After it ends</span>
                  <button v-else-if="!rating[e.id]" class="btn sm" @click="rating[e.id] = { value: 5, notes: '', err: '' }">Rate</button>
                  <span v-else class="muted small">Rating…</span>
                  <div v-if="e.trialId && e.rating < 0 && e.blind" class="muted small">Trial #{{ e.trialId }}: rate it after the trial is revealed.</div>
                </td>
              </tr>
              <tr v-if="rating[e.id]">
                <td colspan="7">
                  <div class="stack">
                    <label class="field"><span>Rating: <b class="num">{{ rating[e.id].value }}</b> / 10</span>
                      <input v-model="rating[e.id].value" type="range" min="0" max="10" step="1" />
                      <span class="row ends"><span>0 = nothing</span><span>10 = profound</span></span></label>
                    <label class="field">Notes<textarea v-model="rating[e.id].notes"></textarea></label>
                    <p v-if="rating[e.id].err" class="small bad">{{ rating[e.id].err }}</p>
                    <div class="row">
                      <button class="btn primary sm" @click="rate(e)">Save rating</button>
                      <button class="btn ghost sm" @click="delete rating[e.id]">Cancel</button>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div class="row">
        <button v-if="items.length < total" class="btn sm" :disabled="loading" @click="load(true)">Load more ({{ items.length }} of {{ total }})</button>
      </div>
    </section>
    <p v-else-if="device.kind && !loading" class="card muted small"><span>No sessions yet. <a href="#programs">Pick a program</a> to start one.</span></p>
  </div>
</template>

<style scoped>
.ends { justify-content: space-between; }
.note { max-width: 48ch; }
.phone-only { display: none; }
@media (min-width: 601px) { .when { white-space: nowrap; } }
/* Phone: field, minutes and Kp move under the program name so Rating fits. */
@media (max-width: 600px) {
  .table-wrap th:nth-child(n+4):nth-child(-n+6), .table-wrap td:nth-child(n+4):nth-child(-n+6) { display: none; }
  .table-wrap th, .table-wrap td { padding: 8px 6px; }
  .phone-only { display: block; }
}
</style>
