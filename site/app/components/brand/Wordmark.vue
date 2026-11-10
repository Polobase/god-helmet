<script setup lang="ts">
// The mark: a head seen from above, nose up, eight coils on the band.
defineProps<{ to?: string, label?: string, compact?: boolean }>()
const dots = Array.from({ length: 8 }, (_, i) => {
  const a = ((i + 0.5) * Math.PI) / 4
  return { x: 16 + 10.5 * Math.cos(a), y: 17.5 + 10.5 * Math.sin(a) }
})
</script>

<template>
  <NuxtLink :to="to ?? '/'" class="group flex items-center gap-2.5 text-highlighted shrink-0" :aria-label="label ?? 'God Helmet: home'">
    <svg viewBox="0 0 32 32" class="size-7" aria-hidden="true">
      <path d="M13.2 7.6 16 3.6l2.8 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" class="text-muted" />
      <circle cx="16" cy="17.5" r="10.5" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted" />
      <circle v-for="(d, i) in dots" :key="i" :cx="d.x" :cy="d.y" r="2.5" class="fill-primary" />
    </svg>
    <span class="font-display text-[1.2rem] font-[650] leading-none" :class="{ 'max-sm:hidden': compact }">God Helmet</span>
  </NuxtLink>
</template>
