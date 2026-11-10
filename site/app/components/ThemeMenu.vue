<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { theme, current, THEMES } = useTheme()
const items = computed<DropdownMenuItem[]>(() => THEMES.map((t) => ({
  label: t.label,
  description: t.hint || undefined,
  icon: t.icon,
  type: 'checkbox' as const,
  checked: theme.value === t.value,
  onSelect: () => (theme.value = t.value),
})))
</script>

<template>
  <ClientOnly>
    <UDropdownMenu :items="items" :content="{ align: 'end' }">
      <UButton :icon="current.icon" variant="ghost" :aria-label="`Theme: ${current.label}. Change theme`" :title="`Theme: ${current.label}`" />
    </UDropdownMenu>
    <template #fallback>
      <UButton icon="i-lucide-sun-moon" variant="ghost" aria-label="Theme" disabled />
    </template>
  </ClientOnly>
</template>
