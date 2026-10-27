<script setup>
import { computed, ref, watch } from 'vue'
import { device, call, refresh, connect } from '../ble/device.js'
import { nav, returnFromSafety, TABS } from '../lib/nav.js'
import { presetById } from '../lib/presets.js'

const accepted = ref(Boolean(device.info?.safetyAccepted))
watch(() => device.info?.safetyAccepted, (v) => { if (v) accepted.value = true })
const err = ref('')
// Where Continue leads: back to the tab (and program) that was refused.
const back = computed(() => {
  const [tab, id] = (nav.arg || '').split('/')
  if (!tab) return null
  const label = TABS.find((t) => t.key === tab)?.label ?? 'Programs'
  const name = id ? presetById(id)?.doc.name : null
  return name ? `${label}: ${name}` : label
})

async function accept() {
  err.value = ''
  try {
    if (!device.info?.safetyAccepted) {
      await call('settings.set', { safetyAccepted: true })
      await refresh()
    }
    returnFromSafety()
  } catch (e) {
    err.value = e.message
  }
}
</script>

<template>
  <div class="page">
    <section class="card">
      <span class="eyebrow">Read before the first session</span>
      <h2>Safety</h2>
      <p v-if="back && !device.info?.safetyAccepted" class="notice warn">The helmet will not start a field until you accept this page. Continue takes you back to {{ back }}.</p>
      <p>This is an experimental, non-medical device. The fields are about 1–5 µT at the cortex, about a million times weaker than TMS and below the ICNIRP public reference level. The published evidence that such fields cause any experience is weak: double-blind studies attribute most effects to expectation and setting. The blind mode lets you find out for yourself.</p>
      <h3>Do not use it if you</h3>
      <ul class="list contra">
        <li>have epilepsy, a seizure history, or a first-degree relative with epilepsy. The burst-firing patterns were derived from seizure EEG, and Murphy reports his own 8–10 days of distress after the bilateral amygdala signal.</li>
        <li>have a psychiatric condition (psychosis, bipolar disorder, severe depression, PTSD) or take medication that lowers the seizure threshold;</li>
        <li>have implanted electronics (pacemaker, defibrillator, cochlear implant, neurostimulator), are pregnant, or had a recent head injury;</li>
        <li>have taken alcohol or drugs.</li>
      </ul>
      <h3>Rules</h3>
      <ul class="list">
        <li>Battery (power bank) only while the helmet is worn; never charge from mains during a session.</li>
        <li>Sit or lie down. No driving or machinery for at least an hour afterwards.</li>
        <li>Stop at once (STOP button) on fear, anxiety, headache, nausea or anything unusual. Right-side-only stimulation is reported to cause fear in some people.</li>
        <li>At most one session per 72 hours.</li>
        <li>Never run the coils without the 2.2 kΩ series resistors.</li>
        <li>Don't combine it with other stimulation devices (light/sound machines, CES, TENS) during a session.</li>
      </ul>
      <label class="check"><input v-model="accepted" type="checkbox" /> I have read this and accept the risks</label>
      <div class="row">
        <button class="btn primary" :disabled="!accepted || !device.kind" @click="accept">Continue</button>
        <template v-if="!device.kind">
          <button class="btn sm" :disabled="!device.bluetooth || device.connecting" @click="connect('ble')">Connect helmet</button>
          <button class="btn ghost sm" @click="connect('demo')">Try the demo</button>
          <span class="small muted">The helmet stores your acceptance, so connect first.</span>
        </template>
        <span v-else-if="device.info?.safetyAccepted" class="small ok">Accepted on this helmet.</span>
      </div>
      <p v-if="err" class="bad small">{{ err }}</p>
    </section>
  </div>
</template>

<style scoped>
.list { margin: 0; padding-left: 18px; display: grid; gap: 6px; max-width: 75ch; }
.list.contra { border-left: 3px solid var(--bad); padding-left: 30px; }
p { max-width: 75ch; }
.notice { padding: 10px 12px; border: 1px solid var(--warn); border-radius: 8px; background: var(--surface-2); font-size: 14px; }
</style>
