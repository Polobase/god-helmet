<script setup>
// The helmet-driver board (hardware/pcb, untested): shown only when the connected helmet reports it in hello.pcb.
// Its ceiling switch, rails and latches, the measured coil currents, and the coil check.
import { computed, ref } from 'vue'
import { device, call } from '../ble/device.js'

const emit = defineEmits(['message'])
const pcb = computed(() => device.status?.pcb ?? null)
const info = computed(() => device.info?.pcb ?? null)
const check = computed(() => pcb.value?.coilsCheck ?? null)
const busy = ref(false)

const fmt = (v, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '–')
const ceilingText = computed(() => {
  const c = pcb.value?.ceilingMA ?? info.value?.ceilingMA
  return c > 0 ? `${c} mA (trips at ${(c * 1.1).toFixed(1)} mA)` : 'switch reads neither 5 nor 20 mA: nothing starts'
})
const usbText = computed(() => {
  const p = pcb.value
  if (!p) return '–'
  const src = p.usbHost ? 'a computer' : 'a power supply or power bank'
  return p.usbMA > 0 ? `${src}, offers ${p.usbMA} mA` : src
})

async function runCheck() {
  busy.value = true
  try {
    await call('coils.check')
    emit('message', { text: 'Coil check running: 1 mA in each coil for 1 s, about 9 s.' })
  } catch (e) {
    emit('message', { text: e.message, bad: true })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card board">
    <h2>Driver board</h2>
    <p class="small muted">Current sources: each coil gets the set current whatever its resistance, up to {{ fmt(info?.fullScaleMA, 1) }} mA; the switch on the board sets the ceiling. Untested hardware.</p>
    <div class="kv small">
      <span class="muted">Ceiling</span><span>{{ ceilingText }}</span>
      <span class="muted">Rails</span><span>{{ pcb ? `${fmt(pcb.rails[0], 1)} V / ${fmt(pcb.rails[1], 1)} V` : '–' }}</span>
      <span class="muted">USB</span><span>{{ usbText }}</span>
      <span class="muted">Latches</span>
      <span>
        <span :class="pcb?.trip ? 'bad' : ''">trip {{ pcb?.trip ? 'set' : 'clear' }}</span>,
        <span :class="pcb?.stop ? 'bad' : ''">STOP {{ pcb?.stop ? 'pressed' : 'clear' }}</span>
        <span class="muted">(cleared at the next start, unless their cause remains)</span>
      </span>
      <span class="muted">Monitor</span><span>{{ pcb ? (pcb.monitor ? 'reading' : 'no answer from the monitor ADCs') : '–' }}</span>
    </div>
    <div v-if="pcb?.coilMA" class="coils">
      <div v-for="(ma, i) in pcb.coilMA" :key="i" class="coil small">
        <span class="muted">CH{{ i + 1 }}</span>
        <b>{{ fmt(ma, 2) }}</b>
        <span class="muted">rms {{ fmt(pcb.coilRmsMA?.[i], 2) }}</span>
      </div>
    </div>
    <p v-else-if="pcb" class="small muted">Measured currents are withheld while a blind session runs.</p>
    <div class="row">
      <button class="btn" :disabled="busy || check?.running || (device.status && device.status.state !== 'idle')" @click="runCheck">Check coils</button>
      <span class="small muted">1 mA DC in each coil in turn: current, drive voltage, resistance, open lead.</span>
    </div>
    <table v-if="check?.coils" class="small result">
      <thead><tr><th>Coil</th><th>mA</th><th>V</th><th>Ω</th><th /></tr></thead>
      <tbody>
        <tr v-for="(c, i) in check.coils" :key="i">
          <td>CH{{ i + 1 }}</td>
          <td>{{ fmt(c.mA, 3) }}</td>
          <td>{{ fmt(c.outV, 2) }}</td>
          <td>{{ c.ohm ? fmt(c.ohm, 1) : '–' }}</td>
          <td :class="c.ok ? 'ok' : 'bad'">{{ c.open ? 'open' : c.ok ? 'ok' : 'current off' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="check?.stopped && check.stopped !== 'completed'" class="small bad">The check stopped early: {{ check.stopped }}</p>
  </section>
</template>

<style scoped>
.board { display: grid; gap: 10px; }
.kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; }
.coils { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.coil { display: grid; gap: 2px; padding: 8px; border: 1px solid var(--line); border-radius: 8px; }
.result { border-collapse: collapse; width: 100%; }
.result th, .result td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--line); }
.ok { color: var(--ok); } .bad { color: var(--bad); }
@media (max-width: 520px) { .coils { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
