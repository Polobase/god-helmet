<script setup lang="ts">
// The Helmet tab: connection and safety, calibration, the wiring check, the
// helmet's settings, what it records about the environment, and the firmware
// installer. The forms' state is in lib/helmet.ts.
import { device, helmetKey } from '~/lib/device'
import { draft, loadDraft, settingsArrived } from '~/lib/helmet'

useHead({ title: 'Helmet' })

// A fresh editable copy of the settings on every visit. When the helmet sends
// them again (after a reconnect), unsaved edits stay; a dropped connection
// keeps the settings, so the forms stay too.
loadDraft()
watch(() => device.settings, settingsArrived)
// Another helmet: its own settings, whatever was being edited for the one before.
watch(() => helmetKey(), loadDraft)
</script>

<template>
  <div class="grid grid-cols-1 gap-5">
    <header class="panel grid grid-cols-1 gap-5 p-5 sm:p-7">
      <div class="flex items-start justify-between gap-5">
        <div class="grid grid-cols-1 gap-2">
          <h1 class="text-4xl">Helmet</h1>
          <p class="measure text-sm text-muted">Connection and safety, calibration, the wiring check, the helmet's settings and its firmware.</p>
        </div>
        <!-- Nothing connected: the band with its cable loose. Connected: the band on a head, the field on. -->
        <ArtMark :name="device.kind ? 'helmet' : 'unplugged'" animate class="w-16 shrink-0 text-toned sm:w-24" />
      </div>
      <HelmetStatus />
    </header>

    <template v-if="draft">
      <HelmetCalibration />
      <HelmetWiringCheck />
      <HelmetSettings />
      <HelmetEnvironment />
    </template>

    <HelmetFirmwareInstall />
  </div>
</template>
