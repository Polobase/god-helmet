<script setup lang="ts">
// A table from the side. (x, y) is the middle of its top; `h` is how high it stands.
withDefaults(defineProps<{ x?: number, y?: number, w?: number, h?: number }>(), { x: 0, y: 0, w: 44, h: 28 })
</script>

<template>
  <path :transform="`translate(${x} ${y})`" :d="`M ${-w / 2} 0 H ${w / 2} M ${7 - w / 2} 0 L ${4.5 - w / 2} ${h} M ${w / 2 - 7} 0 L ${w / 2 - 4.5} ${h}`" />
</template>
