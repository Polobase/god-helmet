<script>
// Form state at module level, so it survives a tab change.
import { reactive } from 'vue'
const form = reactive({
  mode: 'dc', mA: [1, 0], hz: 10, band: 'full', minutes: 20, rampUpS: 30, rampDownS: 30,
  blind: false, sham: false, padCm2: 25, safetyRead: false,
})
</script>

<script setup>
// tES on the helmet-driver board (hardware/pcb, untested): shown only when the connected helmet reports tES channels
// (hello.pcb.tes). The helmet enforces every limit itself (firmware lib/pcb/src/tes.h); this panel only asks.
import { computed, ref } from 'vue'
import { device, call } from '../ble/device.js'

const emit = defineEmits(['message'])
const caps = computed(() => device.info?.pcb?.tes ?? null)
const st = computed(() => device.status?.pcb?.tes ?? null)
const usbHost = computed(() => !!device.status?.pcb?.usbHost || device.kind === 'usb')
const running = computed(() => !!st.value?.running)
const imp = computed(() => st.value?.impedance ?? null)
const revealed = ref(null)

// EU 2022/2346, Annex VII, Section 4.1 (read 2026-11-13): who must not use brain stimulation equipment.
const EXCLUDED = [
  'a history of epilepsy',
  'pharmaceutical treatment for conditions related to the central nervous system',
  'therapeutic treatment that changes the excitability of the central nervous system',
  'use of illicit substances or other substances that modify perception',
  'a tumour in the central nervous system',
  'vascular, traumatic, infectious or metabolic lesions or diseases of the brain',
  'sleep disorders, drug dependency or alcoholism',
  'under 18 years old',
  'pregnancy',
]
// Antal et al. 2017, Table 9: the screening questionnaire for transcranial electrical stimulation.
const SCREENING = [
  'Metal (except titanium) or electronic implants in the brain or skull (splinters, clips, cochlear implant, deep brain stimulation)?',
  'Metal or an electronic device elsewhere in the body, such as a cardiac pacemaker, or metal fragments?',
  'Surgery involving the head or spinal cord?',
  'A head injury followed by impaired consciousness?',
  'Skin problems such as dermatitis, psoriasis or eczema?',
  'Epilepsy, or ever a convulsion or seizure?',
  'Fainting spells or syncope?',
  'Pregnant, or any chance of it?',
  'Taking any medication?',
  'Transcranial electric or magnetic stimulation before, and any adverse events with it?',
]

const fmt = (v, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '–')
const peak = computed(() => Math.max(Math.abs(Number(form.mA[0]) || 0), Math.abs(Number(form.mA[1]) || 0)))
const density = computed(() => (form.padCm2 > 0 ? peak.value / form.padCm2 : NaN))
const charge = computed(() => {
  // As the helmet counts it: DC 1, AC 2/π, noise 0.5 of the peak; ramps half; a sham only its ramps.
  const k = form.mode === 'dc' ? 1 : form.mode === 'ac' ? 2 / Math.PI : 0.5
  const sum = Math.abs(Number(form.mA[0]) || 0) + Math.abs(Number(form.mA[1]) || 0)
  const s = (form.sham && !form.blind ? 0 : Number(form.minutes) * 60) + 0.5 * (Number(form.rampUpS) + Number(form.rampDownS))
  return (sum / 1000) * k * s
})

async function act(fn, ok) {
  try {
    await fn()
    if (ok) emit('message', { text: ok })
  } catch (e) {
    emit('message', { text: e.message, bad: true })
  }
}

const params = () => ({
  mode: form.mode,
  mA: form.mA.map(Number),
  hz: Number(form.hz),
  lowHz: form.band === 'high' ? 100 : 0.1,
  highHz: 640,
  minutes: Number(form.minutes),
  rampUpS: Number(form.rampUpS),
  rampDownS: Number(form.rampDownS),
  blind: form.blind,
  sham: form.blind ? false : form.sham,
  safety: caps.value?.safety,
})
const checkElectrodes = () => act(() => call('tes.check', { channels: form.mA.map((m) => Number(m) !== 0), mA: peak.value || 2 }), 'Electrode check running (3 s, 0.1 mA at 10 Hz).')
const start = () => act(async () => {
  revealed.value = null
  await call('tes.start', params())
}, 'tES started.')
const stop = () => act(() => call('tes.stop', { reason: 'stopped in the app' }), 'Stopping: ramping down.')
const reveal = () => act(async () => {
  revealed.value = (await call('tes.reveal')).sham ? 'sham' : 'real'
})
</script>

<template>
  <section v-if="caps" class="card tes">
    <h2>tES</h2>
    <p class="small muted">
      {{ caps.channels }} isolated channels, at most {{ caps.maxMA }} mA each and {{ caps.maxTotalMA }} mA together, {{ caps.maxMinutes }} min and
      {{ caps.maxChargeC }} C per session; the hardware trips at 4.64 mA. Untested hardware, for your own use only.
    </p>
    <p v-if="usbHost" class="small bad">A computer is on the USB socket. tES runs only on a power bank, controlled over Bluetooth: the helmet refuses to start.</p>

    <details :open="!form.safetyRead">
      <summary><b>Before any stimulation</b></summary>
      <div class="safety small">
        <p>Do not use it with any of these (EU 2022/2346, Annex VII, 4.1):</p>
        <ul><li v-for="x in EXCLUDED" :key="x">{{ x }}</li></ul>
        <p>Not on skin with open wounds or rashes, or that is swollen, red, irritated, infected or inflamed (Annex VII, 7.3).</p>
        <p>Screening questions (Antal et al. 2017, Table 9). There, a yes is not an absolute contraindication but has to be weighed by a physician; this app cannot do that, so with a yes, ask one first.</p>
        <ol><li v-for="q in SCREENING" :key="q">{{ q }}</li></ol>
        <p>Electrodes: sponges soaked in saline, never tap water; do not abrade the skin (Antal 2017, 5.1). Look at the skin before and after. Stop at any pain or heat under an electrode: skin burns come from poor or drying contact (Antal 2017, 7.4.1 and 9).</p>
        <label class="check"><input v-model="form.safetyRead" type="checkbox" /> None of the exclusions applies, and any yes above has been discussed with a physician.</label>
      </div>
    </details>

    <div class="grid2">
      <label class="field">Waveform
        <select v-model="form.mode" :disabled="running">
          <option value="dc">DC (tDCS)</option><option value="ac">AC (tACS)</option><option value="rns">Random noise (tRNS)</option>
        </select>
      </label>
      <label v-if="form.mode === 'ac'" class="field">Frequency (Hz, up to 250)<input v-model="form.hz" type="number" min="0.1" max="250" step="0.1" :disabled="running" /></label>
      <label v-if="form.mode === 'rns'" class="field">Noise band
        <select v-model="form.band" :disabled="running"><option value="full">0.1–640 Hz</option><option value="high">100–640 Hz (hf-tRNS)</option></select>
      </label>
      <label v-for="k in 2" :key="k" class="field">
        Channel {{ k }} ({{ form.mode === 'dc' ? 'mA; + = electrode A is the anode' : 'mA peak' }}, 0 = off)
        <input v-model="form.mA[k - 1]" type="number" step="0.1" :min="form.mode === 'dc' ? -caps.maxMA : 0" :max="caps.maxMA" :disabled="running" />
      </label>
      <label class="field">Minutes at full intensity<input v-model="form.minutes" type="number" min="1" :max="caps.maxMinutes" :disabled="running" /></label>
      <label class="field">Ramp up / down (s, 2–60)
        <span class="pair"><input v-model="form.rampUpS" type="number" min="2" max="60" :disabled="running" /><input v-model="form.rampDownS" type="number" min="2" max="60" :disabled="running" /></span>
      </label>
      <label class="field">Electrode pad (cm²)<input v-model="form.padCm2" type="number" min="1" step="1" /></label>
    </div>
    <p class="small muted">
      Current density {{ fmt(density, 3) }} mA/cm² at the peak; charge planned {{ fmt(charge, 2) }} C of {{ caps.maxChargeC }} C.
    </p>
    <label class="check small"><input v-model="form.blind" type="checkbox" :disabled="running" /> Blind: the helmet draws real or sham and tells it after the session</label>
    <label v-if="!form.blind" class="check small"><input v-model="form.sham" type="checkbox" :disabled="running" /> Sham: ramp up and straight down again, then nothing for the session's time</label>

    <div class="row">
      <button class="btn" :disabled="running || usbHost || !form.safetyRead" @click="checkElectrodes">Check electrodes</button>
      <button class="btn primary" :disabled="running || usbHost || !form.safetyRead" @click="start">Start tES</button>
      <button class="btn ghost" :disabled="!running" @click="stop">Stop</button>
    </div>

    <div v-if="imp?.channels" class="kv small">
      <template v-for="(z, i) in imp.channels" :key="i">
        <span class="muted">Channel {{ i + 1 }}</span>
        <span v-if="!z">not checked</span>
        <span v-else :class="z.ok ? 'ok' : 'bad'">{{ fmt(z.kOhm, 1) }} kΩ: {{ z.ok ? 'good contact' : z.short ? 'too low: sponges or saline touching' : 'too high: wet the sponges, press them on' }}</span>
      </template>
    </div>

    <div v-if="st && (running || st.stopReason)" class="kv small">
      <span class="muted">State</span><span>{{ running ? (st.check ? 'checking electrodes' : 'stimulating') : `ended: ${st.stopReason}` }}</span>
      <span class="muted">Time</span><span>{{ fmt(st.elapsedS, 0) }} s of {{ fmt(st.totalS, 0) }} s</span>
      <span class="muted">Charge</span><span>{{ fmt(st.chargeC, 3) }} C</span>
      <template v-if="st.setMA">
        <span class="muted">Set / measured</span><span>{{ fmt(st.setMA[0], 2) }} / {{ fmt(st.mA[0], 2) }} mA, {{ fmt(st.setMA[1], 2) }} / {{ fmt(st.mA[1], 2) }} mA</span>
        <span class="muted">Across the pads</span><span>{{ fmt(st.pairV[0], 1) }} V, {{ fmt(st.pairV[1], 1) }} V</span>
      </template>
    </div>
    <div v-if="!running && form.blind && st?.stopReason" class="row">
      <button class="btn sm" @click="reveal">Reveal real or sham</button>
      <span v-if="revealed" class="small"><b>{{ revealed }}</b></span>
    </div>
  </section>
</template>

<style scoped>
.tes { display: grid; gap: 10px; }
.safety { display: grid; gap: 6px; padding-top: 8px; }
.safety ul, .safety ol { margin: 0; padding-left: 20px; }
.kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ok { color: var(--ok); } .bad { color: var(--bad); }
</style>
