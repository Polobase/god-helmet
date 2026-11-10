<script setup lang="ts">
// What the helmet records with every session and trial: its clock, the local
// sidereal time and the geomagnetic Kp index (from NOAA, or typed in).
import { device, call } from '~/lib/device'
import { helmetInfo, fetchKp, useHelmetActions, type HelmetEnv, type NumberInput } from '~/lib/helmet'

const { run } = useHelmetActions()
const info = computed(() => helmetInfo())
const env = computed(() => info.value?.env)
const kpManual = ref<NumberInput>('')
const noKp = computed(() => kpManual.value === '' || kpManual.value == null)

const clock = computed(() => (env.value?.timeValid ? `${new Date(env.value.epoch * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC` : 'not set'))
const lst = computed(() => (env.value && env.value.lst >= 0 ? `${env.value.lst.toFixed(2)} h` : '–'))
const kp = computed(() => (env.value?.kpValid ? `${env.value.kp.toFixed(2)} / ${env.value.ap >= 0 ? env.value.ap : '–'} (${env.value.kpSource})` : '–'))

// env.set returns the new environment. A full refresh() would also reload the
// settings and wipe unsaved edits in the forms above.
const setEnv = async (params: Record<string, unknown>) => {
  const next = await call<HelmetEnv>('env.set', params)
  if (device.info) device.info.env = next
}
const updateKp = () => run(async () => {
  const kp = await fetchKp()
  await setEnv({ kp: kp.kp, ap: kp.ap, source: 'noaa' })
}, 'Kp updated from NOAA.')

const setKp = () => run(async () => {
  const v = kpManual.value
  if (v === '' || v == null || !(Number(v) >= 0 && Number(v) <= 9)) throw new Error('Enter a Kp between 0 and 9.')
  await setEnv({ kp: Number(v), source: 'manual' })
}, 'Kp set.')
</script>

<template>
  <section class="panel grid grid-cols-1 gap-5 p-5 sm:p-7" aria-labelledby="helmet-environment">
    <h2 id="helmet-environment" class="text-2xl">Environment</h2>

    <div class="grid items-center gap-x-8 md:grid-cols-[minmax(0,1fr)_14rem]">
      <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-1.5 text-sm">
        <dt class="text-muted">Helmet</dt>
        <dd>{{ info?.board }}, firmware {{ info?.firmware }}</dd>
        <dt class="text-muted">Clock</dt>
        <dd class="num">{{ clock }}</dd>
        <dt class="text-muted">Local sidereal time</dt>
        <dd class="num">{{ lst }}</dd>
        <dt class="text-muted">Kp / ap</dt>
        <dd class="num">{{ kp }}</dd>
      </dl>
      <!-- Kp says how disturbed the earth's field is. -->
      <ArtScene name="geomagnetic" class="-my-6 text-toned max-md:hidden" />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UButton icon="i-lucide-cloud-download" @click="updateKp">Update Kp from NOAA</UButton>
      <UInput v-model.number="kpManual" type="number" step="0.33" min="0" max="9" placeholder="Kp 0–9" aria-label="Kp by hand (0–9)" class="w-28" @keyup.enter="setKp" />
      <UButton variant="ghost" :disabled="noKp" @click="setKp">Set by hand</UButton>
    </div>
    <p class="measure text-sm text-muted">Kp, ap and sidereal time are recorded with every session and trial. They are never used to schedule sessions; the reported effects did not replicate.</p>
  </section>
</template>
