<script setup lang="ts">
import { ringPoint } from '~/lib/art'
const emblem = Array.from({ length: 8 }, (_, i) => ringPoint(i, 11)).map(([x, y]) => `M ${120 + x} ${88 + y} h 0.01`).join(' ')
</script>

<template>
  <g>
    <!-- a filing folder: its back with the tab, two sheets in it, and the front -->
    <path d="M 56 58 V 38 a 4 4 0 0 1 4 -4 H 96 a 4 4 0 0 1 3.2 1.6 L 105 43 H 110 M 176 43 H 180 a 4 4 0 0 1 4 4 V 58" />
    <path d="M 110 58 V 29 a 3 3 0 0 1 3 -3 H 120 M 120 58 V 21 a 3 3 0 0 1 3 -3 H 173 a 3 3 0 0 1 3 3 V 58" />
    <path d="M 129 28 H 167 M 129 37 H 167 M 129 46 H 153" />
    <path d="M 52 58 H 188 V 134 a 5 5 0 0 1 -5 5 H 57 a 5 5 0 0 1 -5 -5 Z" />
    <path d="M 100 116 H 140 M 108 125 H 132" />
    <!-- what the files are about -->
    <g class="art-a">
      <circle cx="120" cy="88" r="18" class="art-dash art-march" style="--art-t: 3s" />
      <path class="art-pt" style="--art-pt: 4px" :d="emblem" />
    </g>
  </g>
</template>
