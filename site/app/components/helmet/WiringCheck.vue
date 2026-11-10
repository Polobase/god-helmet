<script setup lang="ts">
// Wiring check: DC on each coil in turn (the rotation test), and the full-load
// test with all eight outputs at once.
import { device, start } from '~/lib/device'
import { LAYOUTS } from '~/lib/model'
import { rot, load, draft, useHelmetActions } from '~/lib/helmet'

const { run } = useHelmetActions()
const s = computed(() => draft.value!)
const LAYOUT_ITEMS = (['ring', 'temporal'] as const).map((key) => ({ label: LAYOUTS[key].title, value: key }))
const DIRECTIONS: { label: string, value: 'ccw' | 'cw' }[] = [{ label: 'Counter-clockwise', value: 'ccw' }, { label: 'Clockwise', value: 'cw' }]

const rotTest = () => run(() => {
  device.testLayout = rot.layout
  return start('test', { mode: 'rotate', ...rot, mA: Number(rot.mA), dwellMs: Number(rot.dwellMs), seconds: 30 })
})
// All eight outputs at the same current: the module's full load (supply current, ±12 V rails).
const loadTest = (sign: 1 | -1) => run(() => start('test', { mode: 'dcall', mA: sign * Math.abs(Number(load.mA)), seconds: Number(load.sec) }))
const loadVolts = computed(() => (Number(load.mA) * (Number(s.value.seriesOhm) + Number(s.value.coilOhm)) / 1000).toFixed(1))
</script>

<template>
  <section class="panel grid grid-cols-1 gap-5 p-5 sm:p-7" aria-labelledby="helmet-wiring">
    <div class="grid grid-cols-1 gap-2">
      <h2 id="helmet-wiring" class="text-2xl">Wiring check</h2>
      <p class="measure text-sm text-muted">Each coil in turn gets DC for the dwell time. Follow it with a compass, or measure about 2.2 V per mA across each 2.2 kΩ resistor.</p>
    </div>

    <div class="grid grid-cols-1 gap-3">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <UFormField label="Layout">
          <USelect v-model="rot.layout" :items="LAYOUT_ITEMS" class="w-full" />
        </UFormField>
        <UFormField label="Direction">
          <USelect v-model="rot.dir" :items="DIRECTIONS" class="w-full" />
        </UFormField>
        <UFormField label="Dwell per coil (ms)">
          <UInput v-model.number="rot.dwellMs" type="number" min="100" class="w-full" />
        </UFormField>
        <UFormField label="Current (mA)">
          <UInput v-model.number="rot.mA" type="number" step="0.1" class="w-full" />
        </UFormField>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton icon="i-lucide-play" @click="rotTest">Start rotation test (30 s)</UButton>
      </div>
      <HelmetTestRunning session-id="test-rotate">The session bar at the top shows which coil is on.</HelmetTestRunning>
    </div>

    <div class="grid grid-cols-1 gap-3 border-t border-default pt-5">
      <div class="grid grid-cols-1 gap-2">
        <h3 class="text-lg">Full load: all 8 outputs at once</h3>
        <p class="measure text-sm text-muted">Every output at the same DC current, for measuring the module's supply current and checking both ±12 V rails. Each output carries the current through its resistor (<span class="num">{{ loadVolts }}</span> V at {{ load.mA }} mA with {{ s.seriesOhm }} Ω + {{ s.coilOhm }} Ω). Not with the helmet on.</p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-[calc(60%-0.5rem)]">
        <UFormField label="Current per output (mA, max 4.6)">
          <UInput v-model.number="load.mA" type="number" step="0.1" min="0.1" max="4.6" class="w-full" />
        </UFormField>
        <UFormField label="Seconds">
          <UInput v-model.number="load.sec" type="number" min="5" max="120" class="w-full" />
        </UFormField>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton icon="i-lucide-play" @click="loadTest(1)">All 8 positive</UButton>
        <UButton variant="ghost" @click="loadTest(-1)">All 8 negative</UButton>
      </div>
      <HelmetTestRunning session-id="test-dc-all">Measure now.</HelmetTestRunning>
    </div>
  </section>
</template>
