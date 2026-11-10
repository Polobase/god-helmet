<script setup lang="ts">
// The rating of one log entry: the number, or the way to give one.
import type { LogEntry } from '~/lib/helmet'

withDefaults(defineProps<{
  entry: LogEntry
  /** The session still runs: rating it would reveal real or sham too early. */
  live: boolean
  /** Its rating form is open. */
  open: boolean
  /** Say here that a trial's blind session is rated after the reveal (the phone layout says it on a line of its own). */
  trialNote?: boolean
}>(), { trialNote: true })
defineEmits<{ rate: [] }>()
</script>

<template>
  <div class="grid justify-items-start gap-1">
    <span v-if="entry.rating >= 0" class="num font-semibold text-highlighted"><span class="sr-only sm:hidden">Rating </span>{{ entry.rating }}<span class="font-normal text-muted sm:hidden"> / 10</span></span>
    <span v-else-if="live" class="text-sm text-muted">After it ends</span>
    <UButton v-else-if="!open" size="sm" :aria-label="`Rate ${entry.presetName}`" @click="$emit('rate')">Rate</UButton>
    <span v-else class="text-sm text-muted">Rating…</span>
    <span v-if="trialNote && entry.trialId && entry.rating < 0 && entry.blind" class="text-sm text-muted">Trial #{{ entry.trialId }}: rate it after the trial is revealed.</span>
  </div>
</template>
