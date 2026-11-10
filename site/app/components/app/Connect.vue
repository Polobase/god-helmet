<script setup lang="ts">
// Connect to the helmet: Bluetooth, USB (where the browser has Web Serial) or
// the demo. The same control everywhere a connection is asked for.
import { device, connect, disconnect, reconnect, running, type DeviceKind } from '~/lib/device'

const props = defineProps<{
  size?: 'xs' | 'sm' | 'md'
  /** Buttons under each other, with what each one does (menus, empty pages). */
  stacked?: boolean
  /** When connected: show the device and Disconnect instead of nothing. */
  status?: boolean
}>()
const emit = defineEmits<{ done: [] }>()

const { lost } = useHelmetLink()
const label = computed(() => (device.kind === 'demo' ? 'Demo' : device.name))
const how = computed(() => {
  const what = device.kind === 'demo' ? 'the demo helmet' : `${device.name} over ${device.kind === 'usb' ? 'USB' : 'Bluetooth'}`
  if (lost.value) return `Connection to ${what} lost.${device.gaveUp || device.needsChooser ? '' : ' The app is reconnecting.'}`
  return device.kind === 'demo' ? 'Demo: no helmet, nothing is switched on.' : `Connected to ${what}.`
})
const go = (kind: DeviceKind) => {
  emit('done')
  connect(kind)
}
const leave = () => {
  emit('done')
  disconnect()
}
const size = computed(() => props.size ?? 'sm')
</script>

<template>
  <div v-if="device.kind" class="flex items-center gap-2" :class="{ 'flex-col items-stretch': stacked }">
    <template v-if="status">
      <p v-if="stacked" class="text-sm text-muted">{{ how }}</p>
      <UBadge v-else color="neutral" variant="outline" size="lg" class="gap-2" :title="how">
        <span class="size-2 rounded-full" :class="lost ? 'bg-warning' : 'bg-success'" aria-hidden="true" />{{ label }}<span v-if="lost" class="sr-only">, connection lost</span>
      </UBadge>
      <!-- A lost helmet can be let go even while its session shows. In the bar there is room for the Reconnect icon only: the notice under it has both buttons, with their names. -->
      <UButton v-if="lost && stacked" :size="size" icon="i-lucide-refresh-cw" :loading="device.link === 'reconnecting'" block @click="reconnect()">Reconnect</UButton>
      <UButton v-else-if="lost" :size="size" icon="i-lucide-refresh-cw" :loading="device.link === 'reconnecting'" aria-label="Reconnect" title="Reconnect now" @click="reconnect()" />
      <UButton v-if="lost ? stacked : !running()" :size="size" variant="ghost" @click="leave">Disconnect</UButton>
    </template>
  </div>
  <div v-else class="flex gap-2" :class="stacked ? 'flex-col' : 'flex-wrap items-center'">
    <UButton color="primary" variant="solid" :size="size" :disabled="!device.bluetooth || device.connecting" :loading="device.connecting" :block="stacked" icon="i-lucide-bluetooth" :title="device.bluetooth ? 'Connect over Bluetooth' : 'This browser has no Web Bluetooth'" @click="go('ble')">
      {{ device.connecting ? 'Connecting…' : 'Bluetooth' }}
    </UButton>
    <UButton v-if="device.serial" :size="size" :disabled="device.connecting" :block="stacked" icon="i-lucide-usb" title="Connect over a USB cable (Chrome or Edge on a computer)" @click="go('usb')">
      {{ stacked ? 'USB cable' : 'USB' }}
    </UButton>
    <UButton :size="size" variant="ghost" :block="stacked" icon="i-lucide-flask-conical" title="Try everything without a helmet; nothing is switched on" @click="go('demo')">
      {{ stacked ? 'Demo (no helmet)' : 'Demo' }}
    </UButton>
  </div>
</template>
