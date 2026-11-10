<script setup lang="ts">
import { ringPoint } from '~/lib/art'
const [x, y] = ringPoint(2, 15)
</script>

<template>
  <g>
    <ArtKitHeadTop :x="24" :y="26" :r="15" />
    <g class="art-a">
      <circle :cx="24 + x" :cy="26 + y" r="5.5" class="art-dash" />
    </g>
  </g>
</template>
