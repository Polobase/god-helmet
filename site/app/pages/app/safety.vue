<script setup lang="ts">
// The safety page. The helmet itself stores the acceptance and refuses to
// start a field without it. The wording is the project's safety text: change
// it in docs/SAFETY.md and here together, never here alone.
import { fmtRange } from '#core/lib/units.js'
import { device, call, refresh, errorMessage } from '~/lib/device'
import { presetById } from '~/lib/programs'

const route = useRoute()
useHead({ title: 'Safety' })

const accepted = ref(Boolean(device.info?.safetyAccepted))
watch(() => device.info?.safetyAccepted, (v) => {
  if (v) accepted.value = true
})
const err = ref('')
// Where Continue leads: back to the tab (and program) that was refused.
const backPath = computed(() => safeBack(route.query.back))
const back = computed(() => {
  if (!route.query.back) return null
  const [, , tab, id] = backPath.value.split('?')[0]!.split('/')
  const label = APP_TABS.find((t) => t.key === tab)?.label ?? 'Programs'
  let name: string | undefined
  try {
    name = id ? presetById(decodeURIComponent(id))?.doc.name : undefined
  } catch { /* a stray % in the address: no name then */ }
  return name ? `${label}: ${name}` : label
})

async function accept() {
  err.value = ''
  try {
    if (!device.info?.safetyAccepted) {
      await call('settings.set', { safetyAccepted: true })
      await refresh()
    }
    await navigateTo(route.query.back ? backPath.value : '/app/programs')
  } catch (e) {
    err.value = errorMessage(e)
  }
}
</script>

<template>
  <section class="panel grid gap-5 p-5 sm:p-8">
    <div>
      <p class="text-sm text-muted">Read before the first session</p>
      <h1 class="mt-1 text-4xl">Safety</h1>
    </div>
    <UAlert v-if="back && !device.info?.safetyAccepted" color="warning" variant="subtle" icon="i-lucide-triangle-alert"
      title="The helmet will not start a field until you accept this page" :description="`Continue takes you back to ${back}.`" />
    <p class="measure">This is an experimental, non-medical device. The fields are about {{ fmtRange(1, 5) }} at the cortex, about a million times weaker than TMS and below the ICNIRP public reference level. The published evidence that such fields cause any experience is weak: double-blind studies attribute most effects to expectation and setting. The blind mode lets you find out for yourself.</p>

    <div class="grid gap-2">
      <h2 class="text-xl">Do not use it if you</h2>
      <ul class="measure grid list-disc gap-1.5 border-l-[3px] border-error py-1 pl-8">
        <li>have epilepsy, a seizure history, or a first-degree relative with epilepsy. The burst-firing patterns were derived from seizure EEG, and Murphy reports his own 8–10 days of distress after the bilateral amygdala signal.</li>
        <li>have a psychiatric condition (psychosis, bipolar disorder, severe depression, PTSD) or take medication that lowers the seizure threshold;</li>
        <li>have implanted electronics (pacemaker, defibrillator, cochlear implant, neurostimulator), are pregnant, or had a recent head injury;</li>
        <li>have taken alcohol or drugs.</li>
      </ul>
    </div>

    <div class="grid gap-2">
      <h2 class="text-xl">Rules</h2>
      <ul class="measure grid list-disc gap-1.5 pl-5">
        <li>Battery (power bank) only while the helmet is worn; never charge from mains during a session.</li>
        <li>Sit or lie down. No driving or machinery for at least an hour afterwards.</li>
        <li>Stop at once (STOP button) on fear, anxiety, headache, nausea or anything unusual. Right-side-only stimulation is reported to cause fear in some people.</li>
        <li>At most one session per 72 hours.</li>
        <li>Never run the coils without the 2.2 kΩ series resistors.</li>
        <li>Don't combine it with other stimulation devices (light/sound machines, CES, TENS) during a session.</li>
      </ul>
    </div>

    <p class="text-sm text-muted">The full text, with sources: <NuxtLink to="/docs/safety" class="text-primary underline underline-offset-4">Safety, in the docs</NuxtLink>.</p>

    <UCheckbox v-model="accepted" label="I have read this and accept the risks" />
    <div class="flex flex-wrap items-center gap-3">
      <UButton color="primary" variant="solid" size="lg" :disabled="!accepted || device.link !== 'connected'" @click="accept">Continue</UButton>
      <template v-if="!device.kind">
        <AppConnect />
        <span class="text-sm text-muted">The helmet stores your acceptance, so connect first.</span>
      </template>
      <span v-else-if="device.link !== 'connected'" class="text-sm text-warning">The connection to the helmet is lost: Continue works again when it is back.</span>
      <span v-else-if="device.info?.safetyAccepted" class="text-sm text-success">Accepted on this helmet.</span>
    </div>
    <p v-if="err" class="text-sm text-error" role="alert">{{ err }}</p>
  </section>
</template>
