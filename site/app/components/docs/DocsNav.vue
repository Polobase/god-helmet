<script setup lang="ts">
// The docs sidebar: every document and the program reference, in four groups.
import type { PageSummary } from '~/composables/usePages'

const props = defineProps<{ pages: PageSummary[] }>()
const route = useRoute()
const groups = computed(() => docGroups(props.pages))
</script>

<template>
  <nav aria-label="Documentation" class="grid gap-6">
    <div v-for="g in groups" :key="g.title">
      <!-- Not a heading: the page's own title comes first in the outline. -->
      <p class="text-sm font-semibold text-highlighted">{{ g.title }}</p>
      <ul class="mt-2 grid border-l border-default">
        <li v-for="l in g.links" :key="l.to">
          <NuxtLink :to="l.to" class="-ml-px block border-l py-1.5 pl-4 text-sm"
            :class="route.path === l.to ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted hover:text-highlighted hover:border-accented'"
            :aria-current="route.path === l.to ? 'page' : undefined">
            {{ l.label }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
