<script setup lang="ts">
// Docs pages: the sidebar on the left (a fold on phones), the page beside it.
const { data: pages } = await usePageList('docs')
const open = ref(false)
const route = useRoute()
watch(() => route.path, () => (open.value = false))
</script>

<template>
  <UContainer class="py-8 lg:py-12 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
    <aside class="max-lg:hidden">
      <div class="sticky top-(--ui-header-height) max-h-[calc(100dvh-var(--ui-header-height))] overflow-y-auto py-2 pr-2">
        <DocsNav :pages="pages ?? []" />
      </div>
    </aside>
    <div class="min-w-0">
      <UCollapsible v-model:open="open" class="lg:hidden mb-6 panel">
        <UButton variant="ghost" block trailing-icon="i-lucide-chevron-down" class="justify-between px-4 py-3" :ui="{ trailingIcon: open ? 'rotate-180 transition-transform' : 'transition-transform' }">All docs</UButton>
        <template #content>
          <div class="p-4 pt-1"><DocsNav :pages="pages ?? []" /></div>
        </template>
      </UCollapsible>
      <slot :pages="pages ?? []" />
    </div>
  </UContainer>
</template>
