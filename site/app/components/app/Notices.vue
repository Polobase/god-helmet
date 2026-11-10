<script setup lang="ts">
// What you need to know on every page of the app: the connection (lost,
// reconnecting, and what was found when it came back), connection errors, a
// browser that cannot reach the helmet, the USB safety rule, and the safety
// page still to accept.
import { useMediaQuery } from '@vueuse/core'
import { device, reconnect, disconnect, dismissNotice } from '~/lib/device'

const { tab, safetyPath } = useAppNav()
const route = useRoute()
const { note, lost, online } = useHelmetLink()
const needsSafety = computed(() => !!device.kind && !!device.info && !device.info.safetyAccepted && tab.value !== 'helmet' && !route.path.startsWith('/app/safety'))
const any = computed(() => !!device.error || !!note.value || (device.kind === 'usb' && online.value) || (!device.bluetooth && !device.serial) || needsSafety.value)

// On a phone the buttons go under the line, not beside it.
const wide = useMediaQuery('(min-width: 640px)')
const COLOR = { success: 'success', warning: 'warning', info: 'neutral' } as const
const ICON = { success: 'i-lucide-check', warning: 'i-lucide-unplug', info: 'i-lucide-loader-circle' }
// While the link is down: try now, or let the helmet go. Afterwards the line can be closed.
const linkActions = computed(() => (lost.value
  ? [
      { label: 'Reconnect', color: 'neutral' as const, variant: 'outline' as const, loading: device.link === 'reconnecting', onClick: () => { reconnect() } },
      { label: 'Disconnect', color: 'neutral' as const, variant: 'ghost' as const, onClick: disconnect },
    ]
  : []))
</script>

<template>
  <div v-if="any" class="grid gap-2 mb-4">
    <UAlert v-if="note" :color="COLOR[note.tone]" variant="subtle" :icon="lost ? ICON[note.tone] : note.tone === 'success' ? ICON.success : 'i-lucide-info'" :title="note.text" :actions="linkActions"
      :orientation="wide ? 'horizontal' : 'vertical'" :close="!lost" role="status" aria-live="polite" data-test="link-note" :data-lost="lost || undefined" :ui="{ icon: lost && note.tone === 'info' ? 'animate-spin' : '' }" @update:open="dismissNotice()" />
    <UAlert v-if="device.error" color="error" variant="subtle" icon="i-lucide-circle-x" :title="device.error" close @update:open="device.error = ''" />
    <UAlert v-if="!device.bluetooth && !device.serial" color="neutral" variant="subtle" icon="i-lucide-info"
      title="This browser can't reach the helmet"
      description="It has no Web Bluetooth and no USB (Web Serial). Use Chrome or Edge on a computer (Bluetooth or USB) or on Android (Bluetooth), or the free Bluefy browser on iPhone. The demo works everywhere." />
    <UAlert v-if="device.kind === 'usb' && online" color="warning" variant="subtle" icon="i-lucide-triangle-alert"
      title="Connected over USB: the cable joins the helmet to this computer"
      description="Wear the helmet only with a laptop on battery, charger unplugged, never with a desktop computer. Connect before putting it on." />
    <UAlert v-if="needsSafety" color="warning" variant="subtle" icon="i-lucide-triangle-alert" title="Read and accept the safety page before the first session"
      :actions="[{ label: 'Open the safety page', to: safetyPath(), color: 'neutral', variant: 'outline' }]" />
  </div>
</template>
