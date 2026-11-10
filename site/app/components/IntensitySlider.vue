<script setup lang="ts">
// The intensity control: field at 20 mm depth (shown in µT or mG), capped by
// what this helmet allows (or by `max`, e.g. the Brain view's what-if range).
import { fmtSetting } from '#core/lib/units.js'
import { maxFieldUT } from '~/lib/device'

const props = withDefaults(defineProps<{ modelValue: number, max?: number | null, label?: string, disabled?: boolean }>(), {
  max: null,
  label: 'Intensity at 20 mm depth',
})
const emit = defineEmits<{ 'update:modelValue': [value: number], 'change': [value: number] }>()
const top = computed(() => Number((props.max ?? maxFieldUT()).toFixed(1)))
const id = useId()

// The slider reports "done changing" before it has passed on the last value
// when moved from the keyboard, so `change` waits a tick and carries the
// value that was actually set.
let latest = props.modelValue
watch(() => props.modelValue, (v) => (latest = v))
function input(v: number | undefined) {
  latest = Number(v)
  emit('update:modelValue', latest)
}
const done = () => nextTick(() => emit('change', latest))
</script>

<template>
  <div class="grid gap-2">
    <label :for="id" class="flex items-baseline justify-between gap-3 text-sm text-muted">
      <span>{{ label }}</span>
      <b class="num font-display text-xl font-[620] text-highlighted">{{ fmtSetting(modelValue) }}</b>
    </label>
    <USlider :id="id" :model-value="modelValue" :min="0.1" :max="top" :step="0.1" :aria-label="label" :disabled="disabled"
      @update:model-value="input" @change="done" />
    <slot />
  </div>
</template>
