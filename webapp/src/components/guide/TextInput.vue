<script setup>
// Free-text step input: stored as { [key]: string }.
import { ref, watch } from 'vue'

const props = defineProps({ input: { type: Object, required: true }, modelValue: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])
const key = props.input.key || 'text'
const text = ref(props.modelValue?.[key] ?? '')
watch(text, (t) => emit('update:modelValue', { [key]: t }))
</script>

<template>
  <label class="field">
    <span class="prompt">{{ input.prompt || 'Your notes' }}</span>
    <textarea v-model="text" :placeholder="input.placeholder || ''"></textarea>
  </label>
</template>

<style scoped>
.prompt { color: var(--text); font-size: 15px; }
</style>
