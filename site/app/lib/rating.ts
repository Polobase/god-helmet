// The rating a finished session still waits for. Kept per helmet and log
// entry in localStorage, so the prompt appears after a reconnect, a page
// reload or on another page of the app, and never for another helmet's entry
// with the same number. It goes when the session is rated (here, in the Log
// or in a guide's summary), dismissed, or turns out to be rated or gone.
import { reactive, watch } from 'vue'
import { device, call, helmetKey } from './device'

const KEY = 'godhelmet-rating'
const MAX_AGE_MS = 24 * 3600_000

export interface WaitingRating {
  /** helmetKey() of the helmet that ran it. */
  helmet: string
  logId: number
  name: string
  blind: boolean
  /** When the app first saw it running (ms). */
  at: number
  /** It has ended. */
  ended: boolean
}
interface LogEntry { id: number, start: number, rating: number, trialId?: number }

function load(): WaitingRating | null {
  try {
    const w = JSON.parse(localStorage.getItem(KEY) ?? 'null') as WaitingRating | null
    return w && typeof w.helmet === 'string' && Number(w.logId) > 0 ? w : null
  } catch {
    return null
  }
}
function save() {
  try {
    if (state.waiting) localStorage.setItem(KEY, JSON.stringify(state.waiting))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: the prompt lasts as long as the page */
  }
}

const state = reactive<{ waiting: WaitingRating | null, /** The entry was found unrated on the connected helmet. */ checked: string }>({ waiting: load(), checked: '' })
// Sessions whose rating is asked for elsewhere (a guide's summary).
const elsewhere = new Set<string>()
const id = (helmet: string, logId: number) => `${helmet}#${logId}`

/** The entry to rate now on the connected helmet, or null. */
export function ratingDue(): WaitingRating | null {
  const w = state.waiting
  return w && w.ended && device.link === 'connected' && w.helmet === helmetKey() && state.checked === id(w.helmet, w.logId) ? w : null
}

function clear() {
  state.waiting = null
  state.checked = ''
  save()
}
/** The session was rated, or its rating is not wanted here. */
export function ratingDone(logId: number, helmet = helmetKey()) {
  if (state.waiting && state.waiting.logId === logId && state.waiting.helmet === helmet) clear()
}
/** Another part of the app asks for this session's rating (a guide's summary): no prompt for it. */
export function ratingElsewhere(logId: number, helmet = helmetKey()) {
  if (!logId) return
  elsewhere.add(id(helmet, logId))
  ratingDone(logId, helmet)
}

// Is the entry still there, unrated, and the session we saw? (A log that was
// erased counts from 1 again; a trial's session is rated after its reveal, in the Log.)
async function check(w: WaitingRating) {
  try {
    let entry: LogEntry | undefined
    for (let offset = 0; offset < 50 && !entry; offset += 10) {
      const page = await call<{ total: number, items: LogEntry[] }>('log.list', { offset, limit: 10 })
      entry = page.items.find((e) => e.id === w.logId)
      if (!page.items.length || offset + page.items.length >= page.total) break
    }
    if (state.waiting?.logId !== w.logId || state.waiting?.helmet !== w.helmet) return // another session took its place meanwhile
    const startMs = entry && entry.start > 1e9 ? entry.start * 1000 : 0
    const other = startMs > 0 && (startMs > w.at + 120_000 || startMs < w.at - 2 * 3600_000)
    if (!entry || entry.rating >= 0 || entry.trialId || other) return clear()
    state.checked = id(w.helmet, w.logId)
  } catch {
    /* asked again at the next status or reconnect */
  }
}

let checking = false
watch(() => [device.status, device.link, device.stale] as const, async () => {
  const s = device.status
  if (device.link !== 'connected' || device.stale || !s) return
  const helmet = helmetKey()
  const w = state.waiting
  if (s.state !== 'idle') {
    if (!s.logId || s.test || elsewhere.has(id(helmet, s.logId))) return
    if (w && w.helmet === helmet && w.logId === s.logId) return
    state.waiting = { helmet, logId: s.logId, name: s.sessionName, blind: !!s.blind, at: Date.now(), ended: false }
    state.checked = ''
    return save()
  }
  if (!w || w.helmet !== helmet || state.checked === id(helmet, w.logId) || checking) return
  if (Date.now() - w.at > MAX_AGE_MS) return clear() // long ago: it is in the Log
  if (!w.ended) {
    w.ended = true
    save()
  }
  checking = true
  await check(w)
  checking = false
}, { immediate: true })
