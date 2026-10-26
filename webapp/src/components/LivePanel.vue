<script setup>
// Live view of the running session, plus the rating prompt afterwards.
import { computed, ref, watch } from 'vue'
import { device, call } from '../ble/device.js'
import { presetById } from '../lib/presets.js'
import { fmtDuration } from '../lib/format.js'
import HeadDiagram from './HeadDiagram.vue'

const st = computed(() => device.status)
const running = computed(() => st.value && st.value.state !== 'idle')
const preset = computed(() => (st.value ? presetById(st.value.sessionId) : null))
const layout = computed(() => preset.value?.session.layout ?? (st.value?.sessionId === 'test-rotate' ? device.testLayout : 'temporal'))
const maxField = computed(() => Math.min(device.info?.maxFieldUT ?? 5, device.info?.maxReachableUT ?? 5))
const field = ref(1)
const editingField = ref(false)

// Rating after a logged session ends.
const lastLogId = ref(0)
const rateFor = ref(0)
const rating = ref(5)
const notes = ref('')
const revealed = ref('')

watch(st, (s) => {
  if (!s) return
  if (s.state !== 'idle' && s.logId) lastLogId.value = s.logId
  if (s.state === 'idle' && lastLogId.value) {
    rateFor.value = lastLogId.value
    lastLogId.value = 0
  }
  if (!editingField.value && s.fieldUT) field.value = s.fieldUT
})

async function setField() {
  editingField.value = false
  await call('session.field', { fieldUT: Number(field.value) })
}

async function rate() {
  const r = await call('log.rate', { id: rateFor.value, rating: Number(rating.value), notes: notes.value })
  revealed.value = r.blind ? `This blind session was ${r.condition}.` : 'Saved.'
  setTimeout(() => {
    rateFor.value = 0
    revealed.value = ''
    notes.value = ''
  }, 5000)
}

</script>

<template>
  <section v-if="running" class="card live" aria-live="polite">
    <div class="top">
      <div class="stack">
        <span class="eyebrow">{{ st.test ? 'Test' : 'Session running' }}{{ st.blind ? ' · blind' : '' }}</span>
        <h2>{{ st.sessionName }}</h2>
        <div class="muted small">Phase {{ st.phase + 1 }} of {{ st.phaseCount }}: {{ st.phaseName }}{{ st.state === 'stopping' ? ' · stopping' : '' }}</div>
        <div class="remain num">{{ fmtDuration(st.totalMs - st.programMs) }}</div>
      </div>
      <div class="diagram">
        <HeadDiagram :layout="layout" :levels="st.blind ? new Array(8).fill(0) : st.levels" :labels="false" />
      </div>
    </div>
    <div class="stack">
      <div class="muted small">Phase</div>
      <div class="bar"><i :style="{ width: (100 * st.phaseMs) / Math.max(1, st.phaseDurationMs) + '%' }"></i></div>
      <div class="muted small">Session</div>
      <div class="bar"><i :style="{ width: (100 * st.programMs) / Math.max(1, st.totalMs) + '%' }"></i></div>
    </div>
    <label v-if="!st.test" class="field">Intensity at 20 mm: <b class="num">{{ Number(field).toFixed(1) }} µT</b>
      <input v-model="field" type="range" min="0.1" :max="maxField.toFixed(1)" step="0.1"
        @input="editingField = true" @change="setField" />
    </label>
    <p v-if="st.blind" class="muted small">Blind session: coil activity is hidden. The log reveals real or sham after you rate it.</p>
    <div class="row">
      <button class="btn" :disabled="st.state === 'stopping'" @click="call('session.skip')">
        {{ st.phase + 1 >= st.phaseCount ? 'End session' : 'Skip phase' }}
      </button>
      <button class="btn danger" @click="call('session.stop')">Stop</button>
    </div>
  </section>

  <section v-else-if="rateFor" class="card">
    <h2>How was it?</h2>
    <p class="muted small">Rate before you look anything up. For blind sessions this reveals whether the field was real.</p>
    <label class="field">0 = nothing … 10 = profound: <b class="num">{{ rating }}</b>
      <input v-model="rating" type="range" min="0" max="10" step="1" />
    </label>
    <label class="field">What you noticed, and when<textarea v-model="notes"></textarea></label>
    <div class="row">
      <button class="btn primary" @click="rate">Save rating</button>
      <button class="btn ghost" @click="rateFor = 0">Later (Log tab)</button>
    </div>
    <p v-if="revealed" class="ok">{{ revealed }}</p>
  </section>
</template>

<style scoped>
.live { border-color: var(--accent); }
.top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(140px, 240px); gap: 16px; align-items: center; }
.remain { font-size: 44px; line-height: 1; }
@media (max-width: 520px) { .top { grid-template-columns: 1fr; } .diagram { max-width: 260px; } }
</style>
