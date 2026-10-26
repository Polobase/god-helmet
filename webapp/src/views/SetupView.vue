<script setup>
import { ref, watch } from 'vue'
import { device, call, refresh, connect } from '../ble/device.js'
import { fetchKp } from '../lib/noaa.js'
import { LAYOUTS } from '../lib/layouts.js'
import { go } from '../lib/nav.js'

const msg = ref('')
const err = ref('')
const s = ref(null)  // editable copy of the settings
watch(() => device.settings, (v) => (s.value = v ? JSON.parse(JSON.stringify(v)) : null), { immediate: true })

const calCh = ref(0)
const calMA = ref(2)
const calSec = ref(30)
const measured = ref('')
const rot = ref({ layout: 'temporal', dir: 'ccw', dwellMs: 1000, mA: 2 })
const kpManual = ref('')

async function run(fn, ok) {
  msg.value = ''
  err.value = ''
  try {
    await fn()
    if (ok) msg.value = ok
  } catch (e) {
    err.value = e.message
    if (/safety/.test(e.message)) go('safety')
  }
}

const dcTest = (sign) => run(() => call('test', { mode: 'dc', channel: calCh.value, mA: sign * Number(calMA.value), seconds: Number(calSec.value) }).then(() => go('programs')))
const rotTest = () => run(() => {
  device.testLayout = rot.value.layout
  return call('test', { mode: 'rotate', ...rot.value, mA: Number(rot.value.mA), dwellMs: Number(rot.value.dwellMs), seconds: 30 }).then(() => go('programs'))
})

function applyMeasured() {
  const ma = Math.abs(Number(calMA.value))
  const b = Number(measured.value)
  if (!(ma > 0 && b > 0)) return (err.value = 'Enter the test current and the measured field.')
  s.value.uTperMA[calCh.value] = Number((b / ma).toFixed(3))
  msg.value = `CH${calCh.value + 1}: ${s.value.uTperMA[calCh.value]} µT/mA. Save to keep it.`
}

const saveSettings = () => run(async () => {
  const keys = ['uTperMA', 'calibrated', 'seriesOhm', 'coilOhm', 'vFullScale', 'dacGain2x', 'dacBufferedRef', 'maxFieldUT', 'defaultFieldUT', 'longitudeDeg', 'keepaliveS', 'bleName']
  const body = Object.fromEntries(keys.map((k) => [k, s.value[k]]))
  await call('settings.set', body)
  await refresh()
}, 'Saved.')

const useLocation = () => run(() => new Promise((resolve, reject) => {
  navigator.geolocation.getCurrentPosition((p) => {
    s.value.longitudeDeg = Number(p.coords.longitude.toFixed(3))
    resolve()
  }, () => reject(new Error('Location not available; type your longitude instead.')))
}), 'Longitude filled in; press Save.')

const updateKp = () => run(async () => {
  device.kp = await fetchKp()
  await call('env.set', { kp: device.kp.kp, ap: device.kp.ap, source: 'noaa' })
  await refresh()
}, 'Kp updated from NOAA.')

const setKp = () => run(async () => {
  await call('env.set', { kp: Number(kpManual.value), source: 'manual' })
  await refresh()
}, 'Kp set.')
</script>

<template>
  <div class="page">
    <p v-if="!device.kind" class="card row">
      <span class="warn small">Connect the helmet (or the demo) to change its settings.</span>
      <button class="btn primary sm" :disabled="!device.bluetooth" @click="connect('ble')">Connect helmet</button>
      <button class="btn sm" @click="connect('demo')">Try the demo</button>
    </p>
    <p v-if="msg" class="card ok small">{{ msg }}</p>
    <p v-if="err" class="card bad small">{{ err }}</p>

    <template v-if="s">
      <section class="card">
        <h2>Calibration</h2>
        <p class="small muted">Drive one coil with DC and measure the field 20 mm in front of its face, on its axis: phone magnetometer (phyphox) or an I2C sensor. Subtract the reading with the coil off. Reverse polarity to check the sign. docs/CALIBRATION.md has the details.</p>
        <div class="grid2">
          <label class="field">Coil
            <select v-model.number="calCh"><option v-for="i in 8" :key="i" :value="i - 1">CH{{ i }}</option></select>
          </label>
          <label class="field">Current (mA, max 4.5)<input v-model="calMA" type="number" step="0.1" min="0.1" max="4.5" /></label>
          <label class="field">Seconds<input v-model="calSec" type="number" min="5" max="120" /></label>
        </div>
        <div class="row">
          <button class="btn" @click="dcTest(1)">Start DC test</button>
          <button class="btn ghost" @click="dcTest(-1)">Reversed polarity</button>
        </div>
        <div class="grid2">
          <label class="field">Measured field, on minus off (µT)<input v-model="measured" type="number" step="0.01" /></label>
          <div class="row" style="align-items: end"><button class="btn" @click="applyMeasured">Use for this coil</button></div>
        </div>
        <div class="cal">
          <label v-for="i in 8" :key="i" class="field">CH{{ i }} µT/mA<input v-model.number="s.uTperMA[i - 1]" type="number" step="0.01" /></label>
        </div>
        <label class="check"><input v-model="s.calibrated" type="checkbox" /> These values are measured</label>
        <div class="row"><button class="btn primary" @click="saveSettings">Save calibration</button></div>
      </section>

      <section class="card">
        <h2>Wiring check</h2>
        <p class="small muted">Each coil in turn gets DC for the dwell time. Follow it with a compass, or measure about 2.2 V per mA across each 2.2 kΩ resistor.</p>
        <div class="grid2">
          <label class="field">Layout<select v-model="rot.layout"><option v-for="L in LAYOUTS" :key="L.key" :value="L.key">{{ L.title }}</option></select></label>
          <label class="field">Direction<select v-model="rot.dir"><option value="ccw">Counter-clockwise</option><option value="cw">Clockwise</option></select></label>
          <label class="field">Dwell per coil (ms)<input v-model="rot.dwellMs" type="number" min="100" /></label>
          <label class="field">Current (mA)<input v-model="rot.mA" type="number" step="0.1" /></label>
        </div>
        <div class="row"><button class="btn" @click="rotTest">Start rotation test (30 s)</button></div>
      </section>

      <section class="card">
        <h2>Helmet</h2>
        <div class="grid2">
          <label class="field">Series resistor (Ω)<input v-model.number="s.seriesOhm" type="number" /></label>
          <label class="field">Coil resistance (Ω)<input v-model.number="s.coilOhm" type="number" step="0.1" /></label>
          <label class="field">Module full scale (V)<input v-model.number="s.vFullScale" type="number" step="0.1" /></label>
          <label class="field">Max field at 20 mm (µT, ≤ 10)<input v-model.number="s.maxFieldUT" type="number" step="0.1" /></label>
          <label class="field">Default field (µT)<input v-model.number="s.defaultFieldUT" type="number" step="0.1" /></label>
          <label class="field">Stop if no app for (s, 0 = off)<input v-model.number="s.keepaliveS" type="number" /></label>
          <label class="field">Bluetooth name (empty = GodHelmet-XXXX)<input v-model="s.bleName" type="text" maxlength="20" /></label>
          <label class="field">Longitude (° east, for sidereal time)
            <div class="row"><input v-model.number="s.longitudeDeg" type="number" step="0.01" style="flex: 1" /><button class="btn sm" @click="useLocation">Use my location</button></div>
          </label>
        </div>
        <label class="check"><input v-model="s.dacGain2x" type="checkbox" /> DAC gain ×2 (0…2·Vref; see the bench test)</label>
        <label class="check"><input v-model="s.dacBufferedRef" type="checkbox" /> Buffered DAC reference</label>
        <div class="row"><button class="btn primary" @click="saveSettings">Save settings</button></div>
        <p class="small muted">Max current with these values: {{ (s.vFullScale / (s.seriesOhm + s.coilOhm) * 1000).toFixed(2) }} mA per coil. A new Bluetooth name applies after a restart.</p>
      </section>

      <section class="card">
        <h2>Environment</h2>
        <div class="kv small">
          <span class="muted">Helmet</span><span>{{ device.info?.board }} · firmware {{ device.info?.firmware }}</span>
          <span class="muted">Clock</span><span>{{ device.info?.env?.timeValid ? new Date(device.info.env.epoch * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'not set' }}</span>
          <span class="muted">Local sidereal time</span><span>{{ device.info?.env?.lst >= 0 ? device.info.env.lst.toFixed(2) + ' h' : '–' }}</span>
          <span class="muted">Kp / ap</span><span>{{ device.info?.env?.kpValid ? `${device.info.env.kp.toFixed(2)} / ${device.info.env.ap >= 0 ? device.info.env.ap : '–'} (${device.info.env.kpSource})` : '–' }}</span>
        </div>
        <div class="row">
          <button class="btn sm" @click="updateKp">Update Kp from NOAA</button>
          <input v-model="kpManual" type="number" step="0.33" min="0" max="9" placeholder="Kp 0–9" style="max-width: 120px" />
          <button class="btn sm ghost" @click="setKp">Set by hand</button>
        </div>
        <p class="small muted">Kp, ap and sidereal time are recorded with every session and trial. They are never used to schedule sessions; the reported effects did not replicate.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.cal { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; }
@media (max-width: 520px) { .cal { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
