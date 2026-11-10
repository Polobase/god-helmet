<script setup lang="ts">
const { data: articles } = await usePageList('articles')

useSeoMeta({
  title: 'Articles',
  description: 'What people report under a weak-field helmet, what the laboratories claimed, what independent tests found, and how to check it yourself.',
})

const effects = computed(() => (articles.value ?? []).filter((a) => a.group === 'Effect'))
const background = computed(() => (articles.value ?? []).filter((a) => a.group !== 'Effect'))
</script>

<template>
  <UContainer class="py-16 lg:py-24">
    <header class="max-w-4xl">
      <h1 class="text-[clamp(3rem,8vw,6.5rem)] font-[660] leading-[0.94] tracking-[-0.035em] [font-stretch:78%]">Articles</h1>
      <p class="mt-7 text-xl text-toned measure">
        What people report, what the laboratories claimed, what the independent tests found, and how to check each effect yourself.
        Every claim carries one of five evidence labels, from <EvidenceBadge level="established" /> to <EvidenceBadge level="unverified" />.
      </p>
    </header>

    <section class="mt-16" aria-labelledby="effects">
      <h2 id="effects" class="text-2xl">The three effects people ask about</h2>
      <div class="mt-6 grid gap-4 lg:grid-cols-3">
        <ArticleCard v-for="a in effects" :key="a.path" :article="a" large />
      </div>
    </section>

    <section class="mt-16" aria-labelledby="background">
      <h2 id="background" class="text-2xl">Background</h2>
      <div class="mt-6 grid gap-4 lg:grid-cols-2">
        <ArticleCard v-for="a in background" :key="a.path" :article="a" large />
      </div>
    </section>
  </UContainer>
</template>
