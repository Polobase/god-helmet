<script setup lang="ts">
// One guide: what it is, evidence, setting, cautions, sources, the outline of
// its steps and a check of what it needs before Start.
import { fmtMinutes } from '#core/lib/format.js'
import { device } from '~/lib/device'
import { EVIDENCE } from '~/lib/model'
import { presetById } from '~/lib/programs'
import { live } from '~/lib/guideRun'
import { guideMark, guideScene } from '~/lib/art'
import { CATEGORY_LABELS, guidePath, listSets, usableSets, stepDurationMs, plannedMs, armRange, type GuideEntry, type GuideStep, type PictureSet, type StepInput } from '~/lib/guides'

const props = defineProps<{ entry: GuideEntry }>()
const emit = defineEmits<{ start: [options: { headphones: boolean }] }>()
const { safetyPath } = useAppNav()

const doc = computed(() => props.entry.doc)
const mark = computed(() => guideMark(doc.value.category))
const scene = computed(() => guideScene(doc.value.id, doc.value.category))
const errors = computed(() => props.entry.errors ?? [])
const req = computed(() => doc.value.requires ?? {})
const steps = computed(() => doc.value.steps ?? [])
const arm = computed(() => (doc.value.helmetArm && req.value.helmet !== 'none' ? armRange(doc.value) : null))
const armPreset = computed(() => (doc.value.helmetArm ? presetById(doc.value.helmetArm.preset) : null))
const usesTrials = computed(() => steps.value.some((s) => s.input?.type === 'trial'))
const arvGuide = computed(() => steps.value.some((s) => s.input?.type === 'trial' && s.input.action === 'create' && s.input.arv))

const headphones = ref(false)
const sets = ref<PictureSet[] | null>(null)
onMounted(async () => {
  if (req.value.pool || usesTrials.value) {
    try {
      sets.value = await listSets()
    } catch {
      sets.value = []
    }
  }
})
const poolCount = computed(() => (sets.value ? usableSets(sets.value).filter((s) => !arvGuide.value || s.images.length === 2).length : null))
const hoursSinceSession = computed(() => {
  const i = device.info as { lastSessionEpoch?: number, env?: { timeValid?: boolean } } | null
  return i?.lastSessionEpoch && i.env?.timeValid ? (Date.now() / 1000 - i.lastSessionEpoch) / 3600 : null
})

interface Check { key: string, status: 'ok' | 'warn' | 'bad', text: string, link?: string, linkText?: string }
const checks = computed(() => {
  const out: Check[] = []
  if (req.value.headphones) out.push({ key: 'headphones', status: headphones.value ? 'ok' : 'warn', text: headphones.value ? 'Headphones on' : 'Binaural audio needs stereo headphones (on speakers, pick isochronic in the next step)' })
  const helmet = req.value.helmet ?? 'none'
  if (helmet !== 'none' || usesTrials.value) {
    const needed = helmet === 'required' || usesTrials.value
    if (!device.kind) out.push({ key: 'helmet', status: needed ? 'bad' : 'warn', text: needed ? (usesTrials.value ? 'Trial steps need the helmet (or the demo)' : 'This guide needs the helmet') : 'Helmet not connected: the guide runs without the field' })
    else if (device.link !== 'connected') out.push({ key: 'helmet', status: needed ? 'bad' : 'warn', text: 'The connection to the helmet is lost; the app is reconnecting' })
    // After accepting, the safety page returns to this guide.
    else if (device.info && !device.info.safetyAccepted && helmet !== 'none') out.push({ key: 'helmet', status: helmet === 'required' ? 'bad' : 'warn', text: 'Accept the safety page before using the field', link: safetyPath(), linkText: 'Open Safety' })
    else out.push({ key: 'helmet', status: 'ok', text: `${device.kind === 'demo' ? 'Demo helmet' : device.name || 'Helmet'} connected` })
    if (device.kind && helmet !== 'none' && hoursSinceSession.value !== null && hoursSinceSession.value < 72) out.push({ key: 'interval', status: 'warn', text: `Last helmet session ${hoursSinceSession.value.toFixed(0)} h ago; 72 h between sessions is recommended` })
  }
  if (req.value.pool || usesTrials.value) {
    const n = poolCount.value
    out.push({ key: 'pool', status: n === null ? 'warn' : n > 0 ? 'ok' : 'bad', text: n === null ? 'Checking the picture pool…' : n > 0 ? `${n} usable picture set(s)${arvGuide.value ? ' of 2 pictures' : ''}` : arvGuide.value ? 'ARV needs sets of exactly 2 pictures' : 'No usable picture set (2–8 pictures)', link: n ? '' : '/app/trials/pictures', linkText: 'Open the picture pool' })
  }
  return out
})
// One run at a time: another guide's run (or its summary) is still open.
const otherRun = computed(() => (live.phase !== 'idle' && live.guide && live.guide.id !== doc.value.id ? live.guide : null))
const blocked = computed(() => errors.value.length > 0 || checks.value.some((c) => c.status === 'bad') || !!otherRun.value)

const INPUT_LABELS: Record<string, string> = { text: 'notes', sketch: 'sketch', rating: 'ratings', questionnaire: 'questionnaire', choice: 'forced choice', outcome: 'outcome', rng: 'RNG task' }
const inputLabel = (inp?: StepInput) => {
  if (!inp || inp.type === 'none') return ''
  if (inp.type === 'crv') return `CRV stage ${inp.stage}`
  if (inp.type === 'trial') return `trial: ${inp.action}`
  return INPUT_LABELS[inp.type] ?? inp.type
}
const minutesOf = (s: GuideStep) => {
  const ms = stepDurationMs(s)
  return ms === null ? 'open' : ms < 60000 ? `${Math.round(ms / 1000)} s` : `${Math.round((ms / 60000) * 10) / 10} min`
}
const tagsOf = (s: GuideStep, i: number) => [
  s.audio ? 'audio' : '',
  arm.value && i >= arm.value.first && i <= arm.value.last ? 'helmet' : '',
  inputLabel(s.input),
  (s.advance ?? (stepDurationMs(s) ? 'timer' : 'manual')) === 'manual' ? 'you press Next' : '',
].filter(Boolean)
const evidenceText = computed(() => EVIDENCE[doc.value.evidence ?? '']?.info ?? '')
const MARK = {
  ok: { icon: 'i-lucide-check', cls: 'text-success', label: 'ready' },
  warn: { icon: 'i-lucide-triangle-alert', cls: 'text-warning', label: 'check' },
  bad: { icon: 'i-lucide-x', cls: 'text-error', label: 'missing' },
}
</script>

<template>
  <div class="grid gap-5">
    <header class="panel grid items-center gap-x-10 px-5 pb-5 pt-4 sm:px-7 sm:pb-7 sm:pt-5" :class="{ 'lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]': scene }">
      <div class="grid gap-4">
        <div><UButton to="/app/guides" variant="link" color="neutral" icon="i-lucide-arrow-left" class="px-0">All guides</UButton></div>
        <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-muted">
          <ArtMark v-if="mark" :name="mark" class="w-9 shrink-0 text-toned" :class="{ 'lg:hidden': scene }" />
          <span>{{ CATEGORY_LABELS[doc.category] ?? doc.category }}, <span class="num">{{ doc.minutes ?? Math.round(plannedMs(doc) / 60000) }}</span> min</span>
          <EvidenceBadge :level="doc.evidence" />
        </p>
        <h1 class="max-w-[24ch] text-3xl sm:text-[2.6rem]">{{ doc.name }}</h1>
        <GuideReqIcons :requires="req" labelled />
        <p class="measure text-[1.05rem] text-highlighted">{{ doc.summary }}</p>
        <p v-if="evidenceText" class="text-sm text-muted">Evidence: {{ evidenceText }}</p>
      </div>
      <!-- What the guide is about, where there is room for it; a phone shows the small mark above instead. -->
      <ArtScene v-if="scene" :name="scene" class="text-toned max-lg:hidden" />
    </header>

    <UAlert v-if="errors.length" color="error" variant="subtle" icon="i-lucide-file-x" title="This guide file has errors and cannot run" :description="errors.join('; ')" />
    <UAlert v-if="otherRun" color="warning" variant="subtle" icon="i-lucide-circle-play" :title="`“${otherRun.name}” is ${live.phase === 'summary' ? 'at its summary' : 'still running'}`"
      description="One guide runs at a time. Finish or stop it before you start this one."
      :actions="[{ label: live.phase === 'summary' ? 'Open its summary' : 'Back to the running guide', to: guidePath(otherRun.id), color: 'neutral', variant: 'outline' }]" />

    <div class="grid items-start gap-5 lg:grid-cols-2">
      <section class="panel grid gap-4 p-5 sm:p-7">
        <div class="grid gap-1.5">
          <h2 class="text-xl">Setting</h2>
          <p class="measure text-sm">{{ doc.setting || '–' }}</p>
        </div>
        <div class="grid gap-1.5">
          <h2 class="text-xl text-warning">Cautions</h2>
          <p class="measure border-l-[3px] border-warning pl-3 text-sm text-highlighted">{{ doc.cautions || 'Stop at once if you feel unwell.' }}</p>
        </div>
        <div v-if="doc.unlock" class="grid gap-1.5">
          <h2 class="text-xl">When to try it</h2>
          <p class="measure text-sm">{{ doc.unlock }}</p>
        </div>
      </section>

      <section class="panel grid gap-4 p-5 sm:p-7">
        <h2 class="text-xl">Before you start</h2>
        <ul class="grid gap-2.5">
          <li v-for="c in checks" :key="c.key" class="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5 text-sm">
            <UIcon :name="MARK[c.status].icon" class="mt-0.5 size-4.5" :class="MARK[c.status].cls" /><span class="sr-only">{{ MARK[c.status].label }}: </span>
            <span :class="c.status === 'bad' ? 'text-error' : c.status === 'ok' ? 'text-muted' : 'text-highlighted'">{{ c.text }}<template v-if="c.link">. <NuxtLink :to="c.link" class="text-primary underline underline-offset-4">{{ c.linkText || 'Open' }}</NuxtLink></template></span>
          </li>
          <li v-if="!checks.length" class="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5 text-sm">
            <UIcon name="i-lucide-check" class="mt-0.5 size-4.5 text-success" /><span class="sr-only">ready: </span><span class="text-muted">Nothing to prepare beyond the setting.</span>
          </li>
        </ul>
        <UCheckbox v-if="req.headphones" v-model="headphones" label="I'm wearing stereo headphones (closed-back if possible)" />
        <AppConnect v-if="!device.kind && (req.helmet && req.helmet !== 'none' || usesTrials)" />
        <p v-if="arm && armPreset" class="text-sm text-muted">Helmet arm: “{{ armPreset.doc.name }}” during {{ steps.slice(arm.first, arm.last + 1).map((s) => s.title).join(', ') }}{{ doc.helmetArm!.blind ? ' (blind real/sham, revealed after your rating)' : '' }}.</p>
        <p v-else-if="arm && !armPreset" class="text-sm text-warning">Helmet arm preset “{{ doc.helmetArm!.preset }}” is missing; the guide runs without it.</p>
        <div>
          <UButton color="primary" variant="solid" size="xl" class="min-w-40 justify-center" :disabled="blocked" @click="emit('start', { headphones })">Start</UButton>
        </div>
      </section>
    </div>

    <section class="panel grid gap-4 p-5 sm:p-7">
      <h2 class="text-xl">Steps <span class="num font-sans text-sm font-normal text-muted">{{ steps.length }}</span></h2>
      <ol class="grid max-w-3xl">
        <li v-for="(s, i) in steps" :key="s.id" class="grid grid-cols-[1.8em_minmax(0,1fr)_auto] gap-x-2.5 border-b border-default py-2 last:border-b-0">
          <span class="num text-muted">{{ i + 1 }}</span>
          <span class="text-highlighted">{{ s.title }}</span>
          <span class="num text-sm text-muted">{{ minutesOf(s) }}</span>
          <span v-if="tagsOf(s, i).length" class="col-start-2 col-end-4 text-sm text-muted">{{ tagsOf(s, i).join(', ') }}</span>
        </li>
      </ol>
      <p class="text-sm text-muted">Planned time {{ fmtMinutes(plannedMs(doc)) }}{{ steps.some((s) => stepDurationMs(s) === null) ? ' plus open-ended steps' : '' }}.</p>
    </section>

    <section v-if="doc.sources?.length" class="panel grid gap-3 p-5 sm:p-7">
      <h2 class="text-xl">Sources <span class="num font-sans text-sm font-normal text-muted">{{ doc.sources.length }}</span></h2>
      <ul class="measure grid list-disc gap-1.5 pl-5 text-sm">
        <li v-for="(s, i) in doc.sources" :key="i">
          <a v-if="s.url" :href="s.url" target="_blank" rel="noopener" class="text-primary underline underline-offset-4">{{ s.title || s.url }}</a>
          <span v-else>{{ s.title }}</span>
        </li>
      </ul>
      <p class="text-sm text-muted">Structure cited from the sources; all instructions are our own wording.</p>
    </section>

    <slot />
  </div>
</template>
