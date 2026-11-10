<script setup lang="ts">
// A chair from the side. (x, y) is the middle of the seat; `flip` turns its back to the right.
withDefaults(defineProps<{ x?: number, y?: number, s?: number, flip?: boolean }>(), { x: 0, y: 0, s: 1 })
</script>

<template>
  <g :transform="`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`">
    <path d="M -17.5 -29 L -16 0 H 16" />
    <path d="M -12.5 0 L -15 21 M 12.5 0 L 15 21" />
  </g>
</template>
