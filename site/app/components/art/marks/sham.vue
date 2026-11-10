<script setup lang="ts">
import { ringPoint } from '~/lib/art'
// The coils are there and switched off: rings, not dots, and no field.
const R = 15
const GAP = 9.5 // degrees of the head's outline that each coil takes up, either side
const coils = Array.from({ length: 8 }, (_, i) => ringPoint(i, R))
const at = (deg: number) => `${(24 + R * Math.sin((deg * Math.PI) / 180)).toFixed(2)} ${(26 - R * Math.cos((deg * Math.PI) / 180)).toFixed(2)}`
const outline = Array.from({ length: 8 }, (_, i) => `M ${at(22.5 + 45 * i + GAP)} A ${R} ${R} 0 0 1 ${at(67.5 + 45 * i - GAP)}`).join(' ')
</script>

<template>
  <g>
    <path :d="outline" />
    <path d="M 21 11.3 Q 24 5.3 27 11.3" />
    <circle v-for="([x, y], i) in coils" :key="i" :cx="24 + x" :cy="26 + y" r="2.3" />
  </g>
</template>
