<script setup>
// Time-stamped list of short entries (CRV columns and sensory lists).
import { ref, useId } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  placeholder: { type: String, default: 'One or two words, then Enter' },
  basicWords: { type: Boolean, default: false }, // soft warning on long entries
})
const emit = defineEmits(['update:modelValue'])
const id = useId()
const draft = ref('')
const warn = ref('')

function add() {
  const text = draft.value.trim()
  if (!text) return
  warn.value = props.basicWords && text.split(/\s+/).length > 2 ? 'Keep to basic words: one or two per entry.' : ''
  emit('update:modelValue', [...props.modelValue, { text, at: Date.now() }])
  draft.value = ''
}
const undo = () => emit('update:modelValue', props.modelValue.slice(0, -1))
</script>

<template>
  <div class="entries">
    <label v-if="label" :for="id" class="lbl">{{ label }}</label>
    <p v-if="hint" class="small muted">{{ hint }}</p>
    <ul v-if="modelValue.length" class="list" :aria-label="label || 'Entries'">
      <li v-for="(e, i) in modelValue" :key="i">{{ e.text }}</li>
    </ul>
    <div class="add">
      <input :id="id" v-model="draft" type="text" :placeholder="placeholder" autocomplete="off" enterkeyhint="enter" @keydown.enter.prevent="add" />
      <button type="button" class="btn sm" :disabled="!draft.trim()" @click="add">Add</button>
      <button v-if="modelValue.length" type="button" class="btn ghost sm" aria-label="Remove the last entry" @click="undo">Undo</button>
    </div>
    <p v-if="warn" class="small warn" aria-live="polite">{{ warn }}</p>
  </div>
</template>

<style scoped>
.entries { display: grid; gap: 6px; min-width: 0; }
.lbl { font-weight: 600; font-size: 14px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
.list li { font-size: 13.5px; padding: 2px 8px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--line); }
.add { display: flex; gap: 6px; }
.add input { flex: 1; min-width: 0; }
</style>
