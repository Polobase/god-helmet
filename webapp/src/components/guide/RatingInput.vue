<script setup>
// Rating items ({key, label, min, max, minLabel, maxLabel}): stored as { [key]: number }.
import { reactive, useId, watch } from 'vue'

const props = defineProps({ input: { type: Object, required: true }, modelValue: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])
const uid = useId()

const items = (props.input.items ?? []).map((it) => ({ min: 0, max: 10, ...it }))
const values = reactive(Object.fromEntries(items.map((it) => [it.key, props.modelValue?.[it.key] ?? null])))
watch(values, (v) => emit('update:modelValue', { ...v }), { deep: true })

const range = (it) => Array.from({ length: it.max - it.min + 1 }, (_, i) => it.min + i)
const segmented = (it) => it.max - it.min <= 10
</script>

<template>
  <div class="stack">
    <p v-if="input.prompt" class="prompt">{{ input.prompt }}</p>
    <fieldset v-for="it in items" :key="it.key" class="item" :style="segmented(it) ? { maxWidth: `${range(it).length * 60}px` } : null">
      <legend>{{ it.label || it.key }}</legend>
      <div v-if="segmented(it)" class="scale">
        <label v-for="v in range(it)" :key="v" class="opt">
          <input v-model.number="values[it.key]" type="radio" :name="`${uid}-${it.key}`" :value="v"
            :aria-label="`${v}${v === it.min && it.minLabel ? ` (${it.minLabel})` : ''}${v === it.max && it.maxLabel ? ` (${it.maxLabel})` : ''}`" />
          <span class="num">{{ v }}</span>
        </label>
      </div>
      <div v-else class="row">
        <input v-model.number="values[it.key]" type="range" :min="it.min" :max="it.max" step="1" :aria-label="it.label || it.key" />
        <b class="num">{{ values[it.key] ?? '–' }}</b>
      </div>
      <div v-if="it.minLabel || it.maxLabel" class="ends small muted"><span>{{ it.minLabel }}</span><span>{{ it.maxLabel }}</span></div>
    </fieldset>
  </div>
</template>

<style scoped>
.prompt { font-size: 15px; }
.item { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; min-width: 0; }
legend { font-weight: 600; padding: 0; margin-bottom: 6px; }
.scale { display: flex; flex-wrap: wrap; gap: 4px; }
.opt { position: relative; flex: 1 1 0; min-width: 0; max-width: 56px; }
.opt input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.opt span { display: block; text-align: center; padding: 9px 0; border: 1px solid var(--line); border-radius: 6px; background: var(--surface-2); font-size: 16px; }
.opt input:checked + span { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.opt input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
.ends { display: flex; justify-content: space-between; gap: 12px; }
.row b { min-width: 2.5em; text-align: right; }
</style>
