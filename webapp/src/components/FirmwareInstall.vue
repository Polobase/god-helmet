<script setup>
// Installs the firmware from the browser (ESP Web Tools, Web Serial: Chrome or
// Edge on a computer). The files sit next to the page in firmware/, built by
// firmware/scripts/web_bundle.sh (CI does it for GitHub Pages). Each manifest
// lists one build per chip; the installer picks the one for the chip it finds.
import { computed, onMounted, reactive, ref } from 'vue'
import { device, running } from '../ble/device.js'

const BOARDS = [
  {
    key: 'controller',
    title: 'Helmet controller',
    sub: 'An ESP32, ESP32-S3, ESP32-C3 or ESP32-C6 board with the AD5328 module, used from this app over Bluetooth or USB. The chip is recognised automatically.',
    manifest: 'firmware/manifest.json',
  },
  {
    key: 'lcd28',
    title: '2.8" display board',
    sub: 'The ESP32-32E touchscreen board, which runs programs from its SD card on its own.',
    manifest: 'firmware/manifest-lcd28.json',
  },
]

const board = ref('controller')
const helmetOff = ref(false)
const versions = reactive({})  // manifest -> version, or '' when the files are missing
const supported = typeof navigator !== 'undefined' && 'serial' in navigator && typeof window !== 'undefined' && window.isSecureContext
const chosen = computed(() => BOARDS.find((b) => b.key === board.value))
const version = computed(() => versions[chosen.value.manifest])
const blocked = computed(() => {
  if (running()) return 'A session is running on the helmet. Stop it first.'
  if (device.kind === 'usb') return 'The helmet is connected over USB, which holds the port. Disconnect it first.'
  if (version.value === '') return 'This copy of the app has no firmware files (a local build: run firmware/scripts/web_bundle.sh webapp/public/firmware).'
  return ''
})

onMounted(async () => {
  for (const b of BOARDS) {
    try {
      const r = await fetch(b.manifest, { cache: 'no-cache' })
      versions[b.manifest] = r.ok ? (await r.json()).version ?? '?' : ''
    } catch {
      versions[b.manifest] = ''
    }
  }
})

async function install() {
  const { connect } = await import('esp-web-tools/dist/connect.js')
  connect({ manifest: chosen.value.manifest })
}
</script>

<template>
  <section class="card">
    <h2>Install the firmware</h2>
    <p class="small muted">Puts the helmet firmware on a board over a USB cable, with nothing else to install. Pins for each chip: <a href="#docs/wiring">wiring</a>.</p>
    <p v-if="!supported" class="small warn">Installing needs Chrome or Edge on a computer (Web Serial), on this website or on localhost.</p>
    <template v-else>
      <div class="boards" role="radiogroup" aria-label="Board">
        <label v-for="b in BOARDS" :key="b.key" class="board" :class="{ on: board === b.key }">
          <input v-model="board" type="radio" name="fw-board" :value="b.key" />
          <span><b>{{ b.title }}</b><span v-if="versions[b.manifest]" class="muted"> · {{ versions[b.manifest] }}</span><br /><span class="small muted">{{ b.sub }}</span></span>
        </label>
      </div>
      <label class="check"><input v-model="helmetOff" type="checkbox" /> The helmet is off my head. Installing restarts the board.</label>
      <div class="row">
        <button class="btn primary" :disabled="!helmetOff || !!blocked" @click="install">Install on a board…</button>
      </div>
      <p v-if="blocked" class="small warn">{{ blocked }}</p>
      <p class="small muted">Plug the board in, pick its port and confirm. For a first install, let the installer erase the board. When updating, keep the data to keep the session log and settings. Some boards need the BOOT button held while the install starts.</p>
    </template>
  </section>
</template>

<style scoped>
.boards { display: grid; gap: 8px; }
.board { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; cursor: pointer; }
.board.on { border-color: var(--accent, currentColor); }
.board input { margin-top: 4px; }
</style>
