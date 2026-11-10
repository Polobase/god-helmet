<script setup lang="ts">
// The helmet's settings: its resistors and module, the field limits, the
// keep-alive, its Bluetooth name and the longitude for sidereal time.
import { unitLabel } from '#core/lib/units.js'
import { draft, disp, fromInput, fieldStep, unsaved, OTHER_KEYS, useHelmetActions } from '~/lib/helmet'

const { run, saveSettings } = useHelmetActions()
const s = computed(() => draft.value!)
const dirty = computed(() => unsaved(OTHER_KEYS))
const { online } = useHelmetLink()
const fieldValue = (e: Event) => fromInput((e.target as HTMLInputElement).value)

const useLocation = () => run(() => new Promise<void>((resolve, reject) => {
  navigator.geolocation.getCurrentPosition((p) => {
    s.value.longitudeDeg = Number(p.coords.longitude.toFixed(3))
    resolve()
  }, () => reject(new Error('Location not available; type your longitude instead.')))
}), 'Longitude filled in; press Save.')

const maxCurrent = computed(() => (Number(s.value.vFullScale) / (Number(s.value.seriesOhm) + Number(s.value.coilOhm)) * 1000).toFixed(2))
</script>

<template>
  <section class="panel grid grid-cols-1 gap-5 p-5 sm:p-7" aria-labelledby="helmet-settings">
    <h2 id="helmet-settings" class="text-2xl">Settings</h2>

    <div class="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      <UFormField label="Series resistor (Ω)">
        <UInput v-model.number="s.seriesOhm" type="number" class="w-full" />
      </UFormField>
      <UFormField label="Coil resistance (Ω)">
        <UInput v-model.number="s.coilOhm" type="number" step="0.1" class="w-full" />
      </UFormField>
      <UFormField label="Module full scale (V)">
        <UInput v-model.number="s.vFullScale" type="number" step="0.1" class="w-full" />
      </UFormField>
      <UFormField :label="`Max field at 20 mm (${unitLabel()}, at most ${disp(10)})`">
        <UInput :model-value="disp(s.maxFieldUT)" type="number" :step="fieldStep(0.1)" class="w-full" @change="s.maxFieldUT = fieldValue($event)" />
      </UFormField>
      <UFormField :label="`Default field (${unitLabel()})`">
        <UInput :model-value="disp(s.defaultFieldUT)" type="number" :step="fieldStep(0.1)" class="w-full" @change="s.defaultFieldUT = fieldValue($event)" />
      </UFormField>
      <UFormField label="Stop if no app for (s, 0 = off)">
        <UInput v-model.number="s.keepaliveS" type="number" class="w-full" />
      </UFormField>
      <UFormField label="Bluetooth name (empty = GodHelmet-XXXX)">
        <UInput v-model="s.bleName" type="text" maxlength="20" class="w-full" />
      </UFormField>
      <UFormField label="Longitude (° east, for sidereal time)" class="sm:col-span-2 lg:col-span-2">
        <div class="flex flex-wrap gap-2">
          <UInput v-model.number="s.longitudeDeg" type="number" step="0.01" class="min-w-32 flex-1 lg:max-w-[calc(50%-0.5rem)]" />
          <UButton icon="i-lucide-locate-fixed" @click="useLocation">Use my location</UButton>
        </div>
      </UFormField>
    </div>

    <div class="grid grid-cols-1 gap-3">
      <UCheckbox v-model="s.dacGain2x" label="DAC gain ×2 (0…2·Vref; see the bench test)" />
      <UCheckbox v-model="s.dacBufferedRef" label="Buffered DAC reference" />
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UButton :color="dirty ? 'primary' : 'neutral'" :variant="dirty ? 'solid' : 'outline'" :disabled="!online" @click="saveSettings">Save settings</UButton>
      <span v-if="!online" class="text-sm text-warning">No connection: your changes are kept, save them when the helmet is back.</span>
      <span v-else-if="dirty" class="text-sm text-warning">Not saved yet.</span>
    </div>
    <p class="measure text-sm text-muted">Max current with these values: <span class="num">{{ maxCurrent }}</span> mA per coil. A new Bluetooth name applies after a restart.</p>
  </section>
</template>
