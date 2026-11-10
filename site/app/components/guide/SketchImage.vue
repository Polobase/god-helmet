<script setup lang="ts">
// A stored sketch (dark ink on light paper). Dark themes show it inverted, as
// the sketch pad does, so it does not glare; the stored picture stays as drawn.
defineProps<{ src: string, alt: string }>()
</script>

<template>
  <img :src="src" :alt="alt" class="sketch block rounded-md border border-default">
</template>

<style scoped>
:root.dark .sketch { filter: invert(.9); }
:root.night .sketch { filter: invert(1) sepia(1) saturate(6) hue-rotate(-55deg) brightness(.6); }
</style>
