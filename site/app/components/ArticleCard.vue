<script setup lang="ts">
import type { PageSummary } from '~/composables/usePages'

defineProps<{ article: PageSummary, large?: boolean }>()
</script>

<template>
  <NuxtLink v-spotlight :to="article.path" class="panel group flex flex-col gap-4" :class="large ? 'p-7 sm:p-8 lg:min-h-[21rem]' : 'p-6'">
    <p class="flex items-center justify-between text-sm text-muted">
      <span>{{ article.group }}</span>
      <UIcon name="i-lucide-arrow-up-right" class="size-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
    </p>
    <h3 class="transition-colors group-hover:text-primary" :class="large ? 'text-[2rem] lg:text-[2.3rem]' : 'text-[1.6rem]'">{{ article.label }}</h3>
    <p class="text-toned" :class="large ? '' : 'text-sm'">{{ article.description }}</p>
    <p class="num mt-auto pt-2 text-sm text-muted">{{ article.minutes }} min read</p>
  </NuxtLink>
</template>
