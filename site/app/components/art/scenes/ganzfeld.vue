<script setup lang="ts">
// Soft noise around the head: where each speck is (in the chair's own, tilted
// measure, the head at -91.75, -12.7), and each flickers in its own time.
const NOISE: [number, number][] = [
  [-118, -20], [-116, -2], [-110, -34], [-98, -42], [-84, -42], [-72, -34], [-126, -10], [-124, -30], [-112, -48], [-96, -56],
  [-80, -54], [-66, -46], [-134, -22], [-128, -44], [-104, -62], [-86, -66], [-62, -30], [-70, -60], [-138, -6], [-118, -58],
]
</script>

<template>
  <g>
    <path d="M 40 140 H 204" />
    <!-- a reclining chair: the seat on its foot, and the long tilted back -->
    <path d="M 136 116 H 176 q 6 0 6 6 M 156 116 V 140 M 140 140 q 16 -7 32 0" />
    <g transform="translate(136 116) rotate(33)">
      <path d="M 0 0 H -106" />
      <ArtKitPerson :x="-40.4" :y="-1.6" :s="1.3" pose="lie" eyes="none">
        <!-- half-spheres over the eyes, and headphones -->
        <path d="M -6.6 2.2 a 2.9 2.9 0 0 1 5.8 0 Z M 0.8 2.2 a 2.9 2.9 0 0 1 5.8 0 Z" />
        <path d="M -10.2 -3.4 A 10.8 10.8 0 0 1 10.2 -3.4" />
        <rect x="-12.8" y="-3.6" width="3.8" height="8.6" rx="1.7" />
        <rect x="9" y="-3.6" width="3.8" height="8.6" rx="1.7" />
      </ArtKitPerson>
      <g class="art-a">
        <path v-for="([x, y], i) in NOISE" :key="i" class="art-pt art-breathe" :style="{ '--art-t': `${3 + (i % 5) * 0.7}s`, '--art-d': `${-((i * 0.53) % 4)}s`, '--art-lo': 0.1 }" :d="`M ${x} ${y} h 0.01`" />
      </g>
    </g>
  </g>
</template>
