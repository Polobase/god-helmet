// The response to a trial (what was written and sketched), kept on this phone
// in IndexedDB until the reveal checks it against the hash the helmet holds.
// Keyed by helmet and trial id: every helmet, and the demo, numbers its trials
// from 1. Entries saved before that were keyed by the trial id alone; they are
// still found, but only where they can belong to no other trial.
import { idb as coreIdb } from '#core/lib/idb.js'
import { responseHashOf as coreResponseHashOf } from '#core/lib/runs.js'
import { helmetKey } from './device'

export interface StoredResponse { trialId: number, text: string, sketch: string, sketches?: string[] }
/** What identifies the trial: its id, and what tells whose response an old entry is. */
export interface ResponseOwner { id: number, responseHash?: string, created?: number }

const idb = coreIdb as {
  get: (store: string, key: IDBValidKey) => Promise<unknown>
  put: (store: string, value: unknown, key?: IDBValidKey) => Promise<unknown>
}
const responseHashOf = coreResponseHashOf as (trialId: number, r: Pick<StoredResponse, 'text' | 'sketch'>) => Promise<string>
const SINCE = 'responses-keyed-since'
const keyOf = (trialId: number, helmet: string) => `${helmet}#${trialId}`

// When this phone began to key responses by helmet (seconds): a trial created
// later never has an entry under the old key.
let since: Promise<number> | null = null
function keyedSince() {
  since ??= (async () => {
    const known = await idb.get('kv', SINCE)
    if (typeof known === 'number') return known
    const now = Date.now() / 1000
    await idb.put('kv', now, SINCE)
    return now
  })().catch((e: unknown) => {
    since = null // asked again next time
    throw e
  })
  return since
}

// Noted as soon as the app is open, before a trial can be created.
if (typeof indexedDB !== 'undefined') keyedSince().catch(() => {})

/** The stored response of this trial on the connected helmet (or on `helmet`), if there is one. */
export async function loadResponse(t: ResponseOwner, helmet = helmetKey()): Promise<StoredResponse | undefined> {
  const switched = await keyedSince()
  const row = await idb.get('responses', keyOf(t.id, helmet)) as StoredResponse | undefined
  if (row) return { text: row.text, sketch: row.sketch, ...(row.sketches ? { sketches: row.sketches } : {}), trialId: t.id }
  const old = await idb.get('responses', t.id) as StoredResponse | undefined
  if (!old) return undefined
  // Locked: it is this trial's when it has the hash the helmet holds. Still
  // open: only a trial from before the keys changed can have its draft there.
  const mine = t.responseHash ? (await responseHashOf(t.id, old)) === t.responseHash : (t.created ?? Infinity) < switched
  return mine ? { ...old, trialId: t.id } : undefined
}

/** Saves the response of trial `r.trialId` on the connected helmet (or on `helmet`). */
export async function storeResponse(r: StoredResponse, helmet = helmetKey()) {
  await keyedSince()
  await idb.put('responses', { ...r, trialId: keyOf(r.trialId, helmet), trial: r.trialId, helmet })
}
