<script setup lang="ts">
// An unknown sub-page of a program shows its overview, as the old app did.
definePageMeta({ redirect: (to) => `/app/programs/${encodeURIComponent(String(to.params.id))}` })
</script>

<template>
  <div />
</template>
