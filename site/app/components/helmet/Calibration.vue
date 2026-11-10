<script setup lang="ts">
// Calibration: drive one coil with DC, measure its field, and turn the reading
// into µT per mA for that coil. Shown while a helmet (or the demo) is connected.
import { unitLabel, fromDisplay } from '#core/lib/units.js'
import { start } from '~/lib/device'
import { cal, draft, disp, fromInput, fieldStep, unsaved, CALIBRATION_KEYS, useHelmetActions } from '~/lib/helmet'

const { run, flash, saveSettings } = useHelmetActions()
const s = computed(() => draft.value!)
const COILS = Array.from({ length: 8 }, (_, i) => ({ label: `CH${i + 1}`, value: i }))
// Coil and current the measured field belongs to: the last DC test, else the form.
const target = computed(() => cal.last ?? { ch: cal.ch, mA: Math.abs(Number(cal.mA)) })
const dirty = computed(() => unsaved(CALIBRATION_KEYS))
const { online } = useHelmetLink()

const dcTest = (sign: 1 | -1) => run(async () => {
  const ch = cal.ch
  const mA = Math.abs(Number(cal.mA))
  // (Like every start: with a token, so a lost answer never starts it twice.)
  await start('test', { mode: 'dc', channel: ch, mA: sign * mA, seconds: Number(cal.sec) })
  cal.last = { ch, mA }
})

function applyMeasured() {
  const { ch, mA } = target.value
  const b = fromDisplay(Number(cal.measured))
  if (!(mA > 0 && b > 0)) return flash('Enter the test current and the measured field.', true)
  s.value.uTperMA[ch] = Number((b / mA).toFixed(3))
  flash(`CH${ch + 1}: ${disp(s.value.uTperMA[ch])} ${unitLabel()}/mA. Save to keep it.`)
}
const setCoil = (i: number, e: Event) => (s.value.uTperMA[i] = fromInput((e.target as HTMLInputElement).value))
</script>

<template>
  <section class="panel grid grid-cols-1 gap-5 p-5 sm:p-7" aria-labelledby="helmet-calibration">
    <div class="grid grid-cols-1 gap-2">
      <h2 id="helmet-calibration" class="text-2xl">Calibration</h2>
      <p class="measure text-sm text-muted">Drive one coil with DC and measure the field 20 mm in front of its face, on its axis: phone magnetometer (phyphox) or an I2C sensor. Subtract the reading with the coil off. Reverse polarity to check the sign.</p>
    </div>

    <div class="grid grid-cols-1 gap-3">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <UFormField label="Coil">
          <USelect v-model="cal.ch" :items="COILS" class="w-full" />
        </UFormField>
        <UFormField label="Current (mA, max 4.5)">
          <UInput v-model.number="cal.mA" type="number" step="0.1" min="0.1" max="4.5" class="w-full" />
        </UFormField>
        <UFormField label="Seconds">
          <UInput v-model.number="cal.sec" type="number" min="5" max="120" class="w-full" />
        </UFormField>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton icon="i-lucide-play" @click="dcTest(1)">Start DC test</UButton>
        <UButton variant="ghost" @click="dcTest(-1)">Reversed polarity</UButton>
      </div>
      <HelmetTestRunning session-id="test-dc">Measure now and enter the reading below.</HelmetTestRunning>
    </div>

    <div class="grid grid-cols-1 items-end gap-x-4 gap-y-3 border-t border-default pt-5 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,22rem)_auto] lg:justify-start">
      <UFormField :label="`Measured field, on minus off (${unitLabel()})`">
        <UInput v-model.number="cal.measured" type="number" :step="fieldStep(0.01)" class="w-full" @keyup.enter="applyMeasured" />
      </UFormField>
      <UButton class="justify-self-start" @click="applyMeasured">Use for CH{{ target.ch + 1 }} ({{ target.mA }} mA)</UButton>
    </div>

    <fieldset class="grid grid-cols-1 gap-3">
      <legend class="mb-3 text-sm text-muted">Field per mA at 20 mm, for each coil</legend>
      <div class="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
        <UFormField v-for="(v, i) in s.uTperMA" :key="i" :label="`CH${i + 1} ${unitLabel()}/mA`">
          <UInput :model-value="disp(v)" type="number" :step="fieldStep(0.01)" class="num w-full" @change="setCoil(i, $event)" />
        </UFormField>
      </div>
      <UCheckbox v-model="s.calibrated" label="These values are measured" class="mt-1" />
    </fieldset>

    <div class="flex flex-wrap items-center gap-3">
      <UButton :color="dirty ? 'primary' : 'neutral'" :variant="dirty ? 'solid' : 'outline'" :disabled="!online" @click="saveSettings">Save calibration</UButton>
      <span v-if="!online" class="text-sm text-warning">No connection: your changes are kept, save them when the helmet is back.</span>
      <span v-else-if="dirty" class="text-sm text-warning">Not saved yet.</span>
    </div>
  </section>
</template>
