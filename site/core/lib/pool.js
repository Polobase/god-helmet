// Target pool for remote-viewing / telepathy trials, stored in IndexedDB.
//
// The helmet never sees the pictures. It receives the set ids, their sizes
// and the SHA-256 of the manifest (every picture's hash, in order), picks the
// set and target itself, and commits to its choice before you answer. After
// the reveal the app checks that the manifest hash still matches, so no
// picture can be swapped afterwards.
import { idb } from './idb.js'
import { sha256Hex } from './crypto.js'

export const SET_ID = /^[a-z0-9_-]{1,38}$/
const MAX_SIDE = 800

export async function listSets() {
  const sets = await idb.getAll('sets')
  return sets.sort((a, b) => a.id.localeCompare(b.id))
}

export const getSet = (id) => idb.get('sets', id)

export async function deleteSet(id) {
  await idb.delete('sets', id)
}

// Downscales to at most 800 px (JPEG) so pools stay small and portable.
async function normalise(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
  const hash = await sha256Hex(new Uint8Array(await blob.arrayBuffer()))
  return { hash, blob, width: canvas.width, height: canvas.height }
}

export async function addPictures(setId, files) {
  if (!SET_ID.test(setId)) throw new Error('Set name: a-z, 0-9, - or _ (max 38)')
  const set = (await getSet(setId)) ?? { id: setId, images: [] }
  for (const f of files) {
    if (set.images.length >= 8) throw new Error('A set holds at most 8 pictures')
    const img = await normalise(f)
    if (!set.images.some((x) => x.hash === img.hash)) set.images.push(img)
  }
  await idb.put('sets', set)
  return set
}

export function usableSets(sets) {
  return sets.filter((s) => s.images.length >= 2 && s.images.length <= 8)
}

export function manifestOf(sets) {
  return { format: 'godhelmet-pool-manifest', version: 1, sets: usableSets(sets).map((s) => ({ id: s.id, images: s.images.map((i) => i.hash) })) }
}

export async function manifestHash(sets) {
  return sha256Hex(JSON.stringify(manifestOf(sets)))
}

// ---- export / import (share a pool from the person who builds it) ----

const toBase64 = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export async function exportPool() {
  const sets = await listSets()
  const out = { format: 'godhelmet-pool', version: 1, sets: [] }
  for (const s of sets) {
    out.sets.push({ id: s.id, images: await Promise.all(s.images.map(async (i) => ({ hash: i.hash, width: i.width, height: i.height, type: i.blob.type, data: await toBase64(i.blob) }))) })
  }
  return new Blob([JSON.stringify(out)], { type: 'application/json' })
}

export async function importPool(file) {
  const data = JSON.parse(await file.text())
  if (data.format !== 'godhelmet-pool') throw new Error('Not a God Helmet pool file')
  for (const s of data.sets) {
    if (!SET_ID.test(s.id)) continue
    const images = []
    for (const i of s.images) {
      const bytes = Uint8Array.from(atob(i.data), (c) => c.charCodeAt(0))
      const hash = await sha256Hex(bytes)
      if (hash !== i.hash) throw new Error(`Picture in set ${s.id} is damaged`)
      images.push({ hash, width: i.width, height: i.height, blob: new Blob([bytes], { type: i.type }) })
    }
    await idb.put('sets', { id: s.id, images })
  }
  return data.sets.length
}
