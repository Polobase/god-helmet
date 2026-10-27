<script setup>
// Past guide runs on this phone: open, reveal later, delete, export as JSON.
import { ref } from 'vue'
import { guideById } from '../../lib/guides.js'
import { deleteRun, exportBlob, pendingArv, EXPORT_FILENAME } from '../../lib/runs.js'
import { downloadBlob, fmtDuration } from '../../lib/format.js'
import RunSummary from './RunSummary.vue'

const props = defineProps({ runs: { type: Array, default: () => [] }, title: { type: String, default: 'Past runs' } })
const emit = defineEmits(['changed'])

const open = ref('')
const confirmDelete = ref('')
const error = ref('')

const guideOf = (run) => {
  const g = guideById(run.guideId)
  return g?.doc ?? g ?? null
}
const when = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '–')
const length = (r) => (r.endedAt ? fmtDuration(new Date(r.endedAt) - new Date(r.startedAt)) : '–')
const hidden = (r) => (r.audio?.blind && !r.reveal?.audio) || (r.helmet?.blind && r.helmet?.logId && !r.reveal?.helmet)

async function remove(id) {
  error.value = ''
  try {
    await deleteRun(id)
    confirmDelete.value = ''
    if (open.value === id) open.value = ''
    emit('changed')
  } catch (e) {
    error.value = e.message
  }
}
// Blind runs not revealed yet are exported without their sham flag (lib/runs.js).
const exportAll = () => downloadBlob(exportBlob(props.runs), EXPORT_FILENAME)
</script>

<template>
  <section class="card">
    <div class="row between">
      <h2>{{ title }}</h2>
      <button v-if="runs.length" type="button" class="btn sm" @click="exportAll">Export JSON</button>
    </div>
    <p v-if="!runs.length" class="small muted">No runs yet. Every run is stored on this phone only; export it to keep a copy.</p>
    <ul v-else class="runs">
      <li v-for="r in runs" :key="r.id">
        <button type="button" class="run" :aria-expanded="open === r.id" @click="open = open === r.id ? '' : r.id">
          <span class="name">{{ r.guideName || r.guideId }}</span>
          <span class="meta small muted">{{ when(r.startedAt) }} · {{ length(r) }}</span>
          <span class="chips">
            <span class="chip" :class="{ on: r.completed }">{{ r.completed ? 'done' : r.stopped ? 'stopped' : 'unfinished' }}</span>
            <span v-if="hidden(r)" class="chip blue">reveal pending</span>
            <span v-if="pendingArv(r, guideOf(r)).length" class="chip blue">outcome pending</span>
          </span>
        </button>
        <div v-if="open === r.id" class="detail">
          <RunSummary :record="r" :guide="guideOf(r)" @saved="emit('changed')" />
          <div class="row">
            <template v-if="confirmDelete === r.id">
              <span class="small warn">Delete this run from this phone?</span>
              <button type="button" class="btn danger sm" @click="remove(r.id)">Delete</button>
              <button type="button" class="btn ghost sm" @click="confirmDelete = ''">Keep</button>
            </template>
            <button v-else type="button" class="btn ghost sm" @click="confirmDelete = r.id">Delete run</button>
          </div>
        </div>
      </li>
    </ul>
    <p v-if="error" class="small bad">{{ error }}</p>
  </section>
</template>

<style scoped>
.between { justify-content: space-between; }
.runs { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.run { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; text-align: left; background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; cursor: pointer; }
.run:hover { border-color: var(--accent); }
.name { font-weight: 600; }
.meta { grid-column: 1; }
.chips { grid-column: 2; grid-row: 1 / span 2; display: flex; gap: 4px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.detail { display: grid; gap: 10px; padding: 12px 4px 4px; }
</style>
