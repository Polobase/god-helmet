<script setup lang="ts">
// The new-trial form: mode, the stimulation that runs meanwhile, blind or not.
// Its values live in lib/trials.ts, so they survive leaving the tab.
import { device } from '~/lib/device'
import { presetById } from '~/lib/programs'
import { trialForm, stimulationGroups, type Trial } from '~/lib/trials'
import { TRIAL_MARKS } from '~/lib/art'

const props = defineProps<{
  /** Picture sets a trial can use. */
  usableCount: number
  /** A trial that still waits for a step: it has to be finished or aborted first. */
  unfinished?: Trial
  busy: boolean
  error: string
}>()
const emit = defineEmits<{ create: [], resume: [] }>()
const { safetyPath } = useAppNav()

const MODES = [
  { label: 'Remote viewing', value: 'rv' },
  { label: 'Telepathy (with a sender)', value: 'telepathy' },
]
// The select cannot hold an empty value: "none" stands for no stimulation.
const NONE = 'none'
const stimulation = computed({ get: () => trialForm.presetId || NONE, set: (v: string) => (trialForm.presetId = v === NONE ? '' : v) })
const stimulationItems = [
  [{ label: 'None', value: NONE }],
  ...stimulationGroups.map((g) => [{ type: 'label' as const, label: g.label }, ...g.items.map((p) => ({ label: p.doc.name, value: p.doc.id }))]),
]
const presetName = computed(() => presetById(trialForm.presetId)?.doc.name ?? '')
const needsSafety = computed(() => !!trialForm.presetId && !!device.info && !device.info.safetyAccepted)
const { online, lost } = useHelmetLink()
const blocked = computed(() => props.busy || !online.value || !props.usableCount || !!props.unfinished)
</script>

<template>
  <section class="panel grid grid-cols-1 gap-5 p-5 sm:p-7" aria-labelledby="new-trial">
    <div class="flex items-center justify-between gap-4">
      <h2 id="new-trial" class="text-2xl">New trial</h2>
      <!-- The mode that is chosen below, as a picture. -->
      <ArtMark v-if="TRIAL_MARKS[trialForm.mode]" :name="TRIAL_MARKS[trialForm.mode]!" class="-my-1 w-10 shrink-0 text-toned" />
    </div>

    <UAlert v-if="unfinished" color="warning" variant="subtle" icon="i-lucide-hourglass" :title="`Trial #${unfinished.id} is not finished yet.`"
      description="Resume it, or abort it before you start another." :actions="[{ label: 'Resume it', color: 'neutral', variant: 'outline', onClick: () => emit('resume') }]" />

    <div class="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
      <UFormField label="Mode" :help="trialForm.mode === 'rv' ? 'You describe a hidden picture.' : 'A sender looks at the picture on another phone while you describe it.'">
        <USelect v-model="trialForm.mode" :items="MODES" size="lg" class="w-full" />
      </UFormField>
      <UFormField label="Stimulation during the trial">
        <USelect v-model="stimulation" :items="stimulationItems" size="lg" class="w-full" />
        <!-- A long name is cut off in the select on a phone. -->
        <template v-if="presetName" #help><span class="sm:hidden">{{ presetName }}</span></template>
      </UFormField>
    </div>

    <UCheckbox :model-value="trialForm.blind && !!trialForm.presetId" :disabled="!trialForm.presetId"
      :label="`Blind real/sham (recommended)${trialForm.presetId ? '' : ': only with stimulation'}`" @update:model-value="(v) => (trialForm.blind = v === true)" />

    <UAlert v-if="needsSafety" color="warning" variant="subtle" icon="i-lucide-triangle-alert">
      <template #description>Stimulation needs the <NuxtLink :to="safetyPath()" class="font-semibold underline underline-offset-4">safety page</NuxtLink> accepted first. Accept it, or choose Stimulation: None.</template>
    </UAlert>
    <UAlert v-if="!usableCount" color="warning" variant="subtle" icon="i-lucide-images">
      <template #description>No usable picture sets yet. <NuxtLink to="/app/trials/pictures" class="font-semibold underline underline-offset-4">Add a set of 2–8 pictures to the picture pool</NuxtLink>, then come back.</template>
    </UAlert>
    <p v-else class="measure text-sm text-muted">Pool: <span class="num">{{ usableCount }}</span> usable set(s) (<NuxtLink to="/app/trials/pictures" class="text-primary underline underline-offset-4">picture pool</NuxtLink>). Ideally someone else builds it. Decide the number of trials in advance and count every trial.</p>

    <div class="flex flex-wrap items-center gap-3">
      <UButton color="primary" variant="solid" size="lg" :disabled="blocked" @click="emit('create')">{{ busy ? 'Creating…' : 'Create trial' }}</UButton>
      <span v-if="lost" class="text-sm text-warning">Connection lost: a trial can be created when the helmet is back.</span>
      <span v-else-if="!device.kind" class="text-sm text-muted">Connect the helmet or the demo first.</span>
    </div>
    <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
  </section>
</template>
