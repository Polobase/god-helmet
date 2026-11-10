<script setup lang="ts">
// Start panel of a program: what is ready and what is not, intensity, blind,
// and Start. Opened from the program header; it stays open across the detour
// to the safety page.
import { fmtMinutes } from '#core/lib/format.js'
import { headInUse } from '#core/lib/head.js'
import { fmtSetting } from '#core/lib/units.js'
import { device, start as startOnHelmet, reconnect, maxFieldUT, errorMessage } from '~/lib/device'
import { presetById, program, groupOf, usedCoils, placedCount, readiness, hoursSinceLast, minGapHours } from '~/lib/programs'

const { safetyPath } = useAppNav()
const preset = computed(() => presetById(program.id)!)
const group = computed(() => groupOf(program.id))
const nowS = ref(Date.now() / 1000)
const rows = computed(() => readiness({ device, head: headInUse(), placed: placedCount(group.value), used: usedCoils(group.value).length, nowS: nowS.value }))

const maxField = computed(() => maxFieldUT())
const field = computed({
  get: () => Math.min(program.uT, maxField.value),
  set: (v: number) => (program.uT = Number(v)),
})
const capped = computed(() => program.uT > maxField.value + 1e-9)
const blind = ref(false)
const busy = computed(() => !!device.status && device.status.state !== 'idle')
const { online, lost } = useHelmetLink()
// Until the first status after connecting is in, the app does not know whether a session runs.
const checking = computed(() => online.value && !device.ready)
const starting = ref(false)
const startNote = ref('')
const startError = ref('')
const confirmRecent = ref(false)
const recentH = computed(() => hoursSinceLast(device.info, nowS.value))
const tooSoon = computed(() => recentH.value !== null && recentH.value < minGapHours(device.info))

const open = computed({ get: () => program.startOpen, set: (v: boolean) => (program.startOpen = v) })
watch(open, (o) => {
  if (!o) return
  nowS.value = Date.now() / 1000
  startError.value = ''
  confirmRecent.value = false
}, { immediate: true })
// Kept open only for the way back from the safety page.
onBeforeRouteLeave((to) => {
  if (!to.path.startsWith('/app/safety')) program.startOpen = false
})

const ACTION: Record<string, string> = { safety: 'Read the safety page', measure: 'Measure', place: 'Place the coils', calibrate: 'Calibrate' }
function act(action: string) {
  if (action === 'safety') return navigateTo(safetyPath())
  program.startOpen = false
  if (action === 'measure' || action === 'place') {
    program.focus = action
    return navigateTo(programPath(program.id, 'placement'))
  }
  if (action === 'calibrate') return navigateTo('/app/helmet')
}

async function start() {
  startError.value = ''
  if (tooSoon.value && !confirmRecent.value) {
    confirmRecent.value = true
    return
  }
  confirmRecent.value = false
  starting.value = true
  startNote.value = ''
  try {
    // With a token: when the answer gets lost, the app finds the session again instead of starting a second one.
    await startOnHelmet('session.start', { session: preset.value.doc, presetId: preset.value.doc.id, fieldUT: Number(field.value), blind: blind.value }, {
      onWaiting: () => (startNote.value = 'No answer from the helmet yet. The app is finding out whether the session has started; it will not be started twice.'),
    })
    program.startOpen = false
    window.scrollTo({ top: 0, behavior: smooth() })
  } catch (e) {
    startError.value = errorMessage(e)
    if (/safety/.test(startError.value)) navigateTo(safetyPath())
  } finally {
    starting.value = false
    startNote.value = ''
  }
}
const startLabel = computed(() => (busy.value ? 'A session is running' : lost.value ? 'Connection lost' : checking.value ? 'Checking the helmet…' : starting.value ? 'Starting…' : confirmRecent.value ? 'Start anyway' : 'Start'))
const MARK = {
  ok: { icon: 'i-lucide-check', cls: 'text-success' },
  warn: { icon: 'i-lucide-triangle-alert', cls: 'text-warning' },
  bad: { icon: 'i-lucide-x', cls: 'text-error' },
}
</script>

<template>
  <UModal v-model:open="open" :title="preset.doc.name"
    :description="preset.session ? `Start: ${fmtMinutes(preset.session.totalMs)}, ${preset.session.phases.length} phase${preset.session.phases.length === 1 ? '' : 's'}` : 'Start'"
    :ui="{ content: 'sm:max-w-xl', title: 'font-display text-xl font-[620]' }">
    <template #body>
      <div class="grid gap-5">
        <ul class="grid gap-2.5" aria-label="Ready to start?">
          <li v-for="r in rows" :key="r.key" class="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1.5 text-sm sm:grid-cols-[1.25rem_minmax(0,1fr)_auto]">
            <UIcon :name="MARK[r.status].icon" class="size-4.5" :class="MARK[r.status].cls" /><span class="sr-only">{{ r.status === 'ok' ? 'ready' : r.status === 'warn' ? 'check' : 'missing' }}: </span>
            <span :class="r.status === 'ok' ? 'text-muted' : 'text-highlighted'">{{ r.text }}</span>
            <AppConnect v-if="r.action === 'connect'" size="xs" class="max-sm:col-start-2" />
            <UButton v-else-if="r.key === 'connect' && lost" size="xs" icon="i-lucide-refresh-cw" class="justify-self-start max-sm:col-start-2 sm:justify-self-end" :loading="device.link === 'reconnecting'" @click="reconnect()">Reconnect</UButton>
            <UButton v-else-if="r.action" size="xs" variant="link" color="primary" class="justify-self-start px-0 max-sm:col-start-2 sm:justify-self-end" @click="act(r.action)">{{ ACTION[r.action] }}</UButton>
          </li>
        </ul>

        <IntensitySlider v-model="field" />
        <p v-if="capped" class="text-sm text-muted">The Brain view was set to {{ fmtSetting(program.uT) }}; this helmet allows up to {{ fmtSetting(maxField) }}.</p>
        <UCheckbox v-model="blind" label="Blind" description="The helmet picks real or sham at random, and tells you after you rate the session." />
        <UAlert v-if="confirmRecent" color="warning" variant="subtle" icon="i-lucide-clock" role="alert"
          :title="`Last session was ${recentH?.toFixed(0)} h ago`" :description="`${minGapHours(device.info)} h between sessions is recommended. Press Start anyway to continue.`" />
        <p v-if="startNote" class="text-sm text-warning" role="status">{{ startNote }}</p>
        <p v-if="startError" class="text-sm text-error" role="alert">{{ startError }}</p>
      </div>
    </template>
    <template v-if="device.kind" #footer>
      <UButton color="primary" variant="solid" size="lg" class="min-w-36 justify-center" :disabled="busy || !online || checking || starting" :loading="starting" @click="start">{{ startLabel }}</UButton>
      <span class="text-sm text-muted">on {{ device.kind === 'demo' ? 'the demo' : device.name }}</span>
    </template>
  </UModal>
</template>
