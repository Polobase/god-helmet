<script setup lang="ts">
// One row of options to pick from, as buttons: the points of a rating scale
// (numbers, sharing the width) or worded answers. Real radio buttons under
// the hood, so the arrow keys and screen readers work as usual.
export interface Option {
  value: number | string
  /** What the button shows (default: the value). */
  text?: string
  /** What a screen reader says, when the text alone is not enough (e.g. "0 (nothing)"). */
  aria?: string
}
const props = defineProps<{
  options: Option[]
  /** Group name: the same for every option of one question. */
  name: string
  /** Worded answers: buttons as wide as their text, wrapping. */
  words?: boolean
  /** Widest a number button may get, in px. */
  cell?: number
  disabled?: boolean
}>()
const model = defineModel<number | string | null>({ default: null })
const width = computed(() => (props.words ? undefined : `${props.options.length * (props.cell ?? 56) + (props.options.length - 1) * 4}px`))
</script>

<template>
  <div class="flex flex-wrap gap-1" :style="{ maxWidth: width }">
    <label v-for="o in options" :key="o.value" class="relative" :class="words ? 'flex-auto' : 'min-w-0 flex-1'">
      <input v-model="model" type="radio" class="peer absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed" :name="name" :value="o.value" :disabled="disabled" :aria-label="o.aria">
      <span class="block rounded-md border border-default bg-elevated text-center text-highlighted transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:font-semibold peer-checked:text-inverted peer-hover:border-accented peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-60"
        :class="words ? 'px-3 py-2.5' : 'num py-2.5'">{{ o.text ?? o.value }}</span>
    </label>
  </div>
</template>
