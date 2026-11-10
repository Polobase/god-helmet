<script setup lang="ts">
// Figures of the repository's docs (docs/*.svg), served from the bundle.
// They are drawn for a light page, so they keep a light sheet in every theme.
const props = defineProps<{ src?: string, alt?: string, title?: string }>()

const figures = import.meta.glob<string>('../../../../docs/*.svg', { eager: true, query: '?url', import: 'default' })
const byName = Object.fromEntries(Object.entries(figures).map(([path, url]) => [path.split('/').pop()!, url]))
const url = computed(() => byName[(props.src ?? '').split('/').pop() ?? ''] ?? props.src)
</script>

<template>
  <figure class="my-6 rounded-lg bg-[#f3f4f1] p-2 overflow-x-auto night:opacity-70 night:[filter:grayscale(1)_sepia(1)_hue-rotate(-40deg)_saturate(3)_brightness(.55)]">
    <img :src="url" :alt="alt ?? ''" :title="title" loading="lazy" class="block w-full min-w-[640px]">
  </figure>
</template>
