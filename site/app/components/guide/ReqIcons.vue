<script setup lang="ts">
// What a guide needs: headphones, the helmet, the picture pool.
// `labelled` shows the words next to the icons (there is no hover on phones).
import type { GuideRequires } from '~/lib/guides'

const props = defineProps<{ requires?: GuideRequires, labelled?: boolean }>()
const items = computed(() => {
  const r = props.requires ?? {}
  const out: { key: string, label: string, icon?: string, optional?: boolean }[] = []
  if (r.headphones) out.push({ key: 'headphones', label: 'Needs headphones', icon: 'i-lucide-headphones' })
  if (r.helmet === 'required') out.push({ key: 'helmet', label: 'Needs the helmet' })
  else if (r.helmet === 'optional') out.push({ key: 'helmet', label: 'Helmet optional', optional: true })
  if (r.pool) out.push({ key: 'pool', label: 'Uses the target pool', icon: 'i-lucide-image' })
  return out
})
</script>

<template>
  <span class="inline-flex items-center text-muted" :class="labelled ? 'flex-wrap gap-x-3 gap-y-1' : 'gap-1.5'">
    <span v-for="i in items" :key="i.key" class="inline-flex items-center gap-1" :title="labelled ? undefined : i.label">
      <UIcon v-if="i.icon" :name="i.icon" class="size-4.5 shrink-0" aria-hidden="true" />
      <!-- the helmet: a dome with three of its coils -->
      <svg v-else viewBox="0 0 24 24" class="helmet size-4.5 shrink-0" :class="{ 'opacity-60': i.optional }" aria-hidden="true">
        <path d="M3 17a9 9 0 0 1 18 0z" />
        <circle cx="7" cy="13" r="1.3" /><circle cx="12" cy="10.5" r="1.3" /><circle cx="17" cy="13" r="1.3" />
      </svg>
      <span :class="labelled ? 'text-sm' : 'sr-only'">{{ i.label }}</span>
    </span>
  </span>
</template>

<style scoped>
.helmet { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
</style>
