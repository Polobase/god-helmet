<script setup>
// Trials tab: blinded remote-viewing and telepathy trials (#trials), and the
// picture pool they draw from (#trials/pictures).
import { computed } from 'vue'
import { nav } from '../lib/nav.js'
import ExperimentView from './ExperimentView.vue'
import TargetsView from './TargetsView.vue'

const part = computed(() => (nav.arg === 'pictures' ? 'pictures' : 'trials'))
</script>

<template>
  <div class="trials">
    <nav class="part-nav" aria-label="Trials">
      <div class="seg">
        <a href="#trials" :class="{ on: part === 'trials' }" :aria-current="part === 'trials' ? 'page' : null">Trials</a>
        <a href="#trials/pictures" :class="{ on: part === 'pictures' }" :aria-current="part === 'pictures' ? 'page' : null">Picture pool</a>
      </div>
    </nav>
    <TargetsView v-if="part === 'pictures'" />
    <ExperimentView v-else />
  </div>
</template>

<style scoped>
.part-nav { max-width: 1100px; margin: 16px auto -4px; padding: 0 max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px)); }
.seg a { display: inline-flex; align-items: center; min-height: 32px; padding: 6px 14px; border-radius: 7px; color: var(--muted); font-weight: 600; font-size: 13.5px; text-decoration: none; }
.seg a:hover { color: var(--text); }
.seg a.on { background: var(--accent-soft); color: var(--text); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent); }
</style>
