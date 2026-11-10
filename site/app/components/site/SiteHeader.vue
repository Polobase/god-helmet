<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const items = computed<NavigationMenuItem[]>(() => [
  { label: 'Articles', to: '/articles', active: route.path.startsWith('/articles') },
  { label: 'Docs', to: '/docs', active: route.path.startsWith('/docs') },
  { label: 'Source', to: 'https://github.com/Polobase/god-helmet', target: '_blank' },
])

// Coming from the app, the button leads back to where you were in it.
const app = computed(() => (lastAppPath.value ? { to: lastAppPath.value, label: 'Back to the app' } : { to: '/app/programs', label: 'Open the app' }))

// A session started in the app keeps running while you read: it shows here
// too, with Stop, and its name opens the live panel (intensity, Skip, coils).
// Loaded once the page is idle; it brings the helmet connection with it (and,
// after a reload, reconnects to the helmet that was in use).
const pill = ref(false)
const live = ref(false)
onMounted(() => (window.requestIdleCallback ?? setTimeout)(() => (pill.value = true)))
</script>

<template>
  <UHeader :ui="{ root: 'bg-(--page)/70 backdrop-blur-xl backdrop-saturate-150 border-(--hairline)', container: 'max-w-(--ui-container)' }">
    <template #left>
      <BrandWordmark />
    </template>

    <UNavigationMenu :items="items" variant="link" />

    <template #right>
      <LazyAppSessionPill v-if="pill" class="max-md:hidden" :open="live" @toggle="live = !live" />
      <UContentSearchButton :collapsed="true" variant="ghost" />
      <ThemeMenu />
      <UButton :to="app.to" color="primary" variant="solid" class="max-sm:hidden">{{ app.label }}</UButton>
    </template>

    <template #body>
      <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      <UButton :to="app.to" color="primary" variant="solid" block class="mt-4">{{ app.label }}</UButton>
    </template>

    <!-- On a phone the running session gets its own row, as in the app. Under it, on every screen, the word about a lost connection. -->
    <template v-if="pill" #bottom>
      <div class="mx-auto flex w-full max-w-(--ui-container) px-4 empty:hidden md:hidden [&>*]:mb-2 [&>*]:w-full [&>*]:justify-between">
        <LazyAppSessionPill :open="live" @toggle="live = !live" />
      </div>
      <div class="mx-auto w-full max-w-(--ui-container) px-4 empty:hidden [&>*]:mb-2">
        <LazyAppLinkLine />
      </div>
    </template>
  </UHeader>

  <UModal v-if="pill" v-model:open="live" title="Session" description="The session running on the helmet." :ui="{ content: 'sm:max-w-3xl' }">
    <template #body>
      <LazyAppLivePanel :rate="false" />
    </template>
  </UModal>
</template>
