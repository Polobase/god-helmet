<script setup>
import { onMounted, ref, watch } from 'vue'
import { device, call } from '../ble/device.js'
import { fmtDate, downloadBlob } from '../lib/format.js'

const items = ref([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const rating = ref({})  // id -> { value, notes }

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

async function rate(e) {
  const r = rating.value[e.id]
  const updated = await call('log.rate', { id: e.id, rating: Number(r.value), notes: r.notes })
  items.value = items.value.map((x) => (x.id === e.id ? updated : x))
  delete rating.value[e.id]
}

async function exportAll() {
  while (items.value.length < total.value) await load(true)
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
      <p v-if="!device.kind" class="small warn">Connect the helmet (or the demo) to see its log.</p>
      <p v-if="error" class="small bad">{{ error }}</p>
    </header>

    <section v-if="items.length" class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Program</th><th>Condition</th><th>µT</th><th>Min</th><th>Kp</th><th>Rating</th></tr></thead>
          <tbody>
            <template v-for="e in items" :key="e.id">
              <tr>
                <td>{{ fmtDate(e.start) }}</td>
                <td>{{ e.presetName }}<span v-if="!e.completed" class="muted small"> ({{ e.reason || 'running' }})</span>
                  <div v-if="e.notes" class="muted small">{{ e.notes }}</div></td>
                <td>{{ e.blind ? '🔒 ' : '' }}{{ e.condition }}</td>
                <td class="num">{{ e.fieldUT.toFixed(1) }}</td>
                <td class="num">{{ Math.round(e.elapsedMs / 60000) }}</td>
                <td class="num">{{ e.kpValid ? e.kp.toFixed(1) : '–' }}</td>
                <td>
                  <span v-if="e.rating >= 0" class="num">{{ e.rating }}</span>
                  <button v-else-if="!rating[e.id]" class="btn sm" @click="rating[e.id] = { value: 5, notes: '' }">Rate</button>
                </td>
              </tr>
              <tr v-if="rating[e.id]">
                <td colspan="7">
                  <div class="stack">
                    <label class="field">Rating 0–10: <b class="num">{{ rating[e.id].value }}</b>
                      <input v-model="rating[e.id].value" type="range" min="0" max="10" step="1" /></label>
                    <label class="field">Notes<textarea v-model="rating[e.id].notes"></textarea></label>
                    <div class="row"><button class="btn primary sm" @click="rate(e)">Save rating</button></div>
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
    <p v-else-if="device.kind && !loading" class="card muted small">No sessions yet.</p>
  </div>
</template>
