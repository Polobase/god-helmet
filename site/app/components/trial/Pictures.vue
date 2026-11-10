<script setup lang="ts">
// The pictures of a trial's set in the helmet's shuffled order, each with its
// rank. After the reveal the target is marked.
const props = defineProps<{
  /** Object URLs in display order. */
  pictures: string[]
  setSize: number
  /** Ranks are submitted: shown, no longer changed. */
  locked: boolean
  /** Display position of the target once revealed, else -1. */
  targetPos: number
}>()
const ranks = defineModel<number[]>('ranks', { required: true })

const options = computed(() => [
  { label: 'rank…', value: 0 },
  ...Array.from({ length: props.setSize }, (_, i) => ({ label: `${i + 1}${i === 0 ? ' (best)' : ''}`, value: i + 1 })),
])
const setRank = (pos: number, value: number) => (ranks.value = ranks.value.map((r, i) => (i === pos ? Number(value) : r)))
</script>

<template>
  <div class="pics">
    <figure v-for="(src, pos) in pictures" :key="pos" class="pic" :class="{ target: pos === targetPos }">
      <!-- Sits on the picture so the target lines up with the others. -->
      <figcaption v-if="pos === targetPos" class="absolute left-3 top-3 z-1">
        <UBadge color="success" variant="solid" class="rounded-full" icon="i-lucide-crosshair">Target</UBadge>
      </figcaption>
      <img :src="src" :alt="`Picture ${pos + 1}`">
      <USelect :model-value="ranks[pos] ?? 0" :items="options" :disabled="locked" class="w-full" :aria-label="`Rank for picture ${pos + 1}`" @update:model-value="(v) => setRank(pos, v)" />
    </figure>
  </div>
</template>

<style scoped>
.pics { display: grid; grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr)); gap: 0.75rem; }
.pic { position: relative; display: grid; align-content: start; gap: 0.4rem; margin: 0; padding: 0.4rem; border: 1px solid var(--ui-border); border-radius: calc(var(--ui-radius) * 2); }
.pic img { display: block; width: 100%; border-radius: var(--ui-radius); }
.pic.target { border-color: var(--ok); box-shadow: 0 0 0 2px var(--ok); }
</style>
