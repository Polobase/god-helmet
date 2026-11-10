<script setup lang="ts">
// A sealed envelope. (x, y) is its middle; `tip` is how far down the flap reaches (0 = the middle).
withDefaults(defineProps<{ x?: number, y?: number, w?: number, h?: number, tip?: number }>(), { x: 0, y: 0, w: 30, h: 20, tip: 0.06 })
</script>

<template>
  <g :transform="`translate(${x} ${y})`">
    <rect :x="-w / 2" :y="-h / 2" :width="w" :height="h" rx="2.2" />
    <path :d="`M ${1.4 - w / 2} ${1.6 - h / 2} L 0 ${h * tip} L ${w / 2 - 1.4} ${1.6 - h / 2}`" />
    <path class="art-pt" :d="`M 0 ${h * tip} h 0.01`" />
    <slot />
  </g>
</template>
