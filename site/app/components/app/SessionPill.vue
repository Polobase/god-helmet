<script setup lang="ts">
// The running session, on every page: what runs, the time left and Stop. The
// name opens the live panel (coil activity, intensity, Skip). While the
// connection is down it stays, with the time left estimated from the clock.
import { fmtDuration } from '#core/lib/format.js'
import { call, errorMessage, NEEDS_LINK, STOP_ANSWER_MS } from '~/lib/device'

defineProps<{ open?: boolean }>()
defineEmits<{ toggle: [] }>()
const { st, online, lost } = useHelmetLink()
const toast = useToast()

const left = computed(() => (st.value ? fmtDuration(Math.max(0, st.value.totalMs - st.value.programMs)) : ''))
const time = computed(() => {
  const s = st.value
  if (!s) return ''
  if (s.estimated) return s.over ? 'should be over' : `about ${left.value}`
  return s.state === 'stopping' ? 'stopping' : left.value
})
// Stop can be pressed again while an earlier one still waits for its answer:
// it is never held back. One that fails says so.
async function stop() {
  try {
    await call('session.stop', {}, STOP_ANSWER_MS)
  } catch (e) {
    toast.add({ id: 'stop-failed', title: `Stop did not reach the helmet: ${errorMessage(e)}`, description: 'Use the STOP button on the helmet if it does not stop.', color: 'error', icon: 'i-lucide-circle-x', duration: 8000 })
  }
}
</script>

<template>
  <div v-if="st && st.state !== 'idle'" class="flex min-w-0 items-center gap-1 rounded-full border py-0.5 pl-1 pr-0.5" :class="lost ? 'border-warning/60 bg-warning/10' : 'border-primary/50 bg-primary/10'" data-test="session-pill" :data-lost="lost || undefined">
    <button type="button" class="flex min-w-0 items-center gap-2 rounded-full px-2 py-1 text-sm text-highlighted cursor-pointer" :aria-expanded="open" :title="open ? 'Hide the live panel' : 'Show the live panel'" @click="$emit('toggle')">
      <UIcon v-if="lost" name="i-lucide-unplug" class="size-3.5 shrink-0 text-warning" aria-hidden="true" />
      <span v-else class="size-2 shrink-0 rounded-full" :class="st.state === 'stopping' ? 'bg-(--ui-text-muted)' : 'bg-primary beat'" aria-hidden="true" />
      <span class="min-w-0 max-w-[14rem] truncate font-semibold">{{ st.test ? `Test: ${st.sessionName}` : st.sessionName }}</span>
      <span v-if="lost" class="sr-only">, connection lost,</span>
      <span class="num whitespace-nowrap text-muted">{{ time }}</span>
    </button>
    <UButton color="error" variant="solid" size="xs" class="rounded-full px-3 disabled:opacity-45" :disabled="st.state === 'stopping' || !online" :title="online ? undefined : NEEDS_LINK" @click="stop">Stop</UButton>
  </div>
</template>

<style scoped>
.beat { box-shadow: 0 0 0 3px var(--glow); animation: beat 1.6s ease-in-out infinite; }
@keyframes beat { 50% { box-shadow: 0 0 0 6px transparent; } }
</style>
