<script setup lang="ts">
// Runs a guide: set-up (sound, helmet arm), the steps with their timer and
// input, and the summary. The run itself lives in lib/guideRun.ts, so it
// carries on while this component is off screen.
import { marked } from 'marked'
import type { Component } from 'vue'
import { fmtDuration, fmtMinutes } from '#core/lib/format.js'
import { device, maxFieldUT } from '~/lib/device'
import { presetById } from '~/lib/programs'
import { stepDurationMs, armRange, hasAudio, inputPending, type AudioChoice, type GuideDoc, type RunRecord } from '~/lib/guides'
import {
  live, GUIDE_RUN, MAX_LEVEL_DB, MIN_LEVEL_DB, begin, requestNext, confirmLeave, pause, resume, stop, suggestMode, closeRun, setAudio, commitLevel, testTone, advanceOf,
} from '~/lib/guideRun'
import {
  GuideTextInput, GuideSketchInput, GuideRatingInput, GuideQuestionnaireInput, GuideChoiceTrainer, GuideCrvStage, GuideTrialStep, GuideOutcomeInput, GuideRngTask,
} from '#components'

const props = defineProps<{ guide: GuideDoc, headphones?: boolean }>()
const emit = defineEmits<{ exit: [] }>()
provide(GUIDE_RUN, live)
const { safetyPath } = useAppNav()
const levelId = useId()

const INPUTS: Record<string, Component> = {
  text: GuideTextInput, sketch: GuideSketchInput, rating: GuideRatingInput, questionnaire: GuideQuestionnaireInput, choice: GuideChoiceTrainer,
  crv: GuideCrvStage, trial: GuideTrialStep, outcome: GuideOutcomeInput, rng: GuideRngTask,
}

const guide = computed(() => live.guide ?? props.guide)
const steps = computed(() => guide.value.steps ?? [])

// ---- set-up
const audible = computed(() => hasAudio(props.guide))
const helmetMode = computed(() => props.guide.requires?.helmet ?? 'none')
const armAvailable = computed(() => !!props.guide.helmetArm && helmetMode.value !== 'none')
const armPreset = computed(() => (props.guide.helmetArm ? presetById(props.guide.helmetArm.preset) : null))
const armSteps = computed(() => {
  const r = armRange(props.guide)
  return r ? steps.value.slice(r.first, r.last + 1).map((s) => s.title).join(', ') : ''
})
const useHelmet = ref(true)
// The helmet refuses a field until the safety page is accepted.
const armBlocked = computed(() => !!device.info && !device.info.safetyAccepted)
const { online, lost } = useHelmetLink()
const canBegin = computed(() => helmetMode.value !== 'required' || (online.value && (!props.guide.helmetArm || (!!armPreset.value && !armBlocked.value))))
if (live.phase === 'idle') suggestMode(props.guide, !!props.headphones)
// Only what the user changed: an untouched suggested mode is not remembered as their choice.
const audioModel = computed<AudioChoice>({
  get: () => ({ ...live.audio }),
  set: (v) => setAudio(Object.fromEntries(Object.entries(v).filter(([k, x]) => live.audio[k as keyof AudioChoice] !== x)) as Partial<AudioChoice>),
})
// Field strength of the arm (as in the Programs tab: the preset's value, capped by the helmet).
const maxField = computed(() => maxFieldUT())
const fieldPick = ref<number | null>(null)
const fieldUT = computed({
  get: () => Math.min(maxField.value, fieldPick.value ?? armPreset.value?.doc.uT ?? (device.info?.defaultFieldUT as number | undefined) ?? 1),
  set: (v: number) => (fieldPick.value = Number(v)),
})
const onBegin = () => begin(props.guide, { helmet: armAvailable.value && useHelmet.value && online.value && !!armPreset.value && !armBlocked.value, fieldUT: fieldUT.value })

// ---- running
const step = computed(() => (live.phase === 'running' ? steps.value[live.index] ?? null : null))
const durMs = computed(() => (step.value ? stepDurationMs(step.value) : null))
const elapsed = computed(() => Math.max(0, live.accumMs + (live.paused ? 0 : live.now - live.resumedAt)))
const isTimer = computed(() => !!step.value && advanceOf(step.value) === 'timer')
const clock = computed(() => (isTimer.value && durMs.value ? Math.max(0, durMs.value - elapsed.value) : elapsed.value))
const stepFrac = computed(() => (durMs.value ? Math.min(1, elapsed.value / durMs.value) : 0))
const overallFrac = computed(() => (live.index + stepFrac.value) / Math.max(1, steps.value.length))
const isLast = computed(() => live.index === steps.value.length - 1)
// The instructions are Markdown from the repository's own guide files.
const html = computed(() => (step.value?.instructions ? marked.parse(step.value.instructions, { async: false }) : ''))
const inputComp = computed(() => INPUTS[step.value?.input?.type ?? ''] ?? null)
const helmet = computed(() => live.record?.helmet ?? null)
// The arm's program while the connection is down: it runs on by itself, unless the helmet's keepalive stops it.
const keepalive = computed(() => Number(device.settings?.keepaliveS) || 0)
const armAlone = computed(() => lost.value && !!helmet.value?.running)
const armFirst = computed(() => steps.value[armRange(guide.value)?.first ?? -1]?.title ?? '')
const nextLabel = computed(() => (isLast.value ? 'Finish' : isTimer.value ? 'Skip step' : 'Next'))
// Next is the main action once the step can be left: not while paused, on a running timer or with its input unfinished.
const nextMain = computed(() => !live.paused && (!isTimer.value || live.timeUp) && !!step.value && !inputPending(step.value.input, live.inputs[step.value.id]))
const clockNote = computed(() => [isTimer.value ? 'left' : 'elapsed', !isTimer.value && durMs.value ? `about ${fmtMinutes(durMs.value)}` : '', live.paused ? 'paused' : ''].filter(Boolean).join(', '))

// The slider reports a change from the keyboard before it hands over the new value: record it after.
const levelCommitted = () => nextTick(commitLevel)

watch(() => live.index, () => {
  if (live.phase === 'running') window.scrollTo({ top: 0 })
})

// While the summary still asks for the rating that reveals a blinded condition, that is the main action, not Done.
const revealPending = computed(() => {
  const r = live.record
  return !!r && ((r.audio.blind && !r.reveal?.audio) || (r.helmet.blind && !!r.helmet.logId && !r.reveal?.helmet))
})
function done() {
  closeRun()
  emit('exit')
}
</script>

<template>
  <div class="grid gap-5">
    <!-- set-up -->
    <template v-if="live.phase === 'idle'">
      <header class="panel grid gap-3 p-5 sm:p-7">
        <p class="text-sm text-muted">Get ready</p>
        <h1 class="text-3xl sm:text-4xl">{{ guide.name }}</h1>
        <details v-if="guide.setting || guide.cautions" class="text-sm">
          <summary class="cursor-pointer py-1.5 text-muted hover:text-highlighted">Setting and cautions (as on the previous page)</summary>
          <p v-if="guide.setting" class="measure mt-2">{{ guide.setting }}</p>
          <p v-if="guide.cautions" class="measure mt-2 border-l-[3px] border-warning pl-3 text-highlighted">{{ guide.cautions }}</p>
        </details>
      </header>

      <section v-if="audible" class="panel p-5 sm:p-7">
        <GuideAudioSetup v-model="audioModel" :max-level-db="MAX_LEVEL_DB" :min-level-db="MIN_LEVEL_DB" :testing="live.testing" :headphones="headphones" @test="testTone" />
      </section>

      <section v-if="armAvailable" class="panel grid gap-4 p-5 sm:p-7">
        <h2 class="text-xl">Helmet</h2>
        <p v-if="!armPreset" class="text-sm text-warning">The preset “{{ guide.helmetArm!.preset }}” is missing from this app; the field arm cannot run.</p>
        <p v-else-if="device.kind && armBlocked" class="measure text-sm text-warning">
          {{ helmetMode === 'required' ? 'This guide needs the field, and the helmet will not start it until you accept the safety page.' : 'The field stays off until you accept the safety page. You can run the guide without it.' }}
          <NuxtLink :to="safetyPath()" class="font-semibold underline underline-offset-4">Open Safety</NuxtLink>
        </p>
        <p v-else-if="lost" class="measure text-sm text-warning">The connection to the helmet is lost; the app is reconnecting. {{ helmetMode === 'required' ? 'This guide needs the helmet.' : 'Begin now and the guide runs without the field.' }}</p>
        <template v-else-if="device.kind">
          <UCheckbox v-model="useHelmet" :disabled="helmetMode === 'required'" :label="`Run “${armPreset.doc.name}” during: ${armSteps}`" />
          <IntensitySlider v-if="useHelmet" v-model="fieldUT" class="max-w-xl" />
          <p class="text-sm text-muted">{{ guide.helmetArm!.blind ? 'Blind: the helmet’s hardware RNG picks real or sham. It is revealed after your final rating.' : 'Not blind: the field is real.' }}</p>
        </template>
        <template v-else>
          <p class="text-sm">{{ helmetMode === 'required' ? 'This guide needs the helmet.' : 'Optional: connect the helmet to add the field.' }}</p>
          <AppConnect />
        </template>
      </section>

      <p v-if="live.error" class="text-sm text-error" role="alert">{{ live.error }}</p>
      <div class="flex flex-wrap gap-3">
        <UButton color="primary" variant="solid" size="xl" class="min-w-40 justify-center" :disabled="!canBegin" @click="onBegin">Begin</UButton>
        <UButton variant="ghost" size="xl" @click="emit('exit')">Back</UButton>
      </div>
      <p class="measure text-sm text-muted">The screen stays on during timed steps and while audio plays; open-ended steps let the phone sleep. Pause holds audio and timer (a helmet program keeps running); Stop ends everything.</p>
    </template>

    <section v-else-if="live.phase === 'starting'" class="panel flex items-center gap-3 p-5 sm:p-7">
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" aria-hidden="true" /><p>Starting…</p>
    </section>

    <!-- running -->
    <template v-else-if="live.phase === 'running' && step">
      <section class="panel grid gap-4 p-5 sm:p-7">
        <div class="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm font-semibold text-muted">
          <span>{{ guide.name }}</span>
          <span class="num">Step {{ live.index + 1 }} of {{ steps.length }}</span>
        </div>
        <h1 class="title">{{ step.title }}</h1>
        <div class="flex flex-wrap items-baseline gap-x-3">
          <span class="clock num" :class="{ 'text-muted!': live.paused }">{{ fmtDuration(clock) }}</span>
          <span class="text-sm text-muted">{{ clockNote }}</span>
        </div>
        <div class="grid gap-1.5">
          <UProgress :model-value="stepFrac * 100" size="sm" aria-label="Step progress" />
          <UProgress :model-value="overallFrac * 100" size="2xs" color="info" aria-label="Session progress" />
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -- trusted guide files from the repository -->
        <div v-if="html" class="instructions measure" v-html="html" />
        <p v-if="live.timeUp" class="text-sm text-warning">Time is up for this step. Press Next when you are ready.</p>
      </section>

      <UAlert v-if="live.audioInterrupted" color="warning" variant="subtle" icon="i-lucide-volume-x" role="alert" title="The sound was interrupted"
        description="A call, the lock screen or another app took the audio. The timer is paused, so nothing runs on in silence."
        :actions="[{ label: 'Tap to resume audio', color: 'primary', variant: 'solid', size: 'lg', onClick: resume }]" />

      <section v-if="inputComp" class="panel p-5 sm:p-7">
        <component :is="inputComp" :key="step.id" v-model="live.inputs[step.id]" :input="step.input" />
      </section>

      <section v-if="helmet?.enabled || live.record?.audio.error || live.error || live.saveError" class="grid gap-1 text-sm">
        <p v-if="helmet?.enabled">
          <span class="text-muted">Helmet:</span>{{ ' ' }}
          <template v-if="armAlone"><span class="text-warning" data-test="arm-lost">connection lost, reconnecting…</span> {{ armPreset?.doc.name ?? helmet.presetId }} keeps running on the helmet{{ keepalive ? `, which stops it after ${keepalive} s without the app` : '' }}.</template>
          <template v-else-if="helmet.running">{{ armPreset?.doc.name ?? helmet.presetId }} running{{ helmet.blind ? ' (blind)' : '' }}{{ live.paused ? ', keeps running while paused' : '' }}<template v-if="helmet.linkNote"> ({{ helmet.linkNote }})</template></template>
          <template v-else-if="helmet.stoppedAt">finished<template v-if="helmet.linkNote"> ({{ helmet.linkNote }})</template></template>
          <template v-else-if="!helmet.error">starts at “{{ armFirst }}”</template>
          <template v-if="helmet.error && !armAlone">{{ ' ' }}<span class="text-warning">{{ helmet.error }}</span></template>
        </p>
        <p v-if="live.record?.audio.error" class="text-warning">{{ live.record.audio.error }}</p>
        <p v-if="live.error" class="text-warning">{{ live.error }}</p>
        <p v-if="live.saveError" class="text-error" role="alert">{{ live.saveError }}</p>
      </section>

      <details v-if="live.record?.audio.enabled" class="panel px-5 py-3 sm:px-7">
        <summary class="cursor-pointer font-semibold text-highlighted">Sound level</summary>
        <div class="grid max-w-xl gap-2 pb-2 pt-3">
          <label :for="levelId" class="flex items-baseline justify-between gap-3 text-sm text-muted">
            <span>Level T0</span>
            <b class="num font-display text-xl font-[620] text-highlighted">{{ live.audio.levelDb }} dB</b>
          </label>
          <USlider :id="levelId" :model-value="live.audio.levelDb" :min="MIN_LEVEL_DB" :max="MAX_LEVEL_DB" :step="1" aria-label="Level T0 in dB" @update:model-value="(v) => setAudio({ levelDb: Number(v) })" @change="levelCommitted" />
        </div>
      </details>

      <div class="controls" role="group" aria-label="Session controls">
        <template v-if="live.confirmNext">
          <span class="note text-warning">{{ live.confirmNext }} Leave this step anyway? There is no way back to it.</span>
          <UButton size="xl" block @click="live.confirmNext = ''">Stay</UButton>
          <UButton size="xl" block color="primary" variant="solid" @click="confirmLeave">Leave step</UButton>
        </template>
        <template v-else-if="!live.confirmStop">
          <UButton size="xl" block :color="live.paused ? 'primary' : 'neutral'" :variant="live.paused ? 'solid' : 'outline'" :icon="live.paused ? 'i-lucide-play' : 'i-lucide-pause'" @click="live.paused ? resume() : pause()">{{ live.paused ? 'Resume' : 'Pause' }}</UButton>
          <UButton size="xl" block :color="nextMain ? 'primary' : 'neutral'" :variant="nextMain ? 'solid' : 'outline'" @click="requestNext">{{ nextLabel }}</UButton>
          <UButton size="xl" block color="error" variant="outline" icon="i-lucide-square" @click="live.confirmStop = true">Stop</UButton>
        </template>
        <template v-else>
          <span class="note">Stop now? Audio and helmet end at once; everything so far is saved.</span>
          <UButton size="xl" block color="error" variant="solid" @click="stop">Stop session</UButton>
          <UButton size="xl" block @click="live.confirmStop = false">Continue</UButton>
        </template>
      </div>
    </template>

    <!-- summary -->
    <section v-else-if="live.phase === 'summary' && live.record" class="panel grid gap-5 p-5 sm:p-7">
      <p class="text-sm font-semibold text-muted">Summary</p>
      <GuideRunSummary :record="live.record" :guide="guide" @saved="(r: RunRecord) => (live.record = r)" />
      <p v-if="live.saveError" class="text-sm text-error" role="alert">{{ live.saveError }}</p>
      <div><UButton :color="revealPending ? 'neutral' : 'primary'" :variant="revealPending ? 'outline' : 'solid'" size="xl" class="min-w-40 justify-center" @click="done">Done</UButton></div>
    </section>

    <div class="sr-only" aria-live="polite" aria-atomic="true">{{ live.announce }}</div>
  </div>
</template>

<style scoped>
.title { font-size: clamp(1.7rem, 7vw, 2.6rem); line-height: 1.1; }
.clock { font-family: var(--font-display); font-stretch: 86%; font-weight: 620; font-size: clamp(3rem, 16vw, 4.5rem); line-height: 1; color: var(--ui-text-highlighted); }

.instructions { font-size: 1.06rem; line-height: 1.6; display: grid; gap: 0.65rem; color: var(--ui-text-highlighted); }
.instructions :deep(p) { margin: 0; }
.instructions :deep(ul), .instructions :deep(ol) { margin: 0; padding-left: 1.4rem; display: grid; gap: 0.25rem; }
.instructions :deep(ul) { list-style: disc; }
.instructions :deep(ol) { list-style: decimal; }
.instructions :deep(a) { color: var(--ui-primary); text-decoration: underline; text-underline-offset: 0.2em; }
.instructions :deep(code) { font-size: 0.92em; padding: 0.05em 0.3em; border-radius: 0.25rem; background: var(--ui-bg-elevated); }

/* The controls stay in reach at the bottom of the screen. */
.controls {
  position: sticky; bottom: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;
  margin-inline: -0.25rem; padding: 0.65rem 0.25rem calc(0.65rem + env(safe-area-inset-bottom, 0px));
  background: color-mix(in oklab, var(--page) 88%, transparent); backdrop-filter: blur(8px); border-top: 1px solid var(--ui-border);
}
.controls > :deep(button) { flex: 1 1 5.5rem; width: auto; padding-block: 0.85rem; }
.controls .note { flex: 1 1 100%; font-size: 0.875rem; }
</style>
