<script setup lang="ts">
// How well a claim is supported, on the scale of the evidence review.
import { EVIDENCE } from '~/lib/model'

const props = defineProps<{
  level?: string
  size?: 'sm' | 'md'
  /** What the level means here, where that differs from the app's wording. */
  info?: string
}>()

type Tone = 'success' | 'info' | 'warning' | 'neutral'
const TONE: Record<string, Tone> = { ok: 'success', blue: 'info', warn: 'warning' }
const ICON: Record<string, string> = {
  'established': 'i-lucide-check-check',
  'single-lab': 'i-lucide-check',
  'claim': 'i-lucide-message-circle',
  'anecdote': 'i-lucide-user',
  'unverified': 'i-lucide-circle-dashed',
}
const entry = computed(() => EVIDENCE[props.level ?? ''])
const meaning = computed(() => props.info ?? entry.value?.info ?? '')
</script>

<template>
  <UTooltip v-if="entry" :text="meaning">
    <UBadge :color="TONE[entry.tone] ?? 'neutral'" variant="subtle" :size="size ?? 'sm'" :icon="ICON[level!]" class="align-[0.08em] whitespace-nowrap" tabindex="0">
      {{ entry.label }}<span class="sr-only">: {{ meaning }}</span>
    </UBadge>
  </UTooltip>
</template>
