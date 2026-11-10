<script setup lang="ts">
// Rating items ({key, label, min, max, minLabel, maxLabel}): stored as { [key]: number }.
import type { RatingInputSpec, RatingItem } from '~/lib/guides'

type Item = RatingItem & { min: number, max: number }
const props = defineProps<{ input: RatingInputSpec, modelValue?: Record<string, number | null> | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, number | null>] }>()
const uid = useId()

const items: Item[] = (props.input.items ?? []).map((it) => ({ min: 0, max: 10, ...it }))
const values = reactive<Record<string, number | null>>(Object.fromEntries(items.map((it) => [it.key, props.modelValue?.[it.key] ?? null])))
watch(values, (v) => emit('update:modelValue', { ...v }), { deep: true })

const range = (it: Item) => Array.from({ length: it.max - it.min + 1 }, (_, i) => it.min + i)
const segmented = (it: Item) => it.max - it.min <= 10
const options = (it: Item) => range(it).map((v) => ({
  value: v,
  aria: `${v}${v === it.min && it.minLabel ? ` (${it.minLabel})` : ''}${v === it.max && it.maxLabel ? ` (${it.maxLabel})` : ''}`,
}))
// A long scale is a slider. Until it is answered it rests in the middle, dimmed; touching it
// gives the answer, so every value, the ends and the middle included, takes one move.
const middle = (it: Item) => Math.round((it.min + it.max) / 2)
// The keys that move a slider; Tab or Escape on the way past must not answer it.
const MOVES = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])
const touch = (it: Item) => {
  if (values[it.key] == null) values[it.key] = middle(it)
}
const width = (it: Item) => (segmented(it) ? { maxWidth: `${Math.max(3, range(it).length) * 60}px` } : undefined)
</script>

<template>
  <div class="grid gap-5">
    <p v-if="input.prompt" class="text-highlighted">{{ input.prompt }}</p>
    <fieldset v-for="it in items" :key="it.key" class="grid min-w-0">
      <legend class="mb-2 font-semibold text-highlighted">{{ it.label || it.key }}</legend>
      <!-- as wide as its scale: the words under the ends stay under the ends -->
      <div class="grid gap-1.5" :style="width(it)">
        <GuideOptionRow v-if="segmented(it)" v-model="values[it.key]" :options="options(it)" :name="`${uid}-${it.key}`" />
        <div v-else class="flex max-w-xl items-center gap-3" @pointerdown.capture="touch(it)" @keydown.capture="(e: KeyboardEvent) => MOVES.has(e.key) && touch(it)">
          <USlider :model-value="values[it.key] ?? middle(it)" :min="it.min" :max="it.max" :step="1" :aria-label="it.label || it.key" class="flex-1" :class="{ 'opacity-60': values[it.key] == null }" @update:model-value="(v) => (values[it.key] = Number(v))" />
          <b class="num min-w-10 text-right text-highlighted">{{ values[it.key] ?? '–' }}</b>
        </div>
        <div v-if="it.minLabel || it.maxLabel" class="flex justify-between gap-3 text-sm text-muted" :class="{ 'max-w-xl pr-13': !segmented(it) }"><span>{{ it.minLabel }}</span><span>{{ it.maxLabel }}</span></div>
      </div>
    </fieldset>
  </div>
</template>
