<script setup lang="ts">
// A bed from the side. (x, y) is the middle of its top.
withDefaults(defineProps<{ x?: number, y?: number, w?: number, s?: number }>(), { x: 0, y: 0, w: 110, s: 1 })
</script>

<template>
  <g :transform="`translate(${x} ${y}) scale(${s})`">
    <rect :x="-w / 2" y="0" :width="w" height="7" rx="3.5" />
    <path :d="`M ${10 - w / 2} 7 V 16 M ${w / 2 - 10} 7 V 16`" />
  </g>
</template>
