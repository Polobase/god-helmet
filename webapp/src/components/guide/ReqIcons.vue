<script setup>
// Requirement icons for a guide card: headphones, helmet, target pool.
// `labelled` shows the words next to the icons (no hover on phones).
import { computed } from 'vue'

const props = defineProps({ requires: { type: Object, default: () => ({}) }, labelled: { type: Boolean, default: false } })
const items = computed(() => {
  const r = props.requires ?? {}
  const out = []
  if (r.headphones) out.push({ key: 'headphones', label: 'Needs headphones' })
  if (r.helmet === 'required') out.push({ key: 'helmet', label: 'Needs the helmet' })
  else if (r.helmet === 'optional') out.push({ key: 'helmet', label: 'Helmet optional', optional: true })
  if (r.pool) out.push({ key: 'pool', label: 'Uses the target pool' })
  return out
})
</script>

<template>
  <span class="icons" :class="{ labelled }">
    <span v-for="i in items" :key="i.key" class="icon" :class="{ optional: i.optional }" :title="labelled ? null : i.label">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <template v-if="i.key === 'headphones'">
          <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
          <rect x="3" y="14" width="4" height="7" rx="1.5" />
          <rect x="17" y="14" width="4" height="7" rx="1.5" />
        </template>
        <template v-else-if="i.key === 'helmet'">
          <path d="M3 17a9 9 0 0 1 18 0z" />
          <circle cx="7" cy="13" r="1.3" /><circle cx="12" cy="10.5" r="1.3" /><circle cx="17" cy="13" r="1.3" />
        </template>
        <template v-else>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 16l5-5 4 4 3-3 6 6" />
        </template>
      </svg>
      <span :class="labelled ? 'small' : 'sr'">{{ i.label }}</span>
    </span>
  </span>
</template>

<style scoped>
.icons { display: inline-flex; gap: 6px; align-items: center; }
.icons.labelled { flex-wrap: wrap; gap: 4px 12px; }
.icon { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); }
.icon.optional svg { opacity: .6; }
svg { flex: none; width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
