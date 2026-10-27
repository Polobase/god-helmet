<script setup>
// Sketch step input: stored as { [key]: PNG data URL }.
import { ref } from 'vue'
import SketchPad from '../SketchPad.vue'

const props = defineProps({ input: { type: Object, required: true }, modelValue: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])
const key = props.input.key || 'sketch'
const pad = ref(null)
</script>

<template>
  <div class="stack">
    <p class="prompt">{{ input.prompt || 'Sketch what you perceive. Shapes and lines, no artistry needed.' }}</p>
    <SketchPad ref="pad" :initial="modelValue?.[key] || ''" @change="(d) => emit('update:modelValue', { [key]: d })" />
    <div class="row"><button type="button" class="btn ghost sm" @click="pad?.clear()">Clear sketch</button></div>
  </div>
</template>

<style scoped>
.prompt { font-size: 15px; }
</style>
