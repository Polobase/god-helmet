<script setup lang="ts">
// Trials tab: blinded remote-viewing and telepathy trials (/app/trials), and
// the picture pool they draw from (/app/trials/pictures).
const route = useRoute()
const part = computed(() => (route.path.replace(/\/$/, '').endsWith('/pictures') ? 'pictures' : 'trials'))
const PARTS = [
  { key: 'trials', label: 'Trials', to: '/app/trials' },
  { key: 'pictures', label: 'Picture pool', to: '/app/trials/pictures' },
]
</script>

<template>
  <div class="grid grid-cols-1 gap-5">
    <header class="grid grid-cols-1 gap-3">
      <h1 class="text-4xl">Trials</h1>
      <nav class="parts" aria-label="Trials">
        <NuxtLink v-for="p in PARTS" :key="p.key" :to="p.to" :aria-current="part === p.key ? 'page' : undefined">{{ p.label }}</NuxtLink>
      </nav>
    </header>
    <NuxtPage />
  </div>
</template>

<style scoped>
/* The same underlined tabs as a program's sub-pages. */
.parts { display: flex; gap: 0.15rem; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid var(--ui-border); }
.parts a { display: inline-flex; align-items: center; padding: 0.65rem 0.8rem; margin-bottom: -1px; border-bottom: 2px solid transparent; color: var(--ui-text-muted); font-weight: 600; white-space: nowrap; }
.parts a:first-child { padding-left: 0.15rem; }
.parts a:hover { color: var(--ui-text-highlighted); }
.parts a[aria-current="page"] { color: var(--ui-text-highlighted); border-bottom-color: var(--ui-primary); }
</style>
