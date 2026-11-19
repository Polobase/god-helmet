<script setup lang="ts">
// How well this helmet reproduces the exposure a program's source describes.
// The evidence badge next to it rates the source itself.
import { FIDELITY } from '~/lib/model'

const props = defineProps<{
  level?: string
  size?: 'sm' | 'md'
}>()

type Tone = 'success' | 'info' | 'warning' | 'neutral'
const TONE: Record<string, Tone> = { ok: 'success', blue: 'info', warn: 'warning' }
const ICON: Record<string, string> = {
  exact: 'i-lucide-equal',
  approximation: 'i-lucide-equal-approximately',
  timing: 'i-lucide-timer',
  construct: 'i-lucide-pencil-ruler',
}
const entry = computed(() => FIDELITY[props.level ?? ''])
</script>

<template>
  <UTooltip v-if="entry" :text="entry.info">
    <UBadge :color="TONE[entry.tone] ?? 'neutral'" variant="outline" :size="size ?? 'sm'" :icon="ICON[level!]" class="align-[0.08em] whitespace-nowrap" tabindex="0">
      {{ entry.label }}<span class="sr-only">: {{ entry.info }}</span>
    </UBadge>
  </UTooltip>
</template>
