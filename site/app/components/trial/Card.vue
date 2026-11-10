<script setup lang="ts">
// The open trial: where it is in the flow, the commitment, the response
// (written and sketched, then locked), the pictures to rank and the reveal.
// The page owns the trial and talks to the helmet; this shows it and asks.
import { fmtDate } from '#core/lib/format.js'
import { device } from '~/lib/device'
import { STEPS, stepOf, isActive, type Trial, type TrialChecks } from '~/lib/trials'

const props = defineProps<{
  trial: Trial
  /** The stored sketch (a PNG data URL, drawn dark on light). */
  sketch: string
  /** The response on screen belongs to this trial: the sketch pad reads it when it mounts. */
  responseLoaded: boolean
  /** Object URLs of the set's pictures, in display order. */
  pictures: string[]
  checks: TrialChecks | null
  busy: boolean
  error: string
}>()
const text = defineModel<string>('text', { required: true })
const ranks = defineModel<number[]>('ranks', { required: true })
const emit = defineEmits<{ close: [], sketch: [dataUrl: string], lock: [], abort: [], judge: [], submitRanks: [], reveal: [] }>()

const active = computed(() => isActive(props.trial))
const step = computed(() => stepOf(props.trial))
const targetPos = computed(() => (props.trial.state === 'revealed' ? (props.trial.order ?? []).indexOf(props.trial.target ?? -1) : -1))
const showPictures = computed(() => ['judging', 'revealed'].includes(props.trial.state) && props.pictures.length > 0)
// Every step needs the helmet.
const { online, lost } = useHelmetLink()
const off = computed(() => props.busy || !online.value)
// Until the ranks are in, a trial can still be abandoned (for instance when its pictures are gone).
const canAbort = computed(() => props.trial.state === 'open' || props.trial.state === 'locked' || (props.trial.state === 'judging' && !props.trial.ranked))
</script>

<template>
  <section class="panel grid grid-cols-1 gap-5 p-5 sm:p-7" :aria-label="`Trial ${trial.id}`">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 class="text-2xl">Trial #{{ trial.id }}, {{ trial.mode === 'rv' ? 'remote viewing' : 'telepathy' }}</h2>
      <div class="flex items-center gap-2">
        <UBadge color="primary" variant="solid" class="rounded-full" data-test="trial-state">{{ trial.state }}{{ trial.blind ? ', blind' : '' }}</UBadge>
        <UButton variant="ghost" size="sm" @click="emit('close')">{{ active ? 'Close for now' : 'Close' }}</UButton>
      </div>
    </div>

    <ol v-if="step >= 0" class="flex flex-wrap gap-1.5" aria-label="Trial steps">
      <UBadge v-for="(s, i) in STEPS" :key="s" as="li" class="rounded-full" :color="i < step ? 'success' : i === step ? 'primary' : 'neutral'" :variant="i === step ? 'subtle' : 'outline'"
        :icon="i < step ? 'i-lucide-check' : undefined" :aria-current="i === step ? 'step' : undefined">
        <span v-if="i < step" class="sr-only">done:</span><span v-else class="num">{{ i + 1 }}</span> {{ s }}
      </UBadge>
    </ol>

    <UAlert v-if="!online && active" color="warning" variant="subtle" icon="i-lucide-unplug"
      :title="lost ? 'Connection lost. The trial waits on the helmet and continues when it is back.' : device.connecting ? 'Connecting…' : 'Helmet disconnected. Reconnect it to continue this trial.'"
      :description="trial.state === 'open' ? 'Your response is saved on this phone.' : undefined" />

    <dl class="grid grid-cols-1 gap-x-5 gap-y-1 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
      <dt class="text-muted">Stimulation</dt>
      <dd class="m-0">{{ trial.presetName || 'none' }}</dd>
      <dt class="text-muted max-sm:mt-1.5">Sets offered</dt>
      <dd class="num m-0">{{ trial.setCount }}</dd>
      <dt class="text-muted max-sm:mt-1.5">Commitment</dt>
      <dd class="m-0 break-all font-mono text-[0.8rem] leading-relaxed" data-test="commitment">{{ trial.commitment }}</dd>
    </dl>

    <UAlert v-if="trial.mode === 'telepathy' && trial.state === 'open'" color="warning" variant="subtle" icon="i-lucide-eye-off"
      :description="`Sender: on a second phone with the same pool imported, open this app, connect to the helmet, Trials → Sender, trial ${trial.id}. The receiver must not see that screen.`" />

    <!-- describe -->
    <div v-if="trial.state === 'open'" class="grid grid-cols-1 gap-3 border-t border-default pt-5">
      <h3 class="text-xl">Your impressions</h3>
      <p class="measure text-sm text-muted">First impressions: shapes, colours, textures, temperature, feelings. Avoid naming things. Saved on this phone as you type.</p>
      <UTextarea v-model="text" :rows="5" autoresize class="w-full max-w-[68ch]" aria-label="Your impressions" />
      <SketchPad v-if="responseLoaded" :key="trial.id" label="Sketch (optional)" :initial="sketch" @change="(d) => emit('sketch', d)" />
    </div>
    <div v-else class="grid grid-cols-1 gap-2 border-t border-default pt-5">
      <h3 class="text-xl">Response <span class="font-sans text-sm font-normal text-muted">(locked {{ fmtDate(trial.lockedAt) }})</span></h3>
      <p class="measure whitespace-pre-wrap text-sm">{{ text || '(no text)' }}</p>
      <img v-if="sketch" :src="sketch" class="stored-sketch" alt="Your sketch">
    </div>

    <!-- rank -->
    <div v-if="showPictures" class="grid grid-cols-1 gap-3 border-t border-default pt-5">
      <h3 class="text-xl">{{ trial.state === 'revealed' ? 'Your ranking' : 'Rank every picture: 1 = best match to your response' }}</h3>
      <TrialPictures v-model:ranks="ranks" :pictures="pictures" :set-size="trial.setSize ?? pictures.length" :locked="trial.ranked" :target-pos="targetPos" />
    </div>

    <div v-if="active" class="flex flex-wrap items-center gap-2">
      <UButton v-if="trial.state === 'open'" color="primary" variant="solid" :disabled="off" @click="emit('lock')">Lock response</UButton>
      <UButton v-else-if="trial.state === 'locked'" color="primary" variant="solid" :disabled="off" @click="emit('judge')">Show the pictures and rank them</UButton>
      <template v-else-if="showPictures">
        <UButton v-if="!trial.ranked" color="primary" variant="solid" :disabled="off" @click="emit('submitRanks')">Submit ranks</UButton>
        <UButton v-else color="primary" variant="solid" :disabled="off" @click="emit('reveal')">Reveal</UButton>
      </template>
      <UButton v-if="canAbort" color="error" variant="ghost" class="ml-auto" :disabled="off" @click="emit('abort')">Abort trial</UButton>
    </div>

    <TrialReveal v-if="trial.state === 'revealed'" :trial="trial" :checks="checks" />
    <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
/* The stored sketch stays light; dark themes only show it inverted so it does not glare (as the sketch pad does). */
.stored-sketch { max-width: 15rem; border-radius: var(--ui-radius); border: 1px solid var(--ui-border); }
:root.dark .stored-sketch { filter: invert(.9); }
:root.night .stored-sketch { filter: invert(1) sepia(1) saturate(6) hue-rotate(-55deg) brightness(.6); }
</style>
