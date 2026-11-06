<script setup>
// The intensity control: µT at 20 mm depth, capped by what this helmet allows
// (or by `max`, e.g. the Brain view's what-if range).
import { computed } from 'vue'
import { maxFieldUT } from '../ble/device.js'

const props = defineProps({
  modelValue: { type: Number, required: true },
  max: { type: Number, default: null },
  label: { type: String, default: 'Intensity at 20 mm depth' },
})
const emit = defineEmits(['update:modelValue', 'change'])
const top = computed(() => props.max ?? maxFieldUT())
</script>

<template>
  <label class="field">
    <span>{{ label }}: <b class="num">{{ Number(modelValue).toFixed(1) }} µT</b></span>
    <input :value="modelValue" type="range" min="0.1" :max="top.toFixed(1)" step="0.1"
      @input="emit('update:modelValue', Number($event.target.value))" @change="emit('change', Number($event.target.value))" />
    <slot />
  </label>
</template>
