<script setup lang="ts">
const route = useRoute()
const siteUrl = String(useRuntimeConfig().public.siteUrl ?? '').replace(/\/$/, '')
useHead({
  titleTemplate: (title) => (title ? `${title} · God Helmet` : 'God Helmet: a weak-field helmet you can build, and test blind'),
  link: () => (siteUrl && !route.path.startsWith('/app') ? [{ rel: 'canonical', href: siteUrl + (route.path === '/' ? '/' : route.path.replace(/\/$/, '')) }] : []),
})
useSeoMeta({ ogSiteName: 'God Helmet', twitterCard: 'summary_large_image', ogImage: `${siteUrl}/og.png` })
</script>

<template>
  <UApp :toaster="{ position: 'bottom-center' }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
