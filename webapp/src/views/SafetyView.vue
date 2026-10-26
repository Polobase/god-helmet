<script setup>
import { ref } from 'vue'
import { device, call, refresh } from '../ble/device.js'
import { go } from '../lib/nav.js'

const accepted = ref(false)
const err = ref('')

async function accept() {
  err.value = ''
  try {
    await call('settings.set', { safetyAccepted: true })
    await refresh()
    go('programs')
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
      <p>This is an experimental, non-medical device. The fields are about 1–5 µT at the cortex, about a million times weaker than TMS and below the ICNIRP public reference level. The published evidence that such fields cause any experience is weak: double-blind studies attribute most effects to expectation and setting. The blind mode lets you find out for yourself.</p>
      <h3>Do not use it if you</h3>
      <ul class="small list">
        <li>have epilepsy, a seizure history, or a first-degree relative with epilepsy. The burst-firing patterns were derived from seizure EEG, and Murphy reports his own 8–10 days of distress after the bilateral amygdala signal.</li>
        <li>have a psychiatric condition (psychosis, bipolar disorder, severe depression, PTSD) or take medication that lowers the seizure threshold;</li>
        <li>have implanted electronics (pacemaker, defibrillator, cochlear implant, neurostimulator), are pregnant, or had a recent head injury;</li>
        <li>have taken alcohol or drugs.</li>
      </ul>
      <h3>Rules</h3>
      <ul class="small list">
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
        <span v-if="!device.kind" class="small muted">Connect the helmet (or the demo) first; the helmet stores your acceptance.</span>
        <span v-else-if="device.info?.safetyAccepted" class="small ok">Accepted on this helmet.</span>
      </div>
      <p v-if="err" class="bad small">{{ err }}</p>
    </section>
  </div>
</template>

<style scoped>
.list { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
</style>
