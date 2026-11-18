<script>
// Coil check with a phone magnetometer (src/lib/coilcheck.js). Results and the phone's address live at module level,
// so they survive the remount on every tab change.
import { reactive } from 'vue'
const ADDR_KEY = 'coilcheck.phone'
function loadAddr() {
  try { return localStorage.getItem(ADDR_KEY) ?? '' } catch { return '' }
}
const state = reactive({
  addr: loadAddr(),
  mode: 'sensor',  // "sensor": coil on the phone's sensor spot; "spacer": 20 mm on its axis
  mA: 4,
  results: { sensor: Array(8).fill(null), spacer: Array(8).fill(null) },
  // signal check: one coil plays a sine at a set intensity (µT, peak at 20 mm); newest result first
  signal: { ch: 0, hz: 7, uT: 5 },
  signals: [],
})
</script>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { device, call, refresh, connected, running, maxFieldUT } from '../ble/device.js'
import { unitLabel, toDisplay, fromDisplay } from '../lib/units.js'
import {
  BLINK_HZ, TEST_SECONDS, MIN_SNR, SIGNAL_SECONDS, SIGNAL_HZ, phoneAddress, getQuery, parseGet, fitCoil, fitSine, verdict,
  polarity, signalProgram, toCsv,
} from '../lib/coilcheck.js'

const props = defineProps({ testMax: { type: Number, default: 4.5 } })

// ---- the phone: phyphox remote access through the dev server's /phyphox proxy (vite.config.js) ----
const live = ref(false)
const phoneError = ref('')
const latest = ref(null)  // { x, y, z, b, accuracy }
const samples = { t: [], x: [], y: [], z: [] }  // phone time (s) and µT; the last two minutes
let lastT = null
let offsetS = Infinity  // app time minus phone time (s): the smallest seen, the poll with the least delay
let pollTimer = 0

const base = () => `/phyphox/${encodeURIComponent(phoneAddress(state.addr))}`

async function phone(path) {
  const r = await fetch(`${base()}/${path}`, { cache: 'no-store' })
  const text = await r.text()
  if (!r.ok) throw new Error(text || `phone: HTTP ${r.status}`)
  return JSON.parse(text)
}

async function poll() {
  try {
    const got = parseGet(await phone(`get?${getQuery(lastT)}`))
    const now = Date.now() / 1000
    if (got.t.length) {
      if (lastT !== null && got.t[0] < lastT - 1) {
        // phyphox was cleared or restarted: a new time base
        for (const k of ['t', 'x', 'y', 'z']) samples[k].length = 0
        offsetS = Infinity
      }
      for (let i = 0; i < got.t.length; i++) {
        if (lastT !== null && got.t[i] <= lastT) continue
        for (const k of ['t', 'x', 'y', 'z']) samples[k].push(got[k][i])
      }
      lastT = samples.t.length ? samples.t[samples.t.length - 1] : lastT
      offsetS = Math.min(offsetS, now - lastT)
      const keepFrom = samples.t.findIndex((t) => t >= lastT - 120)
      if (keepFrom > 0) for (const k of ['t', 'x', 'y', 'z']) samples[k].splice(0, keepFrom)
      const i = samples.t.length - 1
      const [x, y, z] = [samples.x[i], samples.y[i], samples.z[i]]
      latest.value = { x, y, z, b: Math.hypot(x, y, z), accuracy: got.accuracy }
    }
    phoneError.value = got.measuring ? '' : 'phyphox is not measuring: press its play button (or Connect again).'
  } catch (e) {
    phoneError.value = e.message
  }
  if (live.value) pollTimer = setTimeout(poll, 400)
}

async function connectPhone() {
  const addr = phoneAddress(state.addr)
  if (!addr) {
    phoneError.value = 'Enter the address phyphox shows under remote access, e.g. 192.168.1.20:8080.'
    return
  }
  state.addr = addr
  try { localStorage.setItem(ADDR_KEY, addr) } catch { /* private mode: not remembered */ }
  phoneError.value = ''
  lastT = null
  offsetS = Infinity
  for (const k of ['t', 'x', 'y', 'z']) samples[k].length = 0
  try {
    const first = parseGet(await phone(`get?${getQuery()}`))
    if (!first.measuring) await phone('control?cmd=start')
  } catch (e) {
    phoneError.value = e.message
    return
  }
  live.value = true
  poll()
}

function disconnectPhone() {
  live.value = false
  clearTimeout(pollTimer)
  latest.value = null
}

// ---- one coil at a time ----
const busy = ref(null)  // channel being measured
const left = ref(0)
let cancelled = false
let tick = 0

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const results = computed(() => state.results[state.mode])
const next = computed(() => {
  const i = results.value.findIndex((r) => !r)
  return i < 0 ? 0 : i
})
const refFit = computed(() => results.value.find((r) => r && r.snr >= 8) ?? null)
const sigBusy = ref(false)
const anyBusy = computed(() => busy.value !== null || sigBusy.value)
const canMeasure = computed(() => live.value && !phoneError.value && connected() && !anyBusy.value)
const canPlay = computed(() => canMeasure.value && !running())
const message = ref('')

async function measure(ch) {
  if (!canMeasure.value) return
  const mA = Math.min(Math.abs(Number(state.mA)) || 0, props.testMax)
  if (!(mA > 0)) {
    message.value = 'Enter a test current.'
    return
  }
  busy.value = ch
  cancelled = false
  message.value = ''
  state.results[state.mode][ch] = null
  try {
    const sent = Date.now() / 1000
    await call('test', { mode: 'led', channel: ch, mA, blinkHz: BLINK_HZ, seconds: TEST_SECONDS })
    const startPhone = (sent + Date.now() / 1000) / 2 - offsetS
    const until = Date.now() + (TEST_SECONDS + 1.5) * 1000
    tick = setInterval(() => (left.value = Math.max(0, Math.ceil((until - Date.now()) / 1000))), 250)
    while (Date.now() < until && !cancelled) await sleep(200)
    if (cancelled) return
    const fit = fitCoil(window(startPhone - 1, startPhone + TEST_SECONDS + 1), { startS: startPhone, mA })
    state.results[state.mode][ch] = fit ?? { failed: true }
    if (!fit) message.value = 'No phone readings during the test: is phyphox still measuring and the phone awake?'
  } catch (e) {
    message.value = e.message
  } finally {
    clearInterval(tick)
    busy.value = null
  }
}

// The phone's readings from phone time a to b.
function window(a, b) {
  const win = { t: [], x: [], y: [], z: [] }
  samples.t.forEach((t, i) => {
    if (t < a || t > b) return
    for (const k of ['t', 'x', 'y', 'z']) win[k].push(samples[k][i])
  })
  return win
}

// Signal check: a one-coil sine program at the set intensity, the sine's peak fitted to the phone's readings.
async function playSignal() {
  if (!canPlay.value) return
  const ch = Number(state.signal.ch)
  const hz = Number(state.signal.hz)
  const uT = Math.min(Number(state.signal.uT) || 0, maxFieldUT())
  if (!(uT > 0)) {
    message.value = 'Enter an intensity.'
    return
  }
  sigBusy.value = true
  cancelled = false
  message.value = ''
  try {
    const session = signalProgram({ channel: ch, hz, uT })
    const sent = Date.now() / 1000
    await call('session.start', { session, presetId: session.id, fieldUT: uT, blind: false })
    const startPhone = (sent + Date.now() / 1000) / 2 - offsetS
    const until = Date.now() + (SIGNAL_SECONDS + 1.5) * 1000
    tick = setInterval(() => (left.value = Math.max(0, Math.ceil((until - Date.now()) / 1000))), 250)
    while (Date.now() < until && !cancelled) await sleep(200)
    if (cancelled) return
    const fit = fitSine(window(startPhone - 1, startPhone + SIGNAL_SECONDS + 1), { startS: startPhone, hz })
    state.signals.unshift({ ch, hz, setUT: uT, fit, perMA: device.settings?.uTperMA?.[ch] ?? null })
    if (!fit) message.value = 'No phone readings during the signal: is phyphox still measuring and the phone awake?'
  } catch (e) {
    message.value = e.message
  } finally {
    clearInterval(tick)
    sigBusy.value = false
  }
}

const signalText = (r) => {
  if (!r.fit) return 'no readings'
  if (r.fit.snr < MIN_SNR) return 'no sine found: is the coil 20 mm from the sensor, centred?'
  return `${Math.round((r.fit.amp / r.setUT) * 100)} % of the set value`
}
// With the coil 20 mm from the sensor, the reading over the set value scales the coil's µT/mA.
const impliedPerMA = (r) => (r.fit && r.fit.snr >= MIN_SNR && r.perMA ? (r.perMA * r.fit.amp) / r.setUT : null)

async function cancel() {
  cancelled = true
  try { await call('session.stop') } catch { /* the test may have ended already */ }
}

// ---- what the results mean ----
const shown = (r) => (r && !r.failed ? r : null)
const verdictOf = (r) => verdict(shown(r), state.mode)
const fmt = (uT, digits = 2) => (uT === null || uT === undefined ? '' : toDisplay(uT).toFixed(digits))
const direction = (r) => {
  const f = shown(r)
  if (!f || f.snr < 8) return ''
  const pol = polarity(f, refFit.value)
  const ref = refFit.value ? state.results[state.mode].indexOf(refFit.value) + 1 : 0
  return `${f.sign > 0 ? '+' : '−'}${f.axis}${pol ? ` (${pol === 'same' ? `same as CH${ref}` : pol === 'reversed' ? `reversed against CH${ref}` : 'placed differently?'})` : ''}`
}
const accuracyText = computed(() => {
  const a = latest.value?.accuracy
  return a === 3 ? 'calibrated sensor' : a === null || a === undefined ? '' : 'raw or unreliable sensor (fine: only on minus off counts)'
})
const anyFit = computed(() => results.value.some((r) => shown(r)))

const store = async () => {
  const values = [...(device.settings?.uTperMA ?? Array(8).fill(1.8))]
  const done = []
  results.value.forEach((r, ch) => {
    const f = shown(r)
    if (f && verdict(f, 'spacer').ok !== false && f.perMA) {
      values[ch] = Number(f.perMA.toFixed(3))
      done.push(`CH${ch + 1}`)
    }
  })
  if (!done.length) return (message.value = 'No coil measured on the 20 mm spacer yet.')
  try {
    await call('settings.set', { uTperMA: values, calibrated: true })
    await refresh()
    message.value = `Stored for ${done.join(', ')}.`
  } catch (e) {
    message.value = e.message
  }
}

function downloadCsv() {
  const fits = results.value.map(shown)
  const url = URL.createObjectURL(new Blob([toCsv(fits)], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `coil-check-${state.mode}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

const clearResults = () => (state.results[state.mode] = Array(8).fill(null))

onBeforeUnmount(() => {
  disconnectPhone()
  clearInterval(tick)
})
</script>

<template>
  <section class="card">
    <h2>Coil check with your phone</h2>
    <p class="small muted">
      Your phone's magnetometer measures each coil in turn: open phyphox's "Magnetometer" with remote access on (raw data
      is fine), keep the phone flat and still, and lay one coil at a time on it. The helmet drives the coil +, pause, −,
      pause for {{ TEST_SECONDS }} s, and the app fits that pattern to the phone's readings, which cancels Earth's field
      and drift. Works only in the local app (<code>npm run dev</code>): a page from the web cannot read a phone over
      plain http.
    </p>
    <div class="grid2">
      <label class="field">Phone address (phyphox remote access)
        <input v-model="state.addr" placeholder="192.168.1.20:8080" :disabled="live" />
      </label>
      <div class="row" style="align-items: end">
        <button v-if="!live" class="btn" @click="connectPhone">Connect phone</button>
        <button v-else class="btn ghost" @click="disconnectPhone">Disconnect phone</button>
      </div>
    </div>
    <p v-if="phoneError" class="small bad">{{ phoneError }}</p>
    <p v-else-if="latest" class="small">
      Phone now: {{ fmt(latest.b, 1) }} {{ unitLabel() }} (x {{ fmt(latest.x, 1) }}, y {{ fmt(latest.y, 1) }}, z {{ fmt(latest.z, 1) }}), {{ accuracyText }}.
      Earth alone gives about 45–48 µT on a calibrated sensor.
    </p>

    <div class="grid2">
      <label class="field">Where the coil is
        <select v-model="state.mode" :disabled="anyBusy">
          <option value="sensor">On the phone's sensor spot: does each coil work?</option>
          <option value="spacer">20 mm from the sensor, on its axis: µT/mA for the calibration</option>
        </select>
      </label>
      <label class="field">Test current (mA, max {{ testMax }})
        <input v-model="state.mA" type="number" step="0.1" min="0.5" :max="testMax" :disabled="anyBusy" />
      </label>
    </div>
    <p class="small muted">
      <template v-if="state.mode === 'sensor'">Find the sensor spot first, where a coil gives the largest reading: tens of µT at a few mA (the sensor sits about 1 cm inside the phone). Lay every coil the same way up, so their directions can be compared.</template>
      <template v-else>Put the coil's face 20 mm from the sensor chip, centred over it. The chip sits about 1 cm inside the phone, so that is about 10 mm of spacer (coins, a block of wood) between the coil and the phone.</template>
    </p>

    <div class="row">
      <button class="btn primary" :disabled="!canMeasure" @click="measure(next)">Measure CH{{ next + 1 }}</button>
      <template v-if="busy !== null">
        <span class="small">CH{{ busy + 1 }}: {{ left }} s left. Keep the phone and the coil still.</span>
        <button class="btn sm ghost" @click="cancel">Stop</button>
      </template>
      <span v-else-if="!connected()" class="small muted">Connect the helmet first.</span>
    </div>
    <p v-if="message" class="small">{{ message }}</p>

    <table class="coil-check">
      <thead>
        <tr><th>Coil</th><th>Result</th><th>Field ({{ unitLabel() }})</th><th>{{ unitLabel() }}/mA</th><th>Direction on the phone</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="(r, ch) in results" :key="ch">
          <td>CH{{ ch + 1 }}</td>
          <td :class="r ? (verdictOf(r).ok === true ? 'good' : verdictOf(r).ok === false ? 'bad' : 'warn') : 'muted'">{{ r ? verdictOf(r).text : 'not measured' }}</td>
          <td>{{ shown(r) ? `${fmt(shown(r).amp)} ± ${fmt(shown(r).se)}` : '' }}</td>
          <td>{{ shown(r) && shown(r).snr >= 8 ? fmt(shown(r).perMA, 3) : '' }}</td>
          <td>{{ direction(r) }}</td>
          <td><button class="btn sm ghost" :disabled="!canMeasure" @click="measure(ch)">{{ r ? 'Again' : 'Measure' }}</button></td>
        </tr>
      </tbody>
    </table>

    <div class="row">
      <button v-if="state.mode === 'spacer'" class="btn" :disabled="!anyFit || anyBusy || !connected()" @click="store">Store µT/mA in the helmet</button>
      <button class="btn ghost" :disabled="!anyFit" @click="downloadCsv">Download CSV</button>
      <button class="btn ghost" :disabled="!anyFit || anyBusy" @click="clearResults">Clear</button>
    </div>

    <h3>Signal check: does the set {{ unitLabel() }} arrive?</h3>
    <p class="small muted">
      Plays a sine on one coil at the intensity you set, as a program does: the set value is the sine's peak 20 mm from
      the coil's face. The app fits that sine to the phone's readings and shows how much of it arrived. Put the coil's
      face 20 mm from the sensor chip, centred over it (about 10 mm of spacer on the phone). Each run is a
      {{ SIGNAL_SECONDS }} s session in the helmet's log.
    </p>
    <div class="grid2">
      <label class="field">Coil
        <select v-model.number="state.signal.ch" :disabled="anyBusy"><option v-for="i in 8" :key="i" :value="i - 1">CH{{ i }}</option></select>
      </label>
      <label class="field">Sine frequency
        <select v-model.number="state.signal.hz" :disabled="anyBusy"><option v-for="f in SIGNAL_HZ" :key="f" :value="f">{{ f }} Hz</option></select>
      </label>
      <label class="field">Intensity at 20 mm ({{ unitLabel() }}, max {{ fmt(maxFieldUT(), 1) }})
        <input :value="Number(toDisplay(state.signal.uT).toPrecision(4))" type="number" step="any" min="0" :disabled="anyBusy"
          @change="state.signal.uT = Number(fromDisplay(Number($event.target.value)))" />
      </label>
    </div>
    <div class="row">
      <button class="btn primary" :disabled="!canPlay" @click="playSignal">Play and measure</button>
      <template v-if="sigBusy">
        <span class="small">CH{{ state.signal.ch + 1 }}, {{ state.signal.hz }} Hz: {{ left }} s left. Keep the phone and the coil still.</span>
        <button class="btn sm ghost" @click="cancel">Stop</button>
      </template>
      <span v-else-if="connected() && running() && busy === null" class="small muted">A session is running on the helmet.</span>
    </div>
    <table v-if="state.signals.length" class="coil-check">
      <thead>
        <tr><th>Coil</th><th>Signal</th><th>Set ({{ unitLabel() }})</th><th>Measured ({{ unitLabel() }})</th><th>Result</th><th>{{ unitLabel() }}/mA in the helmet → from this reading</th></tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in state.signals" :key="i">
          <td>CH{{ r.ch + 1 }}</td>
          <td>{{ r.hz }} Hz sine</td>
          <td>{{ fmt(r.setUT) }}</td>
          <td>{{ r.fit ? `${fmt(r.fit.amp)} ± ${fmt(r.fit.se)}` : '' }}</td>
          <td :class="r.fit && r.fit.snr >= MIN_SNR ? '' : 'bad'">{{ signalText(r) }}</td>
          <td>{{ impliedPerMA(r) !== null ? `${fmt(r.perMA, 3)} → ${fmt(impliedPerMA(r), 3)}` : '' }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="state.signals.length" class="row">
      <button class="btn ghost" :disabled="sigBusy" @click="state.signals = []">Clear signal results</button>
    </div>
  </section>
</template>

<style scoped>
.coil-check { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
.coil-check th, .coil-check td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: middle; }
.coil-check th { color: var(--muted); font-weight: 600; }
.good { color: var(--good, #2e9d6a); }
.bad { color: var(--bad); }
.warn { color: var(--warn, #c08a1e); }
@media (max-width: 640px) {
  .coil-check th:nth-child(5), .coil-check td:nth-child(5) { display: none; }
}
</style>
