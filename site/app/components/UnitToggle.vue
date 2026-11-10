<script setup lang="ts">
// Show field strengths in tesla (µT) or gauss (mG): 1 µT = 10 mG. Only the
// display changes; programs, settings and the helmet keep µT.
import { units, setFieldUnit, UNIT_LABEL, UNIT_NAME } from '#core/lib/units.js'

defineProps<{ long?: boolean }>()
const UNITS = ['T', 'G'] as const
</script>

<template>
  <UFieldGroup size="xs" role="group" aria-label="Field unit" title="Show fields in tesla (µT) or gauss (mG): 1 µT = 10 mG">
    <UButton v-for="u in UNITS" :key="u" :variant="units.field === u ? 'soft' : 'outline'" :color="units.field === u ? 'primary' : 'neutral'" :aria-pressed="units.field === u" :aria-label="`${UNIT_LABEL[u]} (${UNIT_NAME[u]})`" @click="setFieldUnit(u)">
      {{ UNIT_LABEL[u] }}<template v-if="long"> ({{ UNIT_NAME[u] }})</template>
    </UButton>
  </UFieldGroup>
</template>
