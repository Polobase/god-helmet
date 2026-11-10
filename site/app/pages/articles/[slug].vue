<script setup lang="ts">
const route = useRoute()
const { data: page } = await useAsyncData(`page-${route.path}`, () => queryCollection('pages').path(route.path).first())
if (!page.value || page.value.section !== 'articles') {
  throw createError({ statusCode: 404, statusMessage: 'Article not found', fatal: true })
}
const { data: siblings } = await usePageList('articles')

useSeoMeta({
  title: page.value.title,
  description: page.value.description,
  ogType: 'article',
  articleModifiedTime: page.value.updated,
})
</script>

<template>
  <UContainer v-if="page" class="py-10 lg:py-14">
    <DocPage :page="page" :siblings="siblings ?? []">
      <template #kicker>
        <p class="mb-4 text-sm text-muted">
          <NuxtLink to="/articles" class="hover:text-highlighted">Articles</NuxtLink>
          <span aria-hidden="true" class="mx-2">/</span>{{ page.group }}
        </p>
      </template>
    </DocPage>
  </UContainer>
</template>
