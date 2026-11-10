<script setup lang="ts">
// Free-text step input: stored as { [key]: string }.
import type { TextInputSpec } from '~/lib/guides'

const props = defineProps<{ input: TextInputSpec, modelValue?: Record<string, string> | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, string>] }>()
const key = props.input.key || 'text'
const text = ref(props.modelValue?.[key] ?? '')
watch(text, (t) => emit('update:modelValue', { [key]: t }))
</script>

<template>
  <UFormField :label="input.prompt || 'Your notes'" :ui="{ label: 'text-base font-normal text-highlighted' }">
    <UTextarea v-model="text" :placeholder="input.placeholder || ''" :rows="5" autoresize :maxrows="16" size="lg" class="w-full" />
  </UFormField>
</template>
