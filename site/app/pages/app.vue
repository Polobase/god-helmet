<script setup lang="ts">
// Everything under /app: the control app, in its own layout, client-only
// (routeRules in nuxt.config.ts).
definePageMeta({ layout: 'app' })
</script>

<template>
  <NuxtPage />
</template>
