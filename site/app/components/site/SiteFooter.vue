<script setup lang="ts">
const columns = [
  { title: 'Read', links: [
    { label: 'Sensed presence', to: '/articles/sensed-presence' },
    { label: 'Out-of-body experiences', to: '/articles/out-of-body' },
    { label: 'Remote viewing', to: '/articles/remote-viewing' },
    { label: 'The evidence', to: '/articles/research' },
    { label: 'History', to: '/articles/history' },
  ] },
  { title: 'Build', links: [
    { label: 'Parts list', to: '/docs/parts' },
    { label: 'Wiring', to: '/docs/wiring' },
    { label: 'Calibration', to: '/docs/calibration' },
    { label: 'Install the firmware', to: '/app/helmet' },
  ] },
  { title: 'Use', links: [
    { label: 'Programs', to: '/app/programs' },
    { label: 'Guided sessions', to: '/app/guides' },
    { label: 'Blinded trials', to: '/app/trials' },
    { label: 'Program reference', to: '/docs/programs' },
  ] },
]
</script>

<template>
  <footer class="border-t border-default bg-default">
    <UContainer class="py-12 grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div class="grid gap-4 content-start">
        <BrandWordmark />
        <p class="text-sm text-muted measure">
          Experimental and non-medical. Not for people with epilepsy or a seizure history, psychiatric conditions, or implanted electronics. Battery power only.
          <NuxtLink to="/docs/safety" class="text-primary underline underline-offset-4">Read the safety page first.</NuxtLink>
        </p>
      </div>
      <nav class="grid grid-cols-2 sm:grid-cols-3 gap-8" aria-label="Site">
        <div v-for="c in columns" :key="c.title">
          <h2 class="text-sm font-semibold text-highlighted font-sans tracking-normal [font-stretch:100%]">{{ c.title }}</h2>
          <ul class="mt-3 grid gap-2">
            <li v-for="l in c.links" :key="l.to"><NuxtLink :to="l.to" class="text-sm text-muted hover:text-highlighted">{{ l.label }}</NuxtLink></li>
          </ul>
        </div>
      </nav>
    </UContainer>
  </footer>
</template>
