<script setup lang="ts">
// Docs pages, laid out like Nuxt UI's Docs template: the navigation in an
// aside on the left with the search above it, the page beside it. On a phone
// the navigation is in the header's menu (SiteHeader).
const navigation = docNavigation()
</script>

<template>
  <UContainer>
    <UPage>
      <template #left>
        <UPageAside>
          <template #top>
            <UContentSearchButton :collapsed="false" class="w-full" />
          </template>
          <UContentNavigation highlight :navigation="navigation" data-test="docs-nav" />
        </UPageAside>
      </template>

      <slot />
    </UPage>
  </UContainer>
</template>
