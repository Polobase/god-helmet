<script setup>
import { onMounted, ref } from 'vue'
import { listSets, addPictures, deleteSet, exportPool, importPool, manifestHash, usableSets, SET_ID } from '../lib/pool.js'
import { downloadBlob } from '../lib/format.js'

const sets = ref([])
const hash = ref('')
const setName = ref('')
const files = ref(null)
const busy = ref(false)
const message = ref('')
const reveal = ref({})  // set id -> show thumbnails
const urls = new Map()

async function load() {
  sets.value = await listSets()
  hash.value = usableSets(sets.value).length ? await manifestHash(sets.value) : ''
}
onMounted(load)

function thumb(img) {
  if (!urls.has(img.hash)) urls.set(img.hash, URL.createObjectURL(img.blob))
  return urls.get(img.hash)
}

async function upload() {
  message.value = ''
  const name = setName.value.trim().toLowerCase()
  if (!SET_ID.test(name)) return (message.value = 'Set name: a-z, 0-9, - or _ (max 38).')
  if (!files.value?.files?.length) return (message.value = 'Choose 2–8 pictures.')
  busy.value = true
  try {
    const set = await addPictures(name, [...files.value.files])
    message.value = `Set "${set.id}" now has ${set.images.length} picture(s).`
    files.value.value = ''
    await load()
  } catch (e) {
    message.value = e.message
  } finally {
    busy.value = false
  }
}

async function remove(id) {
  await deleteSet(id)
  await load()
}

async function doExport() {
  downloadBlob(await exportPool(), `godhelmet-pool-${new Date().toISOString().slice(0, 10)}.json`)
}

async function doImport(e) {
  const file = e.target.files[0]
  if (!file) return
  try {
    const n = await importPool(file)
    message.value = `Imported ${n} set(s).`
    await load()
  } catch (err) {
    message.value = err.message
  }
  e.target.value = ''
}
</script>

<template>
  <div class="page">
    <header class="card">
      <span class="eyebrow">Target pool</span>
      <h2>Pictures for remote-viewing trials</h2>
      <p class="small">A set holds 2–8 clearly different pictures (4–5 is standard; chance = 1/N). During a trial the helmet picks one set and one picture in it. Pictures stay on this phone (resized to 800 px); the helmet only receives their hashes. Ideally a friend builds the pool and sends you the exported file, so you have never seen the pictures.</p>
      <p v-if="hash" class="small"><span class="muted">Pool fingerprint:</span> <span class="mono">{{ hash.slice(0, 16) }}…</span></p>
    </header>

    <section class="card">
      <h3>Sets</h3>
      <p v-if="!sets.length" class="muted small">No sets yet.</p>
      <div v-for="s in sets" :key="s.id" class="set">
        <div class="row" style="justify-content: space-between">
          <b>{{ s.id }}</b>
          <span class="small" :class="s.images.length >= 2 ? 'muted' : 'warn'">{{ s.images.length }} picture(s){{ s.images.length < 2 ? ' · needs at least 2' : '' }}</span>
        </div>
        <div v-if="reveal[s.id]" class="thumbs">
          <img v-for="img in s.images" :key="img.hash" :src="thumb(img)" alt="" />
        </div>
        <div class="row">
          <button class="btn ghost sm" @click="reveal[s.id] = !reveal[s.id]">{{ reveal[s.id] ? 'Hide pictures' : 'Show pictures (not if you are the viewer)' }}</button>
          <button class="btn ghost sm" @click="remove(s.id)">Delete set</button>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>Add pictures</h3>
      <div class="grid2">
        <label class="field">Set name<input v-model="setName" type="text" placeholder="set-01" /></label>
        <label class="field">Pictures<input ref="files" type="file" accept="image/*" multiple /></label>
      </div>
      <div class="row"><button class="btn primary" :disabled="busy" @click="upload">{{ busy ? 'Adding…' : 'Add to set' }}</button></div>
      <p v-if="message" class="small">{{ message }}</p>
    </section>

    <section class="card">
      <h3>Share the pool</h3>
      <p class="small muted">The receiver and a telepathy sender need the same pool. Export it here and import the file on the other phone.</p>
      <div class="row">
        <button class="btn" :disabled="!sets.length" @click="doExport">Export pool file</button>
        <label class="btn">Import pool file<input type="file" accept="application/json,.json" hidden @change="doImport" /></label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.set { border-top: 1px solid var(--line); padding-top: 10px; display: grid; gap: 8px; }
.thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 6px; }
.thumbs img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 6px; }
</style>
