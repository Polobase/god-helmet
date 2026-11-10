<script setup lang="ts">
// A crescent moon. (x, y) is the middle of the full disc.
const props = withDefaults(defineProps<{ x?: number, y?: number, r?: number }>(), { x: 0, y: 0, r: 12 })
const d = computed(() => {
  const r = props.r
  const tx = 0.423 * r
  const ty = 0.906 * r
  return `M ${tx} ${-ty} A ${r} ${r} 0 1 0 ${tx} ${ty} A ${r} ${r} 0 0 1 ${tx} ${-ty} Z`
})
</script>

<template>
  <path :transform="`translate(${x} ${y}) rotate(-28)`" :d="d" />
</template>
