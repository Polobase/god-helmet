<script setup lang="ts">
const route = useRoute()
const { data: page } = await useAsyncData(`page-${route.path}`, () => queryCollection('pages').path(route.path).first())
if (!page.value || page.value.section !== 'docs') {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

useSeoMeta({ title: page.value.title, description: page.value.description })
</script>

<template>
  <DocsShell v-if="page" v-slot="{ pages }">
    <DocPage :page="page" :siblings="pages" />
  </DocsShell>
</template>
