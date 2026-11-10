<script setup>
// Live view of the running session, plus the rating prompt afterwards.
import { computed, ref, watch } from 'vue'
import { device, call } from '../ble/device.js'
import IntensitySlider from './IntensitySlider.vue'
import RatingForm from './RatingForm.vue'
import { presetById } from '../lib/presets.js'
import { fmtDuration } from '../lib/format.js'
import { LAYOUTS } from '../lib/layouts.js'
import { sessionSites } from '../lib/brain.js'
import SiteMap from './SiteMap.vue'

// rate: false where another view already asks for the rating (the header's copy).
const props = defineProps({ rate: { type: Boolean, default: true } })
const st = computed(() => device.status)
const running = computed(() => st.value && st.value.state !== 'idle')
const preset = computed(() => (st.value ? presetById(st.value.sessionId) : null))
const sites = computed(() => (preset.value?.session ? sessionSites(preset.value.session) : LAYOUTS[st.value?.sessionId === 'test-rotate' ? device.testLayout : 'temporal'].channels.map((c) => c.site)))
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
        <SiteMap :sites="sites" :levels="st.blind ? new Array(8).fill(0) : st.levels" :labels="false" :caption="false" />
      </div>
    </div>
    <div class="stack">
      <div class="muted small">Phase</div>
      <div class="bar"><i :style="{ width: (100 * st.phaseMs) / Math.max(1, st.phaseDurationMs) + '%' }"></i></div>
      <div class="muted small">Session</div>
      <div class="bar"><i :style="{ width: (100 * st.programMs) / Math.max(1, st.totalMs) + '%' }"></i></div>
    </div>
    <IntensitySlider v-if="!st.test" :model-value="Number(field)" label="Intensity at 20 mm" @update:model-value="(v) => ((field = v), (editingField = true))" @change="setField" />
    <p v-if="st.blind" class="muted small">Blind session: coil activity is hidden. The log reveals real or sham after you rate it.</p>
    <div class="row">
      <!-- On the last phase, skipping is the same as Stop, so only offer it while a next phase exists. -->
      <button v-if="st.phase + 1 < st.phaseCount" class="btn" :disabled="st.state === 'stopping' || device.link !== 'connected'" @click="call('session.skip')">Skip to next phase</button>
      <button class="btn danger" :disabled="device.link !== 'connected'" :title="device.link !== 'connected' ? 'No connection: only the STOP button on the helmet works now' : ''" @click="call('session.stop')">Stop session</button>
      <span class="muted small">Stop fades the field out over 2 s{{ st.test ? '' : ' and keeps the session in the Log' }}.</span>
    </div>
  </section>

  <section v-else-if="props.rate && rateFor" class="card">
    <h2>How was it?</h2>
    <p class="muted small">Rate before you look anything up. For blind sessions this reveals whether the field was real.</p>
    <RatingForm v-model:rating="rating" v-model:notes="notes" cancel-label="Later (in the Log)" @save="rate" @cancel="rateFor = 0" />
    <p v-if="revealed" class="ok">{{ revealed }}</p>
  </section>
</template>

<style scoped>
.live { border-color: var(--accent); }
.top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(140px, 240px); gap: 16px; align-items: center; }
.remain { font-size: 44px; line-height: 1; }
@media (max-width: 520px) { .top { grid-template-columns: 1fr; } .diagram { max-width: 260px; } }
</style>
