<script setup lang="ts">
// The picture pool: sets of 2–8 pictures the trials draw from. The pictures
// stay on this phone (IndexedDB); the helmet only receives their hashes.
import { downloadBlob } from '#core/lib/format.js'
import { errorMessage } from '~/lib/device'
import { listSets, addPictures, deleteSet, exportPool, importPool, manifestHash, usableSets, SET_ID, type PictureSet } from '~/lib/trials'

useHead({ title: 'Picture pool' })
const confirm = useConfirm()

const sets = ref<PictureSet[]>([])
const hash = ref('')
const setName = ref('')
const files = useTemplateRef<{ inputRef: HTMLInputElement | null }>('files')
const importInput = useTemplateRef<HTMLInputElement>('importInput')
const busy = ref(false)
const addMsg = ref({ text: '', ok: false, at: '' }) // at: set id when added from that set's row
const poolMsg = ref({ text: '', ok: false })
let addTo = '' // set whose "Add pictures" button opened the file picker

const picker = () => files.value?.inputRef ?? null

async function load() {
  sets.value = await listSets()
  hash.value = usableSets(sets.value).length ? await manifestHash(sets.value) : ''
}
onMounted(load)

// Turns what people type ("Set 01") into a valid set name ("set-01").
const cleanName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 38)

async function upload() {
  const at = addTo
  addTo = ''
  const say = (text: string, ok = false) => {
    addMsg.value = { text, ok, at }
  }
  say('')
  const name = cleanName(setName.value)
  setName.value = name
  if (!SET_ID.test(name)) return say('Give the set a name: letters a–z, digits, - or _ (up to 38).')
  const input = picker()
  if (!input?.files?.length) return say('Choose 2–8 pictures.')
  busy.value = true
  try {
    const set = await addPictures(name, [...input.files])
    say(`Set "${set.id}" now has ${set.images.length} picture(s).`, true)
    input.value = ''
    await load()
  } catch (e) {
    say(errorMessage(e))
  } finally {
    busy.value = false
  }
}

// "Add pictures" on a set row: pick files and add them to that set straight away.
function addToSet(id: string) {
  setName.value = id
  addTo = id
  picker()?.click()
}
function picked() {
  if (addTo && addTo === setName.value && picker()?.files?.length) upload()
  else addTo = ''
}
const cancelPick = () => {
  addTo = ''
}

async function remove(s: PictureSet) {
  const yes = await confirm({
    title: `Delete set "${s.id}" and its ${s.images.length} picture(s)?`,
    description: 'This cannot be undone. Trials that used this set can no longer be judged or checked on this phone.',
    confirmLabel: 'Delete set',
    danger: true,
  })
  if (!yes) return
  await deleteSet(s.id)
  if (addMsg.value.at === s.id) addMsg.value = { text: '', ok: false, at: '' }
  await load()
}

async function doExport() {
  downloadBlob(await exportPool(), `godhelmet-pool-${new Date().toISOString().slice(0, 10)}.json`)
}

async function doImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  poolMsg.value = { text: '', ok: false }
  try {
    const n = await importPool(file)
    poolMsg.value = { text: `Imported ${n} set(s).`, ok: true }
    await load()
  } catch (err) {
    poolMsg.value = { text: errorMessage(err), ok: false }
  }
  input.value = ''
}
</script>

<template>
  <div class="grid grid-cols-1 gap-5">
    <header class="grid grid-cols-1 gap-2">
      <p class="text-sm font-semibold text-muted">Picture pool</p>
      <h2 class="text-2xl">Pictures for remote-viewing trials</h2>
      <p class="measure text-sm text-muted">A set holds 2–8 clearly different pictures (4–5 is standard; chance = 1/N). During a trial the helmet picks one set and one picture in it. Pictures stay on this phone (resized to 800 px); the helmet only receives their hashes. Ideally a friend builds the pool and sends you the exported file, so you have never seen the pictures.</p>
      <p v-if="hash" class="text-sm"><span class="text-muted">Pool fingerprint:</span> <span class="font-mono text-highlighted" data-test="fingerprint">{{ hash.slice(0, 16) }}…</span></p>
    </header>

    <section class="panel grid grid-cols-1 gap-4 p-5 sm:p-7" aria-labelledby="pool-sets">
      <h3 id="pool-sets" class="text-xl">Sets <span v-if="sets.length" class="num font-sans text-sm font-normal text-muted">{{ sets.length }}</span></h3>
      <p v-if="!sets.length" class="text-sm text-muted">No sets yet.</p>
      <UAlert v-else color="warning" variant="subtle" icon="i-lucide-eye-off" description="If you will be the viewer, do not show the pictures: seeing them spoils your trials." />
      <TrialPoolSet v-for="s in sets" :key="s.id" :set="s" :busy="busy" :message="addMsg.at === s.id ? addMsg : null" @add="addToSet(s.id)" @remove="remove(s)" />
    </section>

    <section class="panel grid grid-cols-1 gap-4 p-5 sm:p-7" aria-labelledby="pool-add">
      <h3 id="pool-add" class="text-xl">Add pictures</h3>
      <div class="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
        <UFormField label="Set name">
          <UInput v-model="setName" type="text" placeholder="set-01" size="lg" class="w-full" autocapitalize="off" autocomplete="off" spellcheck="false" />
        </UFormField>
        <UFormField label="Pictures">
          <UInput ref="files" type="file" accept="image/*" multiple size="lg" class="w-full" @change="picked" @cancel="cancelPick" />
        </UFormField>
      </div>
      <div><UButton color="primary" variant="solid" :disabled="busy" @click="upload">{{ busy ? 'Adding…' : 'Add to set' }}</UButton></div>
      <p v-if="addMsg.text && !addMsg.at" class="text-sm" :class="addMsg.ok ? 'text-success' : 'text-error'" role="status">{{ addMsg.text }}</p>
    </section>

    <section class="panel grid grid-cols-1 gap-4 p-5 sm:p-7" aria-labelledby="pool-share">
      <h3 id="pool-share" class="text-xl">Share the pool</h3>
      <p class="measure text-sm text-muted">The receiver and a telepathy sender need the same pool. Export it here and import the file on the other phone.</p>
      <div class="flex flex-wrap items-center gap-2">
        <UButton icon="i-lucide-download" :disabled="!sets.length" @click="doExport">Export pool file</UButton>
        <UButton icon="i-lucide-upload" @click="importInput?.click()">Import pool file</UButton>
        <input ref="importInput" type="file" accept="application/json,.json" hidden @change="doImport">
      </div>
      <p v-if="poolMsg.text" class="text-sm" :class="poolMsg.ok ? 'text-success' : 'text-error'" role="status">{{ poolMsg.text }}</p>
    </section>
  </div>
</template>
