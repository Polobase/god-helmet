<script setup lang="ts">
// A picture card or a sheet of paper; what is on it goes in the slot. (x, y) is its middle.
withDefaults(defineProps<{ x?: number, y?: number, w?: number, h?: number, turn?: number }>(), { x: 0, y: 0, w: 22, h: 28, turn: 0 })
</script>

<template>
  <g :transform="`translate(${x} ${y}) rotate(${turn})`">
    <rect :x="-w / 2" :y="-h / 2" :width="w" :height="h" rx="2.4" />
    <slot />
  </g>
</template>
