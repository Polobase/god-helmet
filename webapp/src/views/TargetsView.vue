<script setup>
import { onMounted, ref } from 'vue'
import { listSets, addPictures, deleteSet, exportPool, importPool, manifestHash, usableSets, SET_ID } from '../lib/pool.js'
import { downloadBlob } from '../lib/format.js'

const sets = ref([])
const hash = ref('')
const setName = ref('')
const files = ref(null)
const importInput = ref(null)
const busy = ref(false)
const addMsg = ref({ text: '', ok: false, at: '' })  // at: set id when added from that set's row
const poolMsg = ref({ text: '', ok: false })
const reveal = ref({})  // set id -> show thumbnails
const urls = new Map()
let addTo = ''  // set whose "Add pictures" button opened the file picker

async function load() {
  sets.value = await listSets()
  hash.value = usableSets(sets.value).length ? await manifestHash(sets.value) : ''
}
onMounted(load)

function thumb(img) {
  if (!urls.has(img.hash)) urls.set(img.hash, URL.createObjectURL(img.blob))
  return urls.get(img.hash)
}

// Turns what people type ("Set 01") into a valid set name ("set-01").
const cleanName = (s) => s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 38)

async function upload() {
  const at = addTo
  addTo = ''
  const say = (text, ok = false) => (addMsg.value = { text, ok, at })
  say('')
  const name = cleanName(setName.value)
  setName.value = name
  if (!SET_ID.test(name)) return say('Give the set a name: letters a–z, digits, - or _ (up to 38).')
  if (!files.value?.files?.length) return say('Choose 2–8 pictures.')
  busy.value = true
  try {
    const set = await addPictures(name, [...files.value.files])
    say(`Set "${set.id}" now has ${set.images.length} picture(s).`, true)
    files.value.value = ''
    await load()
  } catch (e) {
    say(e.message)
  } finally {
    busy.value = false
  }
}

// "Add pictures" on a set row: pick files and add them to that set straight away.
function addToSet(id) {
  setName.value = id
  addTo = id
  files.value.click()
}
function picked() {
  if (addTo && addTo === setName.value && files.value.files.length) upload()
  else addTo = ''
}
const cancelPick = () => (addTo = '')

async function remove(s) {
  if (!confirm(`Delete set "${s.id}" and its ${s.images.length} picture(s)? This cannot be undone. Trials that used this set can no longer be judged or checked on this phone.`)) return
  await deleteSet(s.id)
  if (addMsg.value.at === s.id) addMsg.value = { text: '', ok: false, at: '' }
  await load()
}

async function doExport() {
  downloadBlob(await exportPool(), `godhelmet-pool-${new Date().toISOString().slice(0, 10)}.json`)
}

async function doImport(e) {
  const file = e.target.files[0]
  if (!file) return
  poolMsg.value = { text: '', ok: false }
  try {
    const n = await importPool(file)
    poolMsg.value = { text: `Imported ${n} set(s).`, ok: true }
    await load()
  } catch (err) {
    poolMsg.value = { text: err.message, ok: false }
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
      <p v-else class="small warn">If you will be the viewer, do not show the pictures: seeing them spoils your trials.</p>
      <div v-for="s in sets" :key="s.id" class="set">
        <div class="row" style="justify-content: space-between">
          <b>{{ s.id }}</b>
          <span class="small" :class="s.images.length >= 2 ? 'muted' : 'warn'">{{ s.images.length }} picture(s){{ s.images.length < 2 ? ' · needs at least 2' : '' }}</span>
        </div>
        <div v-if="reveal[s.id]" class="thumbs">
          <img v-for="img in s.images" :key="img.hash" :src="thumb(img)" alt="" />
        </div>
        <div class="row">
          <button class="btn ghost sm" @click="reveal[s.id] = !reveal[s.id]">{{ reveal[s.id] ? 'Hide pictures' : 'Show pictures' }}</button>
          <button class="btn ghost sm" :disabled="busy || s.images.length >= 8" @click="addToSet(s.id)">Add pictures</button>
          <button class="btn ghost sm danger push" @click="remove(s)">Delete set</button>
        </div>
        <p v-if="addMsg.text && addMsg.at === s.id" class="small" :class="addMsg.ok ? 'ok' : 'bad'" role="status">{{ addMsg.text }}</p>
      </div>
    </section>

    <section class="card">
      <h3>Add pictures</h3>
      <div class="grid2">
        <label class="field">Set name<input v-model="setName" type="text" placeholder="set-01" /></label>
        <label class="field">Pictures<input ref="files" type="file" accept="image/*" multiple @change="picked" @cancel="cancelPick" /></label>
      </div>
      <div class="row"><button class="btn primary" :disabled="busy" @click="upload">{{ busy ? 'Adding…' : 'Add to set' }}</button></div>
      <p v-if="addMsg.text && !addMsg.at" class="small" :class="addMsg.ok ? 'ok' : 'bad'" role="status">{{ addMsg.text }}</p>
    </section>

    <section class="card">
      <h3>Share the pool</h3>
      <p class="small muted">The receiver and a telepathy sender need the same pool. Export it here and import the file on the other phone.</p>
      <div class="row">
        <button class="btn" :disabled="!sets.length" @click="doExport">Export pool file</button>
        <button class="btn" type="button" @click="importInput.click()">Import pool file</button>
        <input ref="importInput" type="file" accept="application/json,.json" hidden @change="doImport" />
      </div>
      <p v-if="poolMsg.text" class="small" :class="poolMsg.ok ? 'ok' : 'bad'" role="status">{{ poolMsg.text }}</p>
    </section>
  </div>
</template>

<style scoped>
.set { border-top: 1px solid var(--line); padding-top: 10px; display: grid; gap: 8px; }
.set b { overflow-wrap: anywhere; }
.thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 6px; }
.thumbs img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 6px; }
.push { margin-left: auto; }
input[type=file] { font-size: 13px; color: var(--muted); max-width: 100%; }
input[type=file]::file-selector-button { font: inherit; font-weight: 600; color: var(--text); background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 9px 14px; margin-right: 10px; cursor: pointer; }
</style>
