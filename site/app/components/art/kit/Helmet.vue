<script setup lang="ts">
// The device: a band with eight coils, and a cable to a small control board.
// The head it goes on is drawn in dashes: it is not part of the device.
withDefaults(defineProps<{ x?: number, y?: number, s?: number }>(), { x: 0, y: 0, s: 1 })
// The band is a ring seen a little from above; the coils sit 45° apart on it.
const coils = Array.from({ length: 8 }, (_, i) => {
  const a = ((22.5 + 45 * i) * Math.PI) / 180
  return `M ${(29.5 * Math.sin(a)).toFixed(2)} ${(-5 + 8.5 * Math.cos(a)).toFixed(2)} h 0.01`
}).join(' ')
</script>

<template>
  <g :transform="`translate(${x} ${y}) scale(${s})`">
    <g class="art-a">
      <circle r="26" class="art-dash" />
      <path class="art-dash" d="M -37.5 70 V 65 A 31.8 31.8 0 0 1 -5.7 33.2 H 5.7 A 31.8 31.8 0 0 1 37.5 65 V 70" />
      <!-- the field, at one temple -->
      <path class="art-dots art-march" d="M -35.6 -15.5 A 37 37 0 0 0 -35.6 5.5 M -42.4 -18 A 44.5 44.5 0 0 0 -42.4 8" />
    </g>
    <ellipse cy="-5" rx="29.5" ry="8.5" />
    <path class="art-pt" :d="coils" />
    <path d="M 29.5 -5 C 50 -2 30 54 52 55" />
    <!-- the board -->
    <rect x="52" y="42" width="40" height="26" rx="3.5" />
    <rect x="70" y="49" width="13.5" height="12" rx="1.8" />
    <path class="art-pt" d="M 60 50 h 0.01 M 60 55 h 0.01 M 60 60 h 0.01" />
  </g>
</template>
