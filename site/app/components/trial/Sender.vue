<script setup lang="ts">
// Telepathy sender: on a second phone with the same pool, shows the target of
// an open telepathy trial. The helmet refuses it for any other trial.
import { device, call, errorMessage } from '~/lib/device'
import { getSet, manifestHash, type PictureSet, type SenderView } from '~/lib/trials'

const props = defineProps<{ /** The pool on this phone. */ sets: PictureSet[] }>()

const trialId = ref('')
const picture = ref('') // object URL of the target
const error = ref('')

async function show() {
  error.value = ''
  hide()
  if (!trialId.value) {
    error.value = 'Enter the trial number first.'
    return
  }
  try {
    const s = await call<SenderView>('trial.sender', { id: Number(trialId.value) })
    const set = await getSet(s.set)
    if (!set) throw new Error(`Set "${s.set}" is not on this device: import the same pool file first.`)
    if ((await manifestHash(props.sets)) !== s.manifestHash) throw new Error('This device has a different pool than the receiver; import the same pool file.')
    picture.value = URL.createObjectURL(set.images[s.target]!.blob)
  } catch (e) {
    error.value = errorMessage(e)
  }
}
function hide() {
  if (picture.value) URL.revokeObjectURL(picture.value)
  picture.value = ''
}
onBeforeUnmount(hide)
</script>

<template>
  <section class="panel p-5 sm:p-7">
    <details>
      <summary class="cursor-pointer">
        <h2 class="mr-1.5 inline text-2xl">Sender</h2> <span class="text-sm text-muted">telepathy only, on a second phone</span>
      </summary>
      <div class="mt-4 grid grid-cols-1 gap-3">
        <p class="measure text-sm text-muted">For telepathy trials, on the sender's phone (same pool imported, connected to the helmet as a second app). The receiver must not see this screen.</p>
        <div class="flex flex-wrap items-center gap-2">
          <UInput :model-value="trialId" type="number" min="1" inputmode="numeric" placeholder="Trial number" aria-label="Trial number" class="w-40" @update:model-value="(v) => (trialId = v == null ? '' : String(v))" />
          <UButton :disabled="!device.kind || !trialId" @click="show">Show the target</UButton>
          <UButton v-if="picture" variant="ghost" size="sm" @click="hide">Hide picture</UButton>
        </div>
        <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
        <img v-if="picture" :src="picture" class="max-w-full rounded-lg" alt="Target picture for the sender">
      </div>
    </details>
  </section>
</template>
