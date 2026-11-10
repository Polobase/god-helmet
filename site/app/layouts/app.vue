<script setup lang="ts">
// The control app: its own header, and nothing rendered on the server.
useHead({ meta: [{ name: 'robots', content: 'noindex' }] })
</script>

<template>
  <div class="min-h-dvh">
    <a href="#content" class="skip">Skip to the content</a>
    <AppHeader />
    <main id="content" class="app-container pb-32 pt-5">
      <AppNotices />
      <slot />
    </main>
  </div>
</template>
