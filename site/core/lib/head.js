// The user's head measurements (cm), kept on this device, and the tape
// recipes for them (lib/tape.js).
import { reactive, watch } from 'vue'
import { SITES } from './brain.js'
import { makeTape, cleanHead } from './tape.js'

const KEY = 'head-measurements'
function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

export const head = reactive({ nasionInion: '', earEar: '', circumference: '', ...load() })
watch(head, (h) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(h))
  } catch { /* private mode: keep it for this visit */ }
}, { deep: true })

export const tape = makeTape(SITES)
export const headInUse = () => cleanHead(head)
export const recipeFor = (site) => tape.recipe(site, head)

export function bandText(r) {
  if (!r) return ''
  if (r.band === 'on') return 'on the band'
  return `${r.bandCm.toFixed(1)} cm ${r.band} the band`
}
