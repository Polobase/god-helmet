<script setup lang="ts">
// Time-stamped list of short entries (CRV columns and sensory lists).
export interface Entry { text: string, at: number }

const props = withDefaults(defineProps<{
  modelValue?: Entry[]
  label?: string
  hint?: string
  placeholder?: string
  /** A soft warning on entries longer than two words. */
  basicWords?: boolean
}>(), { modelValue: () => [], label: '', hint: '', placeholder: 'One or two words, then Enter' })
const emit = defineEmits<{ 'update:modelValue': [value: Entry[]] }>()
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
  <div class="grid min-w-0 max-w-xl content-start gap-1.5">
    <label v-if="label" :for="id" class="text-sm font-semibold text-highlighted">{{ label }}</label>
    <p v-if="hint" class="text-sm text-muted">{{ hint }}</p>
    <ul v-if="modelValue.length" class="flex flex-wrap gap-1" :aria-label="label || 'Entries'">
      <li v-for="(e, i) in modelValue" :key="i" class="rounded-md border border-default bg-elevated px-2 py-0.5 text-sm text-highlighted">{{ e.text }}</li>
    </ul>
    <div class="flex gap-1.5">
      <UInput :id="id" v-model="draft" :placeholder="placeholder" autocomplete="off" enterkeyhint="enter" class="min-w-0 flex-1" @keydown.enter.prevent="add" />
      <UButton size="sm" :disabled="!draft.trim()" @click="add">Add</UButton>
      <UButton v-if="modelValue.length" size="sm" variant="ghost" aria-label="Remove the last entry" @click="undo">Undo</UButton>
    </div>
    <p v-if="warn" class="text-sm text-warning" aria-live="polite">{{ warn }}</p>
  </div>
</template>
