<script lang="ts">
// Coil check with a phone magnetometer (core/lib/coilcheck.js). Results and the
// phone's address live at module level, so they survive a change of tab.
import { reactive } from 'vue'
import { unitLabel, toDisplay, fromDisplay } from '#core/lib/units.js'
import * as cc from '#core/lib/coilcheck.js'
import { device, call, start, refresh, connected, running, maxFieldUT, errorMessage } from '~/lib/device'
import { loadDraft } from '~/lib/helmet'

interface Fit {
  vector: number[], amp: number, se: number, snr: number, axis: 'x' | 'y' | 'z', sign: number
  perMA: number | null, perMASe: number | null, tau: number, n: number, mA: number
}
interface SineFit { amp: number, se: number, snr: number }
type Result = Fit | { failed: true } | null
type Mode = 'sensor' | 'spacer'
interface SignalRun { ch: number, hz: number, setUT: number, fit: SineFit | null, perMA: number | null }

const ADDR_KEY = 'coilcheck.phone'
function loadAddr() {
  try {
    return localStorage.getItem(ADDR_KEY) ?? ''
  } catch {
    return ''
  }
}
const empty = (): Result[] => Array.from({ length: 8 }, () => null)
const state = reactive({
  addr: import.meta.client ? loadAddr() : '',
  /** "sensor": the coil on the phone's sensor spot; "spacer": 20 mm from the sensor, on its axis. */
  mode: 'sensor' as Mode,
  mA: 4 as number | string,
  results: { sensor: empty(), spacer: empty() } as Record<Mode, Result[]>,
  /** Signal check: one coil plays a sine at a set intensity (µT, peak at 20 mm); newest result first. */
  signal: { ch: 0, hz: 7, uT: 5 },
  signals: [] as SignalRun[],
})
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{ testMax?: number }>(), { testMax: 4.5 })

const TEST_SECONDS = cc.TEST_SECONDS as number
const SIGNAL_SECONDS = cc.SIGNAL_SECONDS as number
const MIN_SNR = cc.MIN_SNR as number
const fitCoil = cc.fitCoil as (s: Samples, o: { startS: number, mA: number }) => Fit | null
const fitSine = cc.fitSine as (s: Samples, o: { startS: number, hz: number }) => SineFit | null
const verdict = cc.verdict as (fit: Fit | null, mode: Mode) => { ok: boolean | null, text: string }
const polarity = cc.polarity as (fit: Fit, ref: Fit | null) => '' | 'same' | 'reversed' | 'placed differently'
const phoneAddress = cc.phoneAddress as (input: string) => string | null
const parseGet = cc.parseGet as (json: unknown) => Samples & { accuracy: number | null, measuring: boolean }
const getQuery = cc.getQuery as (after?: number | null) => string
/** The helmet's µT per mA at 20 mm, per coil. */
const perMA = () => (device.settings as { uTperMA?: number[] } | null)?.uTperMA

const MODES = [
  { label: 'On the phone’s sensor spot: does each coil work?', value: 'sensor' },
  { label: '20 mm from the sensor, on its axis: µT/mA for the calibration', value: 'spacer' },
]
const COILS = Array.from({ length: 8 }, (_, i) => ({ label: `CH${i + 1}`, value: i }))
const FREQUENCIES = (cc.SIGNAL_HZ as number[]).map((f) => ({ label: `${f} Hz`, value: f }))

// ---------------------------------------------------------------- the phone
// phyphox's remote access, through the dev server's /phyphox route.
interface Samples { t: number[], x: number[], y: number[], z: number[] }
const KEYS = ['t', 'x', 'y', 'z'] as const
const live = ref(false)
const phoneError = ref('')
const latest = ref<{ x: number, y: number, z: number, b: number, accuracy: number | null } | null>(null)
/** Phone time (s) and µT: the last two minutes. */
const samples: Samples = { t: [], x: [], y: [], z: [] }
let lastT: number | null = null
/** App time minus phone time (s): the smallest seen, the poll with the least delay. */
let offsetS = Infinity
let pollTimer: ReturnType<typeof setTimeout> | undefined

const base = () => `/phyphox/${encodeURIComponent(phoneAddress(state.addr) ?? '')}`

async function phone(path: string) {
  const r = await fetch(`${base()}/${path}`, { cache: 'no-store' })
  const text = await r.text()
  if (!r.ok) throw new Error(text || `phone: HTTP ${r.status}`)
  return JSON.parse(text) as unknown
}
function forget() {
  for (const k of KEYS) samples[k].length = 0
  offsetS = Infinity
}

async function poll() {
  try {
    const got = parseGet(await phone(`get?${getQuery(lastT)}`))
    const now = Date.now() / 1000
    if (got.t.length) {
      // phyphox was cleared or restarted: a new time base
      if (lastT !== null && got.t[0]! < lastT - 1) forget()
      for (let i = 0; i < got.t.length; i++) {
        if (lastT !== null && got.t[i]! <= lastT) continue
        for (const k of KEYS) samples[k].push(got[k][i]!)
      }
      lastT = samples.t.at(-1) ?? lastT
      if (lastT !== null) {
        offsetS = Math.min(offsetS, now - lastT)
        const newest = lastT
        const keepFrom = samples.t.findIndex((t) => t >= newest - 120)
        if (keepFrom > 0) for (const k of KEYS) samples[k].splice(0, keepFrom)
      }
      const i = samples.t.length - 1
      if (i >= 0) {
        const [x, y, z] = [samples.x[i]!, samples.y[i]!, samples.z[i]!]
        latest.value = { x, y, z, b: Math.hypot(x, y, z), accuracy: got.accuracy }
      }
    }
    phoneError.value = got.measuring ? '' : 'phyphox is not measuring: press its play button (or Connect again).'
  } catch (e) {
    phoneError.value = errorMessage(e)
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
  try {
    localStorage.setItem(ADDR_KEY, addr)
  } catch {
    // private mode: not remembered
  }
  phoneError.value = ''
  lastT = null
  forget()
  try {
    const first = parseGet(await phone(`get?${getQuery()}`))
    if (!first.measuring) await phone('control?cmd=start')
  } catch (e) {
    phoneError.value = errorMessage(e)
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

// ---------------------------------------------------------------- one coil at a time
const busy = ref<number | null>(null)
const sigBusy = ref(false)
const left = ref(0)
const message = ref('')
let cancelled = false
let tick: ReturnType<typeof setInterval> | undefined

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const shown = (r: Result): Fit | null => (r && !('failed' in r) ? r : null)
const results = computed(() => state.results[state.mode])
const next = computed(() => Math.max(0, results.value.findIndex((r) => !r)))
const refFit = computed(() => results.value.map(shown).find((f) => f && f.snr >= MIN_SNR) ?? null)
const anyBusy = computed(() => busy.value !== null || sigBusy.value)
const canMeasure = computed(() => live.value && !phoneError.value && connected() && !anyBusy.value)
const canPlay = computed(() => canMeasure.value && !running())
const anyFit = computed(() => results.value.some((r) => shown(r)))

/** The phone's readings from phone time a to b. */
function between(a: number, b: number): Samples {
  const win: Samples = { t: [], x: [], y: [], z: [] }
  samples.t.forEach((t, i) => {
    if (t < a || t > b) return
    for (const k of KEYS) win[k].push(samples[k][i]!)
  })
  return win
}
/** Waits for a test of `seconds`, counting down; false when it was stopped. */
async function wait(seconds: number) {
  const until = Date.now() + (seconds + 1.5) * 1000
  tick = setInterval(() => (left.value = Math.max(0, Math.ceil((until - Date.now()) / 1000))), 250)
  while (Date.now() < until && !cancelled) await sleep(200)
  return !cancelled
}

async function measure(ch: number) {
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
    await start('test', { mode: 'led', channel: ch, mA, blinkHz: cc.BLINK_HZ, seconds: TEST_SECONDS })
    const startPhone = (sent + Date.now() / 1000) / 2 - offsetS
    if (!(await wait(TEST_SECONDS))) return
    const fit = fitCoil(between(startPhone - 1, startPhone + TEST_SECONDS + 1), { startS: startPhone, mA })
    state.results[state.mode][ch] = fit ?? { failed: true }
    if (!fit) message.value = 'No phone readings during the test: is phyphox still measuring and the phone awake?'
  } catch (e) {
    message.value = errorMessage(e)
  } finally {
    clearInterval(tick)
    busy.value = null
  }
}

// Signal check: a one-coil sine program at the set intensity, the sine's peak fitted to the phone's readings.
async function playSignal() {
  if (!canPlay.value) return
  const { ch, hz } = state.signal
  const uT = Math.min(Number(state.signal.uT) || 0, maxFieldUT())
  if (!(uT > 0)) {
    message.value = 'Enter an intensity.'
    return
  }
  sigBusy.value = true
  cancelled = false
  message.value = ''
  try {
    const session = cc.signalProgram({ channel: ch, hz, uT }) as { id: string }
    const sent = Date.now() / 1000
    await start('session.start', { session, presetId: session.id, fieldUT: uT, blind: false })
    const startPhone = (sent + Date.now() / 1000) / 2 - offsetS
    if (!(await wait(SIGNAL_SECONDS))) return
    const fit = fitSine(between(startPhone - 1, startPhone + SIGNAL_SECONDS + 1), { startS: startPhone, hz })
    state.signals.unshift({ ch, hz, setUT: uT, fit, perMA: perMA()?.[ch] ?? null })
    if (!fit) message.value = 'No phone readings during the signal: is phyphox still measuring and the phone awake?'
  } catch (e) {
    message.value = errorMessage(e)
  } finally {
    clearInterval(tick)
    sigBusy.value = false
  }
}

async function cancel() {
  cancelled = true
  try {
    await call('session.stop')
  } catch {
    // the test may have ended already
  }
}

// ---------------------------------------------------------------- what the results mean
const verdictOf = (r: Result) => verdict(shown(r), state.mode)
const TONE = { true: 'text-success', false: 'text-error', null: 'text-warning' } as const
const tone = (r: Result) => (r ? TONE[String(verdictOf(r).ok) as keyof typeof TONE] : 'text-muted')
const fmt = (uT: number | null | undefined, digits = 2) => (uT == null ? '' : (toDisplay(uT) as number).toFixed(digits))
function direction(r: Result) {
  const f = shown(r)
  if (!f || f.snr < MIN_SNR) return ''
  const ref = refFit.value
  const pol = polarity(f, ref)
  const refCh = ref ? results.value.indexOf(ref) + 1 : 0
  const how = pol === 'same' ? `same as CH${refCh}` : pol === 'reversed' ? `reversed against CH${refCh}` : 'placed differently?'
  return `${f.sign > 0 ? '+' : '−'}${f.axis}${pol ? ` (${how})` : ''}`
}
const accuracyText = computed(() => {
  const a = latest.value?.accuracy
  return a === 3 ? 'calibrated sensor' : a == null ? '' : 'raw or unreliable sensor (fine: only on minus off counts)'
})
function signalText(r: SignalRun) {
  if (!r.fit) return 'no readings'
  if (r.fit.snr < MIN_SNR) return 'no sine found: is the coil 20 mm from the sensor, centred?'
  return `${Math.round((r.fit.amp / r.setUT) * 100)} % of the set value`
}
// With the coil 20 mm from the sensor, the reading over the set value scales the coil's µT/mA.
const impliedPerMA = (r: SignalRun) => (r.fit && r.fit.snr >= MIN_SNR && r.perMA ? (r.perMA * r.fit.amp) / r.setUT : null)

async function store() {
  const values = [...(perMA() ?? Array.from({ length: 8 }, () => 1.8))]
  const done: string[] = []
  results.value.forEach((r, ch) => {
    const f = shown(r)
    if (f && verdict(f, 'spacer').ok !== false && f.perMA) {
      values[ch] = Number(f.perMA.toFixed(3))
      done.push(`CH${ch + 1}`)
    }
  })
  if (!done.length) {
    message.value = 'No coil measured on the 20 mm spacer yet.'
    return
  }
  try {
    await call('settings.set', { uTperMA: values, calibrated: true })
    await refresh()
    loadDraft() // the Calibration form above shows what the helmet has now
    message.value = `Stored for ${done.join(', ')}.`
  } catch (e) {
    message.value = errorMessage(e)
  }
}

function downloadCsv() {
  const url = URL.createObjectURL(new Blob([cc.toCsv(results.value.map(shown)) as string], { type: 'text/csv' }))
  Object.assign(document.createElement('a'), { href: url, download: `coil-check-${state.mode}.csv` }).click()
  URL.revokeObjectURL(url)
}
const clearResults = () => (state.results[state.mode] = empty())
const setSignalField = (e: Event) => (state.signal.uT = Number(fromDisplay(Number((e.target as HTMLInputElement).value))))

onBeforeUnmount(() => {
  disconnectPhone()
  clearInterval(tick)
})
</script>

<template>
  <section class="panel grid grid-cols-1 gap-5 p-5 sm:p-7" aria-labelledby="helmet-coil-check">
    <div class="grid grid-cols-1 gap-2">
      <h2 id="helmet-coil-check" class="text-2xl">Coil check with your phone</h2>
      <p class="measure text-sm text-muted">
        Your phone's magnetometer measures each coil in turn: open phyphox's “Magnetometer” with remote access on (raw data is fine), keep the phone flat and still, and lay one coil at a time on it.
        The helmet drives the coil +, pause, −, pause for {{ TEST_SECONDS }} s, and the app fits that pattern to the phone's readings, which cancels Earth's field and drift.
        Only in the local app (<code>npm run dev</code>): a page from the web cannot read a phone over plain http.
      </p>
    </div>

    <div class="grid grid-cols-1 gap-3">
      <div class="grid grid-cols-1 items-end gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,22rem)_auto] sm:justify-start">
        <UFormField label="Phone address (phyphox remote access)">
          <UInput v-model="state.addr" placeholder="192.168.1.20:8080" :disabled="live" class="w-full" @keyup.enter="connectPhone" />
        </UFormField>
        <UButton v-if="!live" class="justify-self-start" icon="i-lucide-smartphone" @click="connectPhone">Connect phone</UButton>
        <UButton v-else class="justify-self-start" variant="outline" color="neutral" @click="disconnectPhone">Disconnect phone</UButton>
      </div>
      <p v-if="phoneError" class="text-sm text-error" role="status">{{ phoneError }}</p>
      <p v-else-if="latest" class="text-sm">
        Phone now: <b class="num">{{ fmt(latest.b, 1) }} {{ unitLabel() }}</b>
        <span class="num text-muted"> (x {{ fmt(latest.x, 1) }}, y {{ fmt(latest.y, 1) }}, z {{ fmt(latest.z, 1) }})</span><template v-if="accuracyText">, {{ accuracyText }}</template>.
        <span class="text-muted">Earth alone gives about 45–48 µT on a calibrated sensor.</span>
      </p>
    </div>

    <div class="grid grid-cols-1 gap-3 border-t border-default pt-5">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <UFormField label="Where the coil is">
          <USelect v-model="state.mode" :items="MODES" :disabled="anyBusy" class="w-full" />
        </UFormField>
        <UFormField :label="`Test current (mA, max ${testMax})`">
          <UInput v-model.number="state.mA" type="number" step="0.1" min="0.5" :max="testMax" :disabled="anyBusy" class="w-full" />
        </UFormField>
      </div>
      <p class="measure text-sm text-muted">
        <template v-if="state.mode === 'sensor'">Find the sensor spot first, where a coil gives the largest reading: tens of µT at a few mA (the sensor sits about 1 cm inside the phone). Lay every coil the same way up, so their directions can be compared.</template>
        <template v-else>Put the coil's face 20 mm from the sensor chip, centred over it. The chip sits about 1 cm inside the phone, so that is about 10 mm of spacer (coins, a block of wood) between the coil and the phone.</template>
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <UButton icon="i-lucide-play" :disabled="!canMeasure" @click="measure(next)">Measure CH{{ next + 1 }}</UButton>
        <template v-if="busy !== null">
          <span class="text-sm" role="status">CH{{ busy + 1 }}: <span class="num">{{ left }}</span> s left. Keep the phone and the coil still.</span>
          <UButton size="sm" color="error" @click="cancel">Stop</UButton>
        </template>
        <span v-else-if="!connected()" class="text-sm text-muted">Connect the helmet first.</span>
        <span v-else-if="!live" class="text-sm text-muted">Connect the phone first.</span>
      </div>
      <p v-if="message" class="text-sm" role="status">{{ message }}</p>

      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-default text-left text-muted">
              <th class="py-2 pr-3 font-semibold">Coil</th>
              <th class="py-2 pr-3 font-semibold">Result</th>
              <th class="py-2 pr-3 font-semibold">Field ({{ unitLabel() }})</th>
              <th class="py-2 pr-3 font-semibold">{{ unitLabel() }}/mA</th>
              <th class="py-2 pr-3 font-semibold max-sm:hidden">Direction on the phone</th>
              <th class="py-2" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, ch) in results" :key="ch" class="border-b border-default">
              <td class="py-2 pr-3 font-semibold">CH{{ ch + 1 }}</td>
              <td class="py-2 pr-3" :class="tone(r)">{{ r ? verdictOf(r).text : 'not measured' }}</td>
              <td class="num py-2 pr-3">{{ shown(r) ? `${fmt(shown(r)!.amp)} ± ${fmt(shown(r)!.se)}` : '' }}</td>
              <td class="num py-2 pr-3">{{ shown(r) && shown(r)!.snr >= MIN_SNR ? fmt(shown(r)!.perMA, 3) : '' }}</td>
              <td class="num py-2 pr-3 max-sm:hidden">{{ direction(r) }}</td>
              <td class="py-2 text-right"><UButton size="xs" variant="ghost" :disabled="!canMeasure" @click="measure(ch)">{{ r ? 'Again' : 'Measure' }}</UButton></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton v-if="state.mode === 'spacer'" :disabled="!anyFit || anyBusy || !connected()" @click="store">Store µT/mA in the helmet</UButton>
        <UButton variant="outline" color="neutral" icon="i-lucide-download" :disabled="!anyFit" @click="downloadCsv">Download CSV</UButton>
        <UButton variant="ghost" color="neutral" :disabled="!anyFit || anyBusy" @click="clearResults">Clear</UButton>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 border-t border-default pt-5">
      <div class="grid grid-cols-1 gap-2">
        <h3 class="text-lg">Signal check: does the set {{ unitLabel() }} arrive?</h3>
        <p class="measure text-sm text-muted">
          Plays a sine on one coil at the intensity you set, as a program does: the set value is the sine's peak 20 mm from the coil's face. The app fits that sine to the phone's readings and shows how much of it arrived.
          Put the coil's face 20 mm from the sensor chip, centred over it (about 10 mm of spacer on the phone). Each run is a {{ SIGNAL_SECONDS }} s session in the helmet's log.
        </p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <UFormField label="Coil">
          <USelect v-model="state.signal.ch" :items="COILS" :disabled="anyBusy" class="w-full" />
        </UFormField>
        <UFormField label="Sine frequency">
          <USelect v-model="state.signal.hz" :items="FREQUENCIES" :disabled="anyBusy" class="w-full" />
        </UFormField>
        <UFormField :label="`Intensity at 20 mm (${unitLabel()}, max ${fmt(maxFieldUT(), 1)})`">
          <UInput :model-value="Number((toDisplay(state.signal.uT) as number).toPrecision(4))" type="number" step="any" min="0" :disabled="anyBusy" class="w-full" @change="setSignalField" />
        </UFormField>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <UButton icon="i-lucide-play" :disabled="!canPlay" @click="playSignal">Play and measure</UButton>
        <template v-if="sigBusy">
          <span class="text-sm" role="status">CH{{ state.signal.ch + 1 }}, {{ state.signal.hz }} Hz: <span class="num">{{ left }}</span> s left. Keep the phone and the coil still.</span>
          <UButton size="sm" color="error" @click="cancel">Stop</UButton>
        </template>
        <span v-else-if="connected() && running() && busy === null" class="text-sm text-muted">A session is running on the helmet.</span>
      </div>
      <div v-if="state.signals.length" class="overflow-x-auto">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-default text-left text-muted">
              <th class="py-2 pr-3 font-semibold">Coil</th>
              <th class="py-2 pr-3 font-semibold">Signal</th>
              <th class="py-2 pr-3 font-semibold">Set ({{ unitLabel() }})</th>
              <th class="py-2 pr-3 font-semibold">Measured ({{ unitLabel() }})</th>
              <th class="py-2 pr-3 font-semibold">Result</th>
              <th class="py-2 font-semibold">{{ unitLabel() }}/mA in the helmet → from this reading</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in state.signals" :key="i" class="border-b border-default">
              <td class="py-2 pr-3 font-semibold">CH{{ r.ch + 1 }}</td>
              <td class="py-2 pr-3">{{ r.hz }} Hz sine</td>
              <td class="num py-2 pr-3">{{ fmt(r.setUT) }}</td>
              <td class="num py-2 pr-3">{{ r.fit ? `${fmt(r.fit.amp)} ± ${fmt(r.fit.se)}` : '' }}</td>
              <td class="py-2 pr-3" :class="r.fit && r.fit.snr >= MIN_SNR ? '' : 'text-error'">{{ signalText(r) }}</td>
              <td class="num py-2">{{ impliedPerMA(r) !== null ? `${fmt(r.perMA, 3)} → ${fmt(impliedPerMA(r), 3)}` : '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="state.signals.length">
        <UButton variant="ghost" color="neutral" :disabled="sigBusy" @click="state.signals = []">Clear signal results</UButton>
      </div>
    </div>
  </section>
</template>
