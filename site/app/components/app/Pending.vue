<script setup lang="ts">
// A screen that has not been moved over from the previous app yet.
</script>

<template>
  <UEmpty icon="i-lucide-construction" title="This screen is next" description="It has not been rebuilt yet. Until it is, it works in the previous app."
    :actions="[{ label: 'Open the previous app', to: 'https://polobase.github.io/god-helmet/', target: '_blank', trailingIcon: 'i-lucide-arrow-up-right' }]" />
</template>
