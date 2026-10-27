<script setup>
// One row per coil: tick box, site, where it is in plain words, how to find it
// with a tape (cm for the user's head) and what lies under it.
import { computed, nextTick, ref } from 'vue'
import { siteName, SITES } from '../../lib/brain.js'
import { describeSite, HEAD_LABELS } from '../../lib/tape.js'
import { recipeFor, bandText, headInUse } from '../../lib/head.js'

const props = defineProps({
  sites: { type: Array, required: true }, // 8 names or null
  ticks: { type: Array, required: true }, // 8 booleans
  regions: { type: Object, default: () => ({}) }, // site name -> region entry
  layoutChannels: { type: Array, default: null }, // LAYOUTS[...].channels for A/B
  focus: { type: Number, default: null },
})
const emit = defineEmits(['toggle', 'focus', 'site', 'reset', 'measure'])

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
function underText(name, ch) {
  const curated = props.layoutChannels?.[ch]
  const entry = props.regions[name]
  const depth = entry?.depthMm ? ` · ${Math.round(entry.depthMm)} mm scalp to brain` : ''
  if (curated) return `${curated.region}${depth}`
  if (entry) return `${entry.function}${depth}`
  // 10-5 site without a table entry: nearest charted site.
  const p = SITES[name]
  let best = null
  for (const [site, e] of Object.entries(props.regions)) {
    const q = SITES[site]
    if (!q) continue
    const d = dist(p, q)
    if (!best || d < best.d) best = { site, e, d }
  }
  return best ? `Near ${best.site} (${Math.round(best.d)} mm): ${best.e.function}` : ''
}

const rows = computed(() =>
  props.sites.map((s, ch) => {
    const name = siteName(s)
    if (!name) return { ch, used: false }
    const r = recipeFor(name)
    return { ch, used: true, name, where: describeSite(name), r, band: bandText(r), under: underText(name, ch) }
  }),
)
const used = computed(() => rows.value.filter((r) => r.used))
const unused = computed(() => rows.value.filter((r) => !r.used))
const done = computed(() => used.value.filter((r) => props.ticks[r.ch]).length)
const offBand = computed(() => used.value.filter((r) => r.r && r.r.band !== 'on').length)
const anyEstimate = computed(() => used.value.some((r) => r.r?.estimate))
const headNow = computed(() => headInUse())
const list = (rs) => rs.map((r) => `CH${r.ch + 1}`).join(', ')
// Which measurements the distances use: yours, typical, or a mix.
const headText = computed(() => {
  const h = headNow.value
  const own = Object.keys(HEAD_LABELS).filter((k) => !h.defaulted.includes(k))
  const part = (ks) => ks.map((k) => `${h[k]} cm ${HEAD_LABELS[k]}`).join(', ')
  if (!own.length) return { cls: 'warn', text: `Distances are for a typical adult head (${part(h.defaulted)}).`, btn: 'Measure yours' }
  if (h.defaulted.length) return { cls: 'warn', text: `Distances use your ${part(own)}; ${part(h.defaulted)} is a typical value.`, btn: 'Finish measuring' }
  return { cls: 'muted', text: `Distances for your head: ${part(own)}.`, btn: 'Change' }
})
const offText = computed(() => {
  const n = offBand.value
  const all = n === used.value.length
  const who = n === 1 ? (all ? 'The coil sits' : '1 coil sits') : all ? `All ${n} coils sit` : `${n} of ${used.value.length} coils sit`
  return `${who} off the band line: hold ${n === 1 ? 'it' : 'them'} with a second strap or a snug cap, and check that each coil face lies flat on the scalp.`
})
// Coils on or against the ear cannot lie flat.
const EAR_SITES = ['T9h', 'T10h', 'TTP9', 'TTP10', 'TTP9h', 'TTP10h', 'T9', 'T10']
const onEar = computed(() => used.value.filter((r) => EAR_SITES.includes(r.name)).map((r) => r.name))

const listEl = ref(null)
async function onReset() {
  if (!done.value) return
  emit('reset')
  await nextTick()
  listEl.value?.querySelector('input[type=checkbox]')?.focus()
}
</script>

<template>
  <div class="checklist">
    <div class="list-head">
      <div>
        <h3>Coils</h3>
        <p class="small muted">Tick each coil when it sits on its site.</p>
      </div>
      <div class="progress">
        <span class="num" role="status"><b>{{ done }}</b> / {{ used.length }} placed</span>
        <div class="bar" aria-hidden="true"><i :style="{ width: `${used.length ? (100 * done) / used.length : 0}%` }"></i></div>
        <button type="button" class="linkbtn small" :class="{ idle: !done }" :aria-disabled="!done" @click="onReset">Reset</button>
      </div>
    </div>

    <ol ref="listEl" class="coils">
      <li v-for="r in used" :id="`coil-row-${r.ch}`" :key="r.ch" class="coil" :class="{ done: ticks[r.ch], focus: focus === r.ch }"
        @mouseenter="emit('focus', r.ch)" @mouseleave="emit('focus', null)" @focusin="emit('focus', r.ch)" @focusout="emit('focus', null)">
        <label class="tick">
          <input type="checkbox" :checked="ticks[r.ch]" :aria-label="`Coil ${r.ch + 1} placed at ${r.name}`" @change="emit('toggle', r.ch)" />
          <span class="disc num" aria-hidden="true">{{ r.ch + 1 }}</span>
        </label>
        <div class="body">
          <div class="head-line">
            <button type="button" class="site num" :title="`More about ${r.name}`" @click="emit('site', r.name)">{{ r.name }}</button>
            <span class="where">{{ r.where }}</span>
            <span class="band-chip" :class="`band-${r.r?.band}`">{{ r.band }}</span>
          </div>
          <p v-if="r.r" class="find"><span v-if="r.r.estimate" class="approx" title="Scaled from the template head">≈</span>{{ r.r.text }}</p>
          <p v-if="r.r?.detail" class="detail small muted">{{ r.r.detail }}</p>
          <p v-if="r.under" class="under small muted">{{ r.under }}</p>
        </div>
      </li>
    </ol>

    <p v-if="unused.length" class="small muted unused">{{ used.length === 1 ? `Only CH${used[0].ch + 1} is used; the others stay silent.` : `${list(unused)} ${unused.length === 1 ? 'is' : 'are'} not used by this placement and stay${unused.length === 1 ? 's' : ''} silent.` }}</p>
    <p v-if="offBand" class="small note">{{ offText }}</p>
    <p v-if="onEar.length" class="small note">{{ onEar.join(', ') }} {{ onEar.length === 1 ? 'is' : 'are' }} at or on the ear, so the coil cannot lie quite flat: tilt it, or fold the ear forward under it.</p>

    <div class="foot small">
      <span :class="headText.cls">{{ headText.text }}</span>
      <button type="button" class="linkbtn" @click="emit('measure')">{{ headText.btn }}</button>
      <span v-if="anyEstimate" class="muted">≈ = scaled from the template head; measure between the two named sites for accuracy.</span>
    </div>
  </div>
</template>

<style scoped>
.checklist { display: grid; gap: 12px; min-width: 0; }
.list-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.progress { display: grid; grid-template-columns: auto 90px auto; align-items: center; gap: 8px; font-size: 13px; }
.progress .bar { height: 6px; }
.progress .bar i { background: var(--ok); }
.coils { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.coil { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 10px; align-items: start; padding: 10px 12px 10px 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); transition: border-color .15s, background-color .15s; }
.coil.focus { border-color: var(--accent); }
.coil.done { background: color-mix(in srgb, var(--ok) 8%, var(--surface)); border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
.tick { position: relative; display: grid; place-items: center; width: 44px; height: 44px; cursor: pointer; }
.tick input { position: absolute; inset: 0; opacity: 0; margin: 0; width: 100%; height: 100%; cursor: pointer; }
.disc { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-size: 17px; font-weight: 700; border: 2px solid var(--accent); color: var(--text); background: var(--accent-soft); }
.coil.done .disc { background: var(--ok); border-color: var(--ok); color: var(--bg); }
.coil.done .disc::after { content: '✓'; position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; border-radius: 50%; background: var(--surface); color: var(--ok); font-size: 11px; display: grid; place-items: center; border: 1px solid var(--ok); }
.tick input:focus-visible + .disc { outline: 2px solid var(--accent); outline-offset: 2px; }
.body { display: grid; gap: 4px; min-width: 0; }
.head-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.site { font-size: 22px; line-height: 1.1; font-weight: 600; background: none; border: 0; padding: 0; color: var(--text); cursor: pointer; text-decoration: underline dotted var(--muted); text-underline-offset: 4px; }
.site:hover { color: var(--accent); }
.where { font-size: 14px; color: var(--muted); }
.band-chip { margin-left: auto; font-size: 11.5px; padding: 1px 8px; border-radius: 99px; border: 1px solid var(--line); color: var(--muted); white-space: nowrap; }
.band-chip.band-on { border-color: var(--blue); color: var(--blue); }
.band-chip.band-above, .band-chip.band-below { border-color: var(--warn); color: var(--warn); }
.find { font-size: 14.5px; line-height: 1.45; max-width: 70ch; }
.detail { line-height: 1.4; max-width: 70ch; }
.linkbtn.idle { opacity: .45; cursor: default; }
.approx { display: inline-block; margin-right: 4px; color: var(--warn); font-weight: 700; }
.under { line-height: 1.4; overflow-wrap: anywhere; }
.unused, .note { line-height: 1.45; }
.note { color: var(--text); padding: 8px 10px; border-left: 3px solid var(--warn); background: var(--surface-2); border-radius: 0 8px 8px 0; }
.foot { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }
@media (max-width: 520px) {
  .band-chip { margin-left: 0; }
  .site { font-size: 20px; }
}
</style>
