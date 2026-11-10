<script setup lang="ts">
// Installs the firmware from the browser (ESP Web Tools, Web Serial: Chrome or
// Edge on a computer). The files are built by firmware/scripts/web_bundle.sh
// and sit on this site in /firmware/, or where runtimeConfig.public.firmwareBase
// points (nuxt.config.ts). Each manifest lists one build per chip; the
// installer picks the one for the chip it finds.
import { device, running } from '~/lib/device'

const base = String(useRuntimeConfig().public.firmwareBase || '/firmware').replace(/\/+$/, '')
const BOARDS = [
  {
    value: 'controller',
    label: 'Helmet controller',
    description: 'An ESP32, ESP32-S3, ESP32-C3 or ESP32-C6 board with the AD5328 module, used from this app over Bluetooth or USB. The chip is recognised automatically.',
    manifest: `${base}/manifest.json`,
  },
  {
    value: 'lcd28',
    label: '2.8" display board',
    description: 'The ESP32-32E touchscreen board, which runs programs from its SD card on its own.',
    manifest: `${base}/manifest-lcd28.json`,
  },
]

const board = ref('controller')
const helmetOff = ref(false)
const versions = reactive<Record<string, string>>({}) // manifest -> version, or '' when the files are missing
const supported = 'serial' in navigator && window.isSecureContext
const chosen = computed(() => BOARDS.find((b) => b.value === board.value)!)
const version = computed(() => versions[chosen.value.manifest])
const blocked = computed(() => {
  if (running()) return 'A session is running on the helmet. Stop it first.'
  if (device.kind === 'usb') return 'The helmet is connected over USB, which holds the port. Disconnect it first.'
  if (version.value === '') return 'The firmware files could not be loaded. Check the internet connection. (A local build has none until firmware/scripts/web_bundle.sh site/public/firmware has run.)'
  return ''
})
const ready = computed(() => helmetOff.value && !blocked.value)

onMounted(async () => {
  for (const b of BOARDS) {
    try {
      const r = await fetch(b.manifest, { cache: 'no-cache' })
      versions[b.manifest] = r.ok ? ((await r.json()) as { version?: string }).version ?? '?' : ''
    } catch {
      versions[b.manifest] = ''
    }
  }
})

async function install() {
  const { connect } = await import('esp-web-tools/dist/connect.js')
  // connect() takes its install button; all it reads from it is the manifest.
  connect({ manifest: chosen.value.manifest } as Parameters<typeof connect>[0])
}
</script>

<template>
  <section class="panel grid grid-cols-1 gap-5 p-5 sm:p-7" aria-labelledby="helmet-firmware">
    <div class="grid grid-cols-1 gap-2">
      <h2 id="helmet-firmware" class="text-2xl">Install the firmware</h2>
      <p class="measure text-sm text-muted">Puts the helmet firmware on a board over a USB cable, with nothing else to install. Pins for each chip: <NuxtLink to="/docs/wiring" class="text-primary underline underline-offset-4">wiring</NuxtLink>.</p>
    </div>

    <UAlert v-if="!supported" color="warning" variant="subtle" icon="i-lucide-triangle-alert" title="Installing needs Chrome or Edge on a computer (Web Serial), on this website or on localhost." />
    <template v-else>
      <URadioGroup v-model="board" :items="BOARDS" variant="card" name="fw-board" aria-label="Board" :ui="{ fieldset: 'grid gap-2 sm:grid-cols-2', item: 'items-start', description: 'mt-0.5' }">
        <template #label="{ item }">
          {{ item.label }}<span v-if="versions[item.manifest]" class="num font-normal text-muted">, {{ versions[item.manifest] }}</span>
        </template>
      </URadioGroup>

      <UCheckbox v-model="helmetOff" label="The helmet is off my head. Installing restarts the board." />
      <div class="flex flex-wrap items-center gap-3">
        <UButton :color="ready ? 'primary' : 'neutral'" :variant="ready ? 'solid' : 'outline'" icon="i-lucide-cpu" :disabled="!ready" @click="install">Install on a board…</UButton>
      </div>
      <UAlert v-if="blocked" color="warning" variant="subtle" icon="i-lucide-triangle-alert" :title="blocked" />
      <p class="measure text-sm text-muted">Plug the board in, pick its port and confirm. For a first install, let the installer erase the board. When updating, keep the data to keep the session log and settings. Some boards need the BOOT button held while the install starts.</p>
    </template>
  </section>
</template>
