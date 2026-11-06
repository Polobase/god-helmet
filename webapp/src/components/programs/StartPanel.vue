<script setup>
// Start panel of a program: what is ready and what is not, intensity, blind,
// and Start. Opened from the program header; it stays open across the detour
// to the safety page.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { device, call, connect, maxFieldUT } from '../../ble/device.js'
import { presetById } from '../../lib/presets.js'
import { fmtMinutes } from '../../lib/format.js'
import { headInUse } from '../../lib/head.js'
import { readiness, hoursSinceLast, minGapHours } from '../../lib/readiness.js'
import { program, groupOf, usedCoils, placedCount, subHref } from '../../lib/programState.js'
import { nav, go, goSafety } from '../../lib/nav.js'
import IntensitySlider from '../IntensitySlider.vue'

const dlg = ref(null)
const preset = computed(() => presetById(program.id))
const group = computed(() => groupOf(program.id))
const nowS = ref(Date.now() / 1000)
const rows = computed(() => readiness({ device, head: headInUse(), placed: placedCount(group.value), used: usedCoils(group.value).length, nowS: nowS.value }))

const maxField = computed(() => maxFieldUT())
const field = computed({
  get: () => Math.min(program.uT, maxField.value),
  set: (v) => (program.uT = Number(v)),
})
const capped = computed(() => program.uT > maxField.value + 1e-9)
const blind = ref(false)
const busy = computed(() => device.status && device.status.state !== 'idle')
const startError = ref('')
const confirmRecent = ref(false)
const recentH = computed(() => hoursSinceLast(device.info, nowS.value))
const tooSoon = computed(() => recentH.value !== null && recentH.value < minGapHours(device.info))

function show() {
  nowS.value = Date.now() / 1000
  startError.value = ''
  confirmRecent.value = false
  if (dlg.value && !dlg.value.open) dlg.value.showModal()
}
watch(() => program.startOpen, (open) => (open ? show() : dlg.value?.open && dlg.value.close()))
onMounted(() => program.startOpen && show())
// Kept open only for the way back from the safety page.
onBeforeUnmount(() => nav.tab !== 'safety' && (program.startOpen = false))
// Esc, the close button and a click on the backdrop all end here.
const onClose = () => (program.startOpen = false)
const onBackdrop = (e) => e.target === dlg.value && dlg.value.close()

const here = () => location.hash.replace(/^#/, '')
function act(action) {
  if (action === 'safety') return goSafety(here())
  dlg.value?.close()
  if (action === 'measure' || action === 'place') {
    program.focus = action
    location.hash = subHref('placement')
  }
  else if (action === 'calibrate') go('helmet')
}

async function start() {
  startError.value = ''
  if (tooSoon.value && !confirmRecent.value) {
    confirmRecent.value = true
    return
  }
  confirmRecent.value = false
  try {
    await call('session.start', { session: preset.value.doc, presetId: preset.value.doc.id, fieldUT: Number(field.value), blind: blind.value })
    dlg.value?.close()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    startError.value = e.message
    if (/safety/.test(e.message)) goSafety(here())
  }
}
const ICON = { ok: '✓', warn: '!', bad: '✕' }
</script>

<template>
  <dialog ref="dlg" class="start-dlg" aria-labelledby="start-title" @close="onClose" @click="onBackdrop">
    <div class="body">
      <header class="row between">
        <div class="stack tight">
          <span class="eyebrow">Start</span>
          <h3 id="start-title">{{ preset.doc.name }}</h3>
          <span v-if="preset.session" class="muted small">{{ fmtMinutes(preset.session.totalMs) }} · {{ preset.session.phases.length }} phase{{ preset.session.phases.length === 1 ? '' : 's' }}</span>
        </div>
        <button type="button" class="btn ghost sm close" aria-label="Close" @click="dlg.close()">✕</button>
      </header>

      <ul class="ready" aria-label="Ready to start?">
        <li v-for="r in rows" :key="r.key" :class="r.status">
          <span class="mark" aria-hidden="true">{{ ICON[r.status] }}</span>
          <span class="text">{{ r.text }}</span>
          <span v-if="r.action === 'connect'" class="acts">
            <button type="button" class="btn primary sm" :disabled="!device.bluetooth || device.connecting" @click="connect('ble')">{{ device.connecting ? 'Connecting…' : 'Bluetooth' }}</button>
            <button v-if="device.serial" type="button" class="btn sm" :disabled="device.connecting" @click="connect('usb')">USB</button>
            <button type="button" class="btn ghost sm" @click="connect('demo')">Demo</button>
          </span>
          <button v-else-if="r.action" type="button" class="linkbtn small act" @click="act(r.action)">{{ { safety: 'Read the safety page', measure: 'Measure', place: 'Place the coils', calibrate: 'Calibrate' }[r.action] }} →</button>
        </li>
      </ul>

      <IntensitySlider v-model="field" />
      <p v-if="capped" class="small muted">The Brain view was set to {{ program.uT.toFixed(1) }} µT; this helmet allows up to {{ maxField.toFixed(1) }} µT.</p>
      <label class="check"><input v-model="blind" type="checkbox" /> Blind: the helmet picks real or sham at random (revealed after you rate)</label>
      <p v-if="confirmRecent" class="warn small" role="alert">Last session was {{ recentH.toFixed(0) }} h ago; {{ minGapHours(device.info) }} h between sessions is recommended. Press Start again to continue anyway.</p>

      <div v-if="device.kind" class="row">
        <button type="button" class="btn primary go" :disabled="busy" @click="start">{{ busy ? 'A session is running' : confirmRecent ? 'Start anyway' : 'Start' }}</button>
        <span class="muted small">on {{ device.kind === 'demo' ? 'the demo' : device.name }}</span>
      </div>
      <p v-if="startError" class="bad small" role="alert">{{ startError }}</p>
    </div>
  </dialog>
</template>

<style scoped>
.start-dlg { border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--text); padding: 0; width: min(560px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); }
.start-dlg::backdrop { background: rgb(0 0 0 / .55); }
.body { display: grid; gap: 14px; padding: 18px; }
.between { justify-content: space-between; align-items: flex-start; flex-wrap: nowrap; }
.tight { gap: 2px; }
.close { flex: none; }
.ready { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.ready li { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 8px; align-items: center; font-size: 14px; }
.mark { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font: 700 12px var(--font-body); border: 1.5px solid currentColor; }
.ready .ok .mark { color: var(--ok); }
.ready .warn .mark { color: var(--warn); }
.ready .bad .mark { color: var(--bad); }
.ready .warn .text { color: var(--text); }
.acts { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.act { white-space: nowrap; }
.go { min-width: 140px; }
@media (max-width: 640px) {
  .start-dlg { margin: auto 0 0; width: 100%; max-width: 100%; border-radius: 14px 14px 0 0; border-bottom: 0; }
  .ready li { grid-template-columns: 22px minmax(0, 1fr); }
  .ready li > :last-child:not(.text) { grid-column: 2; justify-self: start; }
}
</style>
