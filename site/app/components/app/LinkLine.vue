<script setup lang="ts">
// The line about the connection for pages without the app's notices (the docs
// and articles): a session shown there must not change or vanish without a word.
import { device, reconnect, dismissNotice } from '~/lib/device'

const { note, lost } = useHelmetLink()
// Only where it concerns a session: reading the docs, nobody needs to hear that an idle helmet is back.
const shown = computed(() => (!note.value ? null : lost.value ? (device.status ? note.value : null) : device.event && device.event.type !== 'back' ? note.value : null))
</script>

<template>
  <!-- It lies over the top of the page (the header's lower slot): an opaque ground, then the tint. -->
  <div v-if="shown" class="rounded-md bg-default shadow-md" role="status" aria-live="polite" data-test="link-line">
    <p class="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md px-3 py-2 text-sm text-highlighted ring ring-inset" :class="shown.tone === 'success' ? 'bg-success/10 ring-success/25' : 'bg-warning/10 ring-warning/25'">
      <UIcon :name="lost ? 'i-lucide-unplug' : shown.tone === 'success' ? 'i-lucide-check' : 'i-lucide-info'" class="size-4 shrink-0" :class="shown.tone === 'success' ? 'text-success' : 'text-warning'" aria-hidden="true" />
      <span class="min-w-0 flex-1 basis-56">{{ shown.text }}</span>
      <UButton v-if="lost" size="xs" icon="i-lucide-refresh-cw" :loading="device.link === 'reconnecting'" @click="reconnect()">Reconnect</UButton>
      <UButton v-else size="xs" variant="ghost" color="neutral" icon="i-lucide-x" aria-label="Dismiss" @click="dismissNotice()" />
    </p>
  </div>
</template>
