<script setup lang="ts">
// The control app: its own header, and nothing rendered on the server.
import { running } from '~/lib/device'
import { ART_QUIET } from '~/lib/art'

useHead({ meta: [{ name: 'robots', content: 'noindex' }] })
// While the helmet runs a session, nothing on the screen moves for decoration.
provide(ART_QUIET, computed(() => running()))
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
