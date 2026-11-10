<script setup lang="ts">
// Sketch step input: stored as { [key]: PNG data URL }.
import type { SketchInputSpec } from '~/lib/guides'

const props = defineProps<{ input: SketchInputSpec, modelValue?: Record<string, string> | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, string>] }>()
const key = props.input.key || 'sketch'
</script>

<template>
  <div class="grid gap-3">
    <p class="text-highlighted">{{ input.prompt || 'Sketch what you perceive. Shapes and lines, no artistry needed.' }}</p>
    <SketchPad label="" :initial="modelValue?.[key] || ''" @change="(d) => emit('update:modelValue', { [key]: d })" />
  </div>
</template>
