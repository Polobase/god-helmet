<script setup lang="ts">
// The page for an address that leads nowhere (or an error that got this far).
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const missing = computed(() => props.error.statusCode === 404)
useHead({ title: () => (missing.value ? 'Page not found' : 'Something went wrong') })
</script>

<template>
  <UApp>
    <div class="grid min-h-dvh place-items-center px-6 py-16">
      <div class="max-w-xl">
        <BrandWordmark />
        <p class="num mt-12 font-display text-[clamp(5rem,18vw,10rem)] font-[660] leading-[0.85] tracking-[-0.04em] text-primary [font-stretch:78%]">{{ error.statusCode }}</p>
        <h1 class="mt-6 text-4xl">{{ missing ? 'There is no page at this address' : 'Something went wrong' }}</h1>
        <p class="mt-4 text-lg text-toned">
          {{ missing ? 'It may have moved when the site was rebuilt. The articles, the docs and the app are all one click away.' : (error.statusMessage || error.message || 'The page could not be shown.') }}
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <UButton color="primary" variant="solid" size="lg" @click="clearError({ redirect: '/' })">To the start page</UButton>
          <UButton size="lg" @click="clearError({ redirect: '/articles' })">Articles</UButton>
          <UButton size="lg" @click="clearError({ redirect: '/docs' })">Docs</UButton>
          <UButton size="lg" @click="clearError({ redirect: '/app/programs' })">Open the app</UButton>
        </div>
      </div>
    </div>
  </UApp>
</template>
