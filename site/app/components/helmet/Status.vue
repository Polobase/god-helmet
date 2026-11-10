<script setup lang="ts">
// Connection and safety acceptance: what is the case, and what to do about it.
import { device, disconnect, reconnect } from '~/lib/device'

const { safetyPath } = useAppNav()
const { lost } = useHelmetLink()
const idle = computed(() => !device.status || device.status.state === 'idle')
const accepted = computed(() => !!device.info?.safetyAccepted)
</script>

<template>
  <ul class="grid grid-cols-1 gap-3 text-sm" aria-label="Status">
    <li class="status-row">
      <UIcon :name="lost ? 'i-lucide-unplug' : device.kind ? 'i-lucide-check' : 'i-lucide-x'" class="size-4.5" :class="lost ? 'text-warning' : device.kind ? 'text-success' : 'text-error'" aria-hidden="true" />
      <span v-if="lost" class="text-highlighted">Connection to {{ device.kind === 'demo' ? 'the demo helmet' : device.name }} lost{{ device.gaveUp || device.needsChooser ? '' : ', reconnecting…' }}</span>
      <span v-else-if="device.kind" class="text-highlighted">{{ device.kind === 'demo' ? 'Demo: no helmet, nothing is switched on' : `Connected: ${device.name} (${device.kind === 'usb' ? 'USB' : 'Bluetooth'})` }}</span>
      <span v-else class="text-highlighted">Not connected. Connect the helmet (or the demo) to change its settings.</span>
      <div class="acts">
        <AppConnect v-if="!device.kind" />
        <template v-else-if="lost">
          <UButton size="sm" icon="i-lucide-refresh-cw" :loading="device.link === 'reconnecting'" @click="reconnect()">Reconnect</UButton>
          <UButton variant="ghost" size="sm" @click="disconnect">Disconnect</UButton>
        </template>
        <UButton v-else-if="idle" variant="ghost" size="sm" @click="disconnect">Disconnect</UButton>
      </div>
    </li>
    <li class="status-row">
      <UIcon :name="accepted ? 'i-lucide-check' : 'i-lucide-triangle-alert'" class="size-4.5" :class="accepted ? 'text-success' : 'text-warning'" aria-hidden="true" />
      <span class="text-highlighted">{{ !device.info ? 'Safety page: connect to see whether it is accepted on this helmet' : accepted ? 'Safety page accepted on this helmet' : 'Safety page not accepted: the helmet will not start a field' }}</span>
      <div class="acts">
        <UButton :to="safetyPath()" size="sm" :color="device.info && !accepted ? 'primary' : 'neutral'" :variant="device.info && !accepted ? 'solid' : 'outline'">{{ accepted ? 'Read it again' : 'Read and accept' }}</UButton>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.status-row { display: grid; grid-template-columns: 1.25rem minmax(0, 1fr) auto; gap: 0.5rem 0.75rem; align-items: center; }
.acts { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; }
/* Phone: the buttons go under the text. */
@media (max-width: 560px) {
  .status-row { grid-template-columns: 1.25rem minmax(0, 1fr); }
  .acts { grid-column: 2; justify-content: flex-start; }
}
</style>
