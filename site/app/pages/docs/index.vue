<script setup lang="ts">
const { data: pages } = await usePageList('docs')
const groups = computed(() => docGroups(pages.value ?? []))
const slug = (title: string) => `group-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

useSeoMeta({
  title: 'Docs',
  description: 'Build the helmet, wire and calibrate it, place the coils, run blinded sessions, and look up every signal, program and protocol detail.',
})
</script>

<template>
  <UContainer class="py-16 lg:py-24">
    <header class="max-w-4xl">
      <h1 class="text-[clamp(3rem,8vw,6.5rem)] font-[660] leading-[0.94] tracking-[-0.035em] [font-stretch:78%]">Docs</h1>
      <p class="mt-7 text-xl text-toned measure">Build the helmet, wire and calibrate it, place the coils, run blinded sessions, and look up every signal, program and protocol detail.</p>
    </header>

    <div class="mt-14 grid gap-4 md:grid-cols-2">
      <section v-for="g in groups" :key="g.title" class="panel p-7 sm:p-8" :aria-labelledby="slug(g.title)">
        <h2 :id="slug(g.title)" class="text-3xl">{{ g.title }}</h2>
        <ul class="mt-5 grid divide-y divide-(--hairline)">
          <li v-for="l in g.links" :key="l.to">
            <NuxtLink :to="l.to" class="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4">
              <span class="font-semibold text-highlighted group-hover:text-primary">{{ l.label }}</span>
              <UIcon name="i-lucide-arrow-right" class="row-span-2 size-4 text-dimmed transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              <span class="text-sm text-muted">{{ l.description }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </UContainer>
</template>
