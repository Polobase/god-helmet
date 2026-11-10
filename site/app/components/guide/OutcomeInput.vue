<script setup lang="ts">
// ARV outcome entry: stored as { [key]: option } or { [key]: null } while unknown.
import type { OutcomeInputSpec } from '~/lib/guides'

const props = defineProps<{ input: OutcomeInputSpec, modelValue?: Record<string, string | null> | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, string | null>] }>()
const key = props.input.key || 'outcome'
const options = props.input.options?.length ? props.input.options : ['A', 'B']
const UNKNOWN = '__unknown__'
const prior = props.modelValue?.[key]
const choice = ref<string | number | null>(prior === undefined ? '' : prior === null ? UNKNOWN : prior)
const name = useId()
watch(choice, (c) => emit('update:modelValue', { [key]: c === UNKNOWN ? null : String(c) }))
const items = [...options.map((o) => ({ value: o })), { value: UNKNOWN, text: 'Not known yet' }]
</script>

<template>
  <fieldset class="grid gap-3">
    <legend class="mb-3 text-highlighted">{{ input.prompt || 'Which outcome actually happened?' }}</legend>
    <p class="measure text-sm text-muted">Enter it only once the result is public and final. It cannot change the prediction, which was fixed when you ranked the pictures.</p>
    <GuideOptionRow v-model="choice" :options="items" :name="name" words class="outcome font-semibold" />
  </fieldset>
</template>

<style scoped>
.outcome :deep(label) { flex: 0 1 auto; min-width: 4.5rem; }
.outcome :deep(span) { padding: 0.75rem 1.1rem; }
</style>
