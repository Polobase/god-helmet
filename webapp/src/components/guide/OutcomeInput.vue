<script setup>
// ARV outcome entry: stored as { [key]: option } or { [key]: null } while unknown.
import { ref, useId, watch } from 'vue'

const props = defineProps({ input: { type: Object, required: true }, modelValue: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])
const key = props.input.key || 'outcome'
const options = props.input.options?.length ? props.input.options : ['A', 'B']
const UNKNOWN = '__unknown__'
const prior = props.modelValue?.[key]
const choice = ref(prior === undefined ? '' : prior === null ? UNKNOWN : prior)
const name = useId()
watch(choice, (c) => emit('update:modelValue', { [key]: c === UNKNOWN ? null : c }))
</script>

<template>
  <fieldset class="stack">
    <legend class="prompt">{{ input.prompt || 'Which outcome actually happened?' }}</legend>
    <p class="small muted">Enter it only once the result is public and final. It cannot change the prediction, which was fixed when you ranked the pictures.</p>
    <div class="opts">
      <label v-for="o in options" :key="o" class="opt">
        <input v-model="choice" type="radio" :name="name" :value="o" />
        <span>{{ o }}</span>
      </label>
      <label class="opt">
        <input v-model="choice" type="radio" :name="name" :value="UNKNOWN" />
        <span>Not known yet</span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
fieldset { border: 0; padding: 0; margin: 0; }
.prompt { font-size: 15px; padding: 0; }
.opts { display: flex; flex-wrap: wrap; gap: 8px; }
.opt { position: relative; }
.opt input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.opt span { display: inline-block; padding: 12px 18px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); font-weight: 600; min-width: 64px; text-align: center; }
.opt input:checked + span { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.opt input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
