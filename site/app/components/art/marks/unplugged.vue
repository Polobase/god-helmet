<script setup lang="ts">
// No helmet connected: the band and the board, the cable between them loose.
const coils = Array.from({ length: 8 }, (_, i) => {
  const a = ((22.5 + 45 * i) * Math.PI) / 180
  return `M ${(18 + 15 * Math.sin(a)).toFixed(2)} ${(9 + 4.6 * Math.cos(a)).toFixed(2)} h 0.01`
}).join(' ')
</script>

<template>
  <g>
    <ellipse cx="18" cy="9" rx="15" ry="4.6" />
    <path class="art-pt" :d="coils" />
    <path d="M 33 9 C 42 10.5 27.5 13.5 28 19.5" />
    <rect x="25.3" y="19.5" width="5.4" height="6.6" rx="1.5" />
    <rect x="19" y="34" width="27" height="12.5" rx="2.6" />
    <rect x="32.5" y="37" width="9" height="6.5" rx="1.3" />
    <path class="art-pt" d="M 24.6 38 h 0.01 M 24.6 42.6 h 0.01" />
    <path class="art-a art-dots art-march" d="M 28 28.2 V 33.6" />
  </g>
</template>
