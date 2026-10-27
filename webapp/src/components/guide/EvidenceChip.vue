<script>
// Evidence scale shared with the research docs.
export const EVIDENCE = {
  established: { label: 'established', tone: 'ok', text: 'Replicated by independent groups.' },
  'single-lab': { label: 'single lab', tone: 'blue', text: 'Reported by one lab or group; not independently replicated.' },
  claim: { label: 'claim', tone: 'warn', text: 'Claimed by its originators; no controlled independent test.' },
  anecdote: { label: 'anecdote', tone: '', text: 'Personal reports only.' },
  unverified: { label: 'unverified', tone: '', text: 'Our own design; not tested.' },
}
</script>

<script setup>
import { computed } from 'vue'

const props = defineProps({ level: { type: String, default: '' } })
const ev = computed(() => EVIDENCE[props.level] ?? { label: props.level || 'unknown', tone: '', text: '' })
</script>

<template>
  <span class="chip" :class="ev.tone" :title="ev.text">Evidence: {{ ev.label }}</span>
</template>

<style scoped>
.chip.ok { border-color: var(--ok); color: var(--ok); }
.chip.warn { border-color: var(--warn); color: var(--warn); }
</style>
