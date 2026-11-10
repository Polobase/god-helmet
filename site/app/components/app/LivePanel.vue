<script setup lang="ts">
// Live view of the running session, plus the rating prompt afterwards. While
// the connection is down the session stays on screen, its time estimated from
// the clock, and the controls say why they are off.
import { fmtDuration } from '#core/lib/format.js'
import { device, call, reconnect, errorMessage, NEEDS_LINK, STOP_ANSWER_MS } from '~/lib/device'
import { presetById, LAYOUTS, sessionSites } from '~/lib/programs'
import { ratingDue, ratingDone } from '~/lib/rating'

// rate: false where another view already asks for the rating (the header's copy).
const props = withDefaults(defineProps<{ rate?: boolean }>(), { rate: true })
const { st, online, lost } = useHelmetLink()
const toast = useToast()
const preset = computed(() => (st.value ? presetById(st.value.sessionId) : null))
const sites = computed(() => (preset.value?.session
  ? sessionSites(preset.value.session)
  : LAYOUTS[st.value?.sessionId === 'test-rotate' ? device.testLayout : 'temporal'].channels.map((c) => c.site)))
const field = ref(1)
const editingField = ref(false)
// Coil activity is known only from a live status.
const levels = computed(() => (!st.value || st.value.blind || st.value.estimated ? new Array<number>(8).fill(0) : st.value.levels))

watch(() => device.status, (s) => {
  if (s && !editingField.value && s.fieldUT) field.value = s.fieldUT
}, { immediate: true })

// A request that fails says so: the helmet may not have got it.
const fail = (what: string, e: unknown, hint?: string) => toast.add({ id: what, title: `${what}: ${errorMessage(e)}`, description: hint, color: 'error', icon: 'i-lucide-circle-x', duration: 8000 })
// Stop is never held back: it can be pressed again while an earlier one waits for its answer.
const stop = () => call('session.stop', {}, STOP_ANSWER_MS).catch((e: unknown) => fail('Stop did not reach the helmet', e, 'Use the STOP button on the helmet if it does not stop.'))
// (Skip is: pressed twice, it would skip two phases.)
const skipping = ref(false)
async function skip() {
  skipping.value = true
  try {
    await call('session.skip')
  } catch (e) {
    fail('The phase was not skipped', e)
  } finally {
    skipping.value = false
  }
}

async function setField() {
  editingField.value = false
  try {
    await call('session.field', { fieldUT: Number(field.value) })
  } catch (e) {
    fail('The intensity was not changed', e)
    if (device.status?.fieldUT) field.value = device.status.fieldUT // back to what the helmet has
  }
}

// Rating after a logged session ends (lib/rating.ts remembers which one, per helmet).
const due = computed(() => (props.rate ? ratingDue() : null))
const rating = ref(5)
const notes = ref('')
const revealed = ref('')
const saving = ref(false)
watch(() => due.value?.logId, () => {
  rating.value = 5
  notes.value = ''
})

async function saveRating() {
  const w = due.value
  if (!w || saving.value) return
  saving.value = true
  try {
    const r = await call<{ blind: boolean, condition: string }>('log.rate', { id: w.logId, rating: Number(rating.value), notes: notes.value })
    revealed.value = r.blind ? `This blind session was ${r.condition}.` : 'Saved.'
    setTimeout(() => {
      ratingDone(w.logId, w.helmet)
      revealed.value = ''
      notes.value = ''
    }, 5000)
  } catch (e) {
    fail('The rating was not saved', e)
  } finally {
    saving.value = false
  }
}
const pct = (a: number, b: number) => (100 * a) / Math.max(1, b)
</script>

<template>
  <section v-if="st && st.state !== 'idle'" class="panel p-5 grid gap-5" :class="lost ? 'border-warning!' : 'border-primary!'" aria-live="polite" data-test="live-panel">
    <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,15rem)] items-center">
      <div class="grid gap-1.5">
        <p class="text-sm" :class="lost ? 'text-warning' : 'text-muted'">
          <template v-if="lost"><UIcon name="i-lucide-unplug" class="mr-1 size-3.5 align-[-0.125em]" aria-hidden="true" />{{ device.gaveUp || device.needsChooser ? 'Connection lost' : 'Connection lost, reconnecting…' }}</template>
          <template v-else>{{ st.test ? 'Test' : 'Session running' }}</template><template v-if="st.blind">, blind</template>
        </p>
        <h2 class="text-2xl">{{ st.sessionName }}</h2>
        <p class="text-sm text-muted">
          <template v-if="st.estimated">Phase {{ st.phase + 1 }} of {{ st.phaseCount }} when last seen: {{ st.phaseName }}</template>
          <template v-else>Phase {{ st.phase + 1 }} of {{ st.phaseCount }}: {{ st.phaseName }}<template v-if="st.state === 'stopping'">, stopping</template></template>
        </p>
        <p class="num font-display text-5xl font-[620] leading-none mt-2" :class="st.estimated ? 'text-toned' : 'text-highlighted'">{{ fmtDuration(st.totalMs - st.programMs) }}</p>
        <p v-if="st.estimated" class="text-sm text-muted">{{ st.over ? 'By the clock it should be over.' : 'left, estimated from the clock' }}</p>
      </div>
      <div class="max-sm:max-w-64" :class="{ 'opacity-50': st.estimated }">
        <SiteMap :sites="sites" :levels="levels" :labels="false" :caption="false" />
      </div>
    </div>
    <div class="grid gap-2">
      <template v-if="!st.estimated">
        <div class="text-sm text-muted">Phase</div>
        <UProgress :model-value="pct(st.phaseMs, st.phaseDurationMs)" size="sm" aria-label="Phase progress" />
      </template>
      <div class="text-sm text-muted">Session<template v-if="st.estimated"> (estimated)</template></div>
      <UProgress :model-value="pct(st.programMs, st.totalMs)" size="sm" :color="st.estimated ? 'neutral' : 'primary'" aria-label="Session progress" />
    </div>
    <IntensitySlider v-if="!st.test" :model-value="Number(field)" label="Intensity at 20 mm" :disabled="!online" @update:model-value="(v) => ((field = v), (editingField = true))" @change="setField" />
    <p v-if="st.blind" class="text-sm text-muted">Blind session: coil activity is hidden. The log reveals real or sham after you rate it.</p>
    <div class="flex flex-wrap items-center gap-3">
      <!-- On the last phase, skipping is the same as Stop, so only offer it while a next phase exists. -->
      <UButton v-if="st.phase + 1 < st.phaseCount" :disabled="st.state === 'stopping' || !online || skipping" :loading="skipping" @click="skip">Skip to next phase</UButton>
      <UButton color="error" variant="solid" class="disabled:opacity-45" :disabled="!online" :title="online ? undefined : NEEDS_LINK" @click="stop">Stop session</UButton>
      <span v-if="!online" class="text-sm text-warning" data-test="stop-reason">{{ NEEDS_LINK }}</span>
      <UButton v-if="lost" size="sm" variant="ghost" icon="i-lucide-refresh-cw" :loading="device.link === 'reconnecting'" @click="reconnect()">Reconnect</UButton>
      <span v-else class="text-sm text-muted">Stop fades the field out over 2 s{{ st.test ? '' : ' and keeps the session in the Log' }}.</span>
    </div>
  </section>

  <section v-else-if="due" class="panel p-5 grid gap-3" data-test="rating-prompt">
    <h2 class="text-2xl">How was it?</h2>
    <p class="text-sm text-muted"><b class="font-semibold text-highlighted">{{ due.name }}.</b> Rate before you look anything up. For blind sessions this reveals whether the field was real.</p>
    <RatingForm v-model:rating="rating" v-model:notes="notes" cancel-label="Later (in the Log)" @save="saveRating" @cancel="ratingDone(due.logId, due.helmet)" />
    <p v-if="revealed" class="text-success">{{ revealed }}</p>
  </section>
</template>
