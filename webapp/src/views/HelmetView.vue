<script>
// Test inputs live at module level, so they survive the remount on every tab
// change (e.g. the detour to the safety page) and the reading goes to the right coil.
import { reactive } from 'vue'
const cal = reactive({ ch: 0, mA: 2, sec: 30, measured: '', last: null })  // last = { ch, mA } of the last DC test
const rot = reactive({ layout: 'temporal', dir: 'ccw', dwellMs: 1000, mA: 2 })
</script>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { device, call, refresh, connect, disconnect } from '../ble/device.js'
import { fetchKp } from '../lib/noaa.js'
import { LAYOUTS } from '../lib/layouts.js'
import { fmtDuration } from '../lib/format.js'
import { goSafety } from '../lib/nav.js'
import { unitLabel, toDisplay, fromDisplay } from '../lib/units.js'
import FirmwareInstall from '../components/FirmwareInstall.vue'

const s = ref(null)  // editable copy of the settings
watch(() => device.settings, (v) => (s.value = v ? JSON.parse(JSON.stringify(v)) : null), { immediate: true })

const kpManual = ref('')
const test = computed(() => (device.status?.test && device.status.state !== 'idle' ? device.status : null))
// Coil and current the measured field belongs to: the last DC test, else the form.
const target = computed(() => cal.last ?? { ch: cal.ch, mA: Math.abs(Number(cal.mA)) })

// Result of the last action, shown as a toast so it is seen wherever the button is.
const toast = ref(null)  // { text, bad }
let timer = 0
function flash(text, bad = false) {
  toast.value = { text, bad }
  clearTimeout(timer)
  timer = setTimeout(() => (toast.value = null), bad ? 6000 : 3500)
}
onBeforeUnmount(() => clearTimeout(timer))

async function run(fn, ok) {
  toast.value = null
  try {
    await fn()
    if (ok) flash(ok)
  } catch (e) {
    flash(e.message, true)
    if (/safety/.test(e.message)) goSafety('helmet')
  }
}

const dcTest = (sign) => run(async () => {
  const ch = cal.ch
  const mA = Math.abs(Number(cal.mA))
  await call('test', { mode: 'dc', channel: ch, mA: sign * mA, seconds: Number(cal.sec) })
  cal.last = { ch, mA }
})
const rotTest = () => run(() => {
  device.testLayout = rot.layout
  return call('test', { mode: 'rotate', ...rot, mA: Number(rot.mA), dwellMs: Number(rot.dwellMs), seconds: 30 })
})
const stopTest = () => run(() => call('session.stop'))

// Field inputs show the chosen unit (µT or mG); the helmet stores µT.
const disp = (uT) => (uT === '' || uT == null ? '' : Number(toDisplay(Number(uT)).toPrecision(6)))
const fromInput = (v) => (v === '' ? '' : Number(Number(fromDisplay(Number(v))).toPrecision(6)))
const step = (uTStep) => toDisplay(uTStep)

function applyMeasured() {
  const { ch, mA } = target.value
  const b = fromDisplay(Number(cal.measured))
  if (!(mA > 0 && b > 0)) return flash('Enter the test current and the measured field.', true)
  s.value.uTperMA[ch] = Number((b / mA).toFixed(3))
  flash(`CH${ch + 1}: ${disp(s.value.uTperMA[ch])} ${unitLabel()}/mA. Save to keep it.`)
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

// env.set returns the new environment. A full refresh() would also reload the
// settings and wipe unsaved edits in this form.
const updateKp = () => run(async () => {
  device.kp = await fetchKp()
  device.info.env = await call('env.set', { kp: device.kp.kp, ap: device.kp.ap, source: 'noaa' })
}, 'Kp updated from NOAA.')

const setKp = () => run(async () => {
  const kp = kpManual.value
  if (kp === '' || kp == null || !(Number(kp) >= 0 && Number(kp) <= 9)) throw new Error('Enter a Kp between 0 and 9.')
  device.info.env = await call('env.set', { kp: Number(kp), source: 'manual' })
}, 'Kp set.')
</script>

<template>
  <div class="page">
    <header class="card helmet-head">
      <h2>Helmet</h2>
      <p class="small muted">Connection and safety, calibration, the wiring check, the helmet's settings and its firmware.</p>
      <div class="status">
        <div class="status-row">
          <span class="mark" :class="device.kind ? 'ok' : 'bad'" aria-hidden="true">{{ device.kind ? '✓' : '✕' }}</span>
          <span v-if="device.kind">{{ device.kind === 'demo' ? 'Demo: no helmet, nothing is switched on' : `Connected: ${device.name} (${device.kind === 'usb' ? 'USB' : 'Bluetooth'})` }}</span>
          <span v-else>Not connected. Connect the helmet (or the demo) to change its settings.</span>
          <span class="acts">
            <template v-if="!device.kind">
              <button class="btn primary sm" :disabled="!device.bluetooth || device.connecting" @click="connect('ble')">{{ device.connecting ? 'Connecting…' : 'Bluetooth' }}</button>
              <button v-if="device.serial" class="btn sm" :disabled="device.connecting" @click="connect('usb')">USB</button>
              <button class="btn ghost sm" @click="connect('demo')">Demo</button>
            </template>
            <button v-else-if="!device.status || device.status.state === 'idle'" class="btn ghost sm" @click="disconnect">Disconnect</button>
          </span>
        </div>
        <div class="status-row">
          <span class="mark" :class="device.info?.safetyAccepted ? 'ok' : 'warn'" aria-hidden="true">{{ device.info?.safetyAccepted ? '✓' : '!' }}</span>
          <span>{{ !device.info ? 'Safety page: connect to see whether it is accepted on this helmet' : device.info.safetyAccepted ? 'Safety page accepted on this helmet' : 'Safety page not accepted: the helmet will not start a field' }}</span>
          <span class="acts"><a class="btn sm" :class="{ primary: device.info && !device.info.safetyAccepted }" href="#safety/helmet">{{ device.info?.safetyAccepted ? 'Read it again' : 'Read and accept' }}</a></span>
        </div>
      </div>
    </header>

    <template v-if="s">
      <section class="card">
        <h2>Calibration</h2>
        <p class="small muted">Drive one coil with DC and measure the field 20 mm in front of its face, on its axis: phone magnetometer (phyphox) or an I2C sensor. Subtract the reading with the coil off. Reverse polarity to check the sign. <a href="#docs/calibration">The calibration guide</a> has the details.</p>
        <div class="grid2">
          <label class="field">Coil
            <select v-model.number="cal.ch"><option v-for="i in 8" :key="i" :value="i - 1">CH{{ i }}</option></select>
          </label>
          <label class="field">Current (mA, max 4.5)<input v-model="cal.mA" type="number" step="0.1" min="0.1" max="4.5" /></label>
          <label class="field">Seconds<input v-model="cal.sec" type="number" min="5" max="120" /></label>
        </div>
        <div class="row">
          <button class="btn" @click="dcTest(1)">Start DC test</button>
          <button class="btn ghost" @click="dcTest(-1)">Reversed polarity</button>
        </div>
        <p v-if="test?.sessionId === 'test-dc'" class="row small">
          <span><b>{{ test.sessionName }}</b>, {{ fmtDuration(test.totalMs - test.programMs) }} left. Measure now and enter the reading below.</span>
          <button class="btn sm ghost" :disabled="test.state === 'stopping'" @click="stopTest">Stop test</button>
        </p>
        <div class="grid2">
          <label class="field">Measured field, on minus off ({{ unitLabel() }})<input v-model="cal.measured" type="number" :step="step(0.01)" /></label>
          <div class="row" style="align-items: end"><button class="btn" @click="applyMeasured">Use for CH{{ target.ch + 1 }} ({{ target.mA }} mA)</button></div>
        </div>
        <div class="cal">
          <label v-for="i in 8" :key="i" class="field">CH{{ i }} {{ unitLabel() }}/mA<input :value="disp(s.uTperMA[i - 1])" type="number" :step="step(0.01)" @change="s.uTperMA[i - 1] = fromInput($event.target.value)" /></label>
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
        <p v-if="test?.sessionId === 'test-rotate'" class="row small">
          <span><b>{{ test.sessionName }}</b>, {{ fmtDuration(test.totalMs - test.programMs) }} left. The session bar at the top shows which coil is on.</span>
          <button class="btn sm ghost" :disabled="test.state === 'stopping'" @click="stopTest">Stop test</button>
        </p>
      </section>

      <section class="card">
        <h2>Settings</h2>
        <div class="grid2">
          <label class="field">Series resistor (Ω)<input v-model.number="s.seriesOhm" type="number" /></label>
          <label class="field">Coil resistance (Ω)<input v-model.number="s.coilOhm" type="number" step="0.1" /></label>
          <label class="field">Module full scale (V)<input v-model.number="s.vFullScale" type="number" step="0.1" /></label>
          <label class="field">Max field at 20 mm ({{ unitLabel() }}, at most {{ disp(10) }})<input :value="disp(s.maxFieldUT)" type="number" :step="step(0.1)" @change="s.maxFieldUT = fromInput($event.target.value)" /></label>
          <label class="field">Default field ({{ unitLabel() }})<input :value="disp(s.defaultFieldUT)" type="number" :step="step(0.1)" @change="s.defaultFieldUT = fromInput($event.target.value)" /></label>
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
          <input v-model="kpManual" type="number" step="0.33" min="0" max="9" placeholder="Kp 0–9" aria-label="Kp by hand (0–9)" style="max-width: 120px" @keyup.enter="setKp" />
          <button class="btn sm ghost" :disabled="kpManual === '' || kpManual == null" @click="setKp">Set by hand</button>
        </div>
        <p class="small muted">Kp, ap and sidereal time are recorded with every session and trial. They are never used to schedule sessions; the reported effects did not replicate.</p>
      </section>
    </template>

    <FirmwareInstall />

    <div class="toasts" aria-live="polite">
      <p v-if="toast" class="small" :class="toast.bad ? 'bad' : 'ok'">{{ toast.text }}</p>
    </div>
  </div>
</template>

<style scoped>
.cal { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; }
.toasts { position: fixed; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 20; width: max-content; max-width: calc(100vw - 32px); }
.toasts p { padding: 10px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 10px 30px rgba(0, 0, 0, .25); }
@media (max-width: 520px) { .cal { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.helmet-head { gap: 10px; }
.status { display: grid; gap: 8px; }
.status-row { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 10px; align-items: center; font-size: 14px; }
.status-row .mark { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font: 700 12px var(--font-body); border: 1.5px solid currentColor; }
.mark.ok { color: var(--ok); } .mark.warn { color: var(--warn); } .mark.bad { color: var(--bad); }
.acts { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
@media (max-width: 560px) {
  .status-row { grid-template-columns: 22px minmax(0, 1fr); }
  .status-row .acts { grid-column: 2; justify-content: flex-start; }
}
</style>
