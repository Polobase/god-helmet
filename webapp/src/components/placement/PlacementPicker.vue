<script setup>
// "Select with search" for the placement tab: a button shows the current
// program; it opens a panel with a search field over programs and placements.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { placementKind } from '../../lib/placements.js'

const props = defineProps({
  groups: { type: Array, required: true }, // placementGroups()
  program: { type: Object, default: null }, // selected preset
  group: { type: Object, default: null }, // selected group
})
const emit = defineEmits(['pick'])

const open = ref(false)
const query = ref('')
const active = ref(0)
const root = ref(null)
const input = ref(null)
const uid = `pp-${Math.random().toString(36).slice(2, 8)}`

const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const tokens = (t) => norm(t).split(/[^a-z0-9]+/).filter(Boolean)
// Whole words (OBE, T7) rank above word starts (amyg), word starts above
// substrings (4+ letters only); an exact program id wins.
function score(words, text, id) {
  const tk = tokens(text)
  const flat = norm(text)
  let s = 0
  for (const w of words) {
    if (id && words.length === 1 && norm(id) === w) s += 100
    else if (tk.includes(w)) s += 3
    else if (tk.some((t) => t.startsWith(w))) s += 2
    else if (w.length >= 4 && flat.includes(w)) s += 1
    else return 0
  }
  return s
}
const MAX = 60
const results = computed(() => {
  const q = norm(query.value.trim())
  if (!q) return props.groups.map((g) => ({ kind: 'group', g, label: g.name, meta: `${g.coils} coil${g.coils === 1 ? '' : 's'} · ${g.programs.length} program${g.programs.length === 1 ? '' : 's'}` }))
  const words = q.split(/\s+/).filter((w) => /[a-z0-9]/.test(w))
  if (!words.length) return []
  const out = []
  for (const g of props.groups) {
    const s = score(words, `${g.name} ${g.sites.filter(Boolean).join(' ')}`)
    if (s) out.push({ kind: 'group', g, label: g.name, meta: g.sites.filter(Boolean).join(' · '), s: s + 0.5 })
    for (const p of g.programs) {
      const ps = score(words, `${p.doc.name} ${p.doc.id}`, p.doc.id)
      if (ps) out.push({ kind: 'program', g, p, label: p.doc.name, meta: g.name, s: ps })
    }
  }
  return out.sort((a, b) => b.s - a.s).slice(0, MAX)
})
watch(results, () => (active.value = 0))

function choose(r) {
  emit('pick', r.kind === 'program' ? { group: r.g, program: r.p } : { group: r.g, program: null })
  close()
}
async function toggle() {
  open.value = !open.value
  if (open.value) {
    query.value = ''
    await nextTick()
    input.value?.focus()
    // start on the current placement and keep the panel on screen
    active.value = Math.max(0, results.value.findIndex((r) => r.g === props.group))
    scrollActive()
    root.value?.querySelector('.panel')?.scrollIntoView({ block: 'nearest' })
  }
}
function close(refocus = true) {
  open.value = false
  if (refocus) root.value?.querySelector('.picker-btn')?.focus()
}
function onKey(e) {
  const n = results.value.length
  if (e.key === 'ArrowDown') { e.preventDefault(); active.value = (active.value + 1) % Math.max(1, n); scrollActive() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = (active.value - 1 + n) % Math.max(1, n); scrollActive() }
  else if (e.key === 'Enter') { e.preventDefault(); if (results.value[active.value]) choose(results.value[active.value]) }
}
function onEsc(e) {
  if (!open.value) return
  e.preventDefault()
  close()
}
// Close when focus moves to another control (Tab away). A null relatedTarget
// (a click on a non-focusable spot, or Safari's unfocused buttons) is left to
// the outside-click handler, so the Program button can still toggle the panel.
function onFocusOut(e) {
  if (open.value && e.relatedTarget && !root.value.contains(e.relatedTarget)) close(false)
}
async function scrollActive() {
  await nextTick()
  root.value?.querySelector(`#${uid}-${active.value}`)?.scrollIntoView({ block: 'nearest' })
}
function outside(e) {
  if (open.value && root.value && !root.value.contains(e.target)) close(false)
}
document.addEventListener('pointerdown', outside)
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="root" class="picker" @keydown.esc="onEsc" @focusout="onFocusOut">
    <button type="button" class="picker-btn" :aria-expanded="open" aria-haspopup="dialog" @click="toggle">
      <span class="lbl">Program</span>
      <span class="val">{{ program ? program.doc.name : group?.name ?? 'Choose…' }}</span>
      <svg viewBox="0 0 12 12" aria-hidden="true" class="caret"><path d="M2 4l4 4 4-4" /></svg>
    </button>
    <div v-if="open" class="panel" role="dialog" aria-label="Choose a program or placement" tabindex="-1">
      <input ref="input" v-model="query" type="search" class="search" placeholder="Search programs or sites, e.g. Shiva, obe, T7"
        role="combobox" aria-autocomplete="list" :aria-expanded="results.length > 0" :aria-controls="`${uid}-list`"
        :aria-activedescendant="results.length ? `${uid}-${active}` : undefined" @keydown="onKey" />
      <p class="small muted hint" role="status">{{ query.trim() ? (results.length ? `${results.length}${results.length === MAX ? '+' : ''} matches, best first` : 'Nothing matches. Try a site name (FT7) or a word from the program name.') : 'All placements, most used first. Type to search programs.' }}</p>
      <ul :id="`${uid}-list`" role="listbox" class="results" tabindex="-1" aria-label="Programs and placements">
        <li v-for="(r, i) in results" :id="`${uid}-${i}`" :key="`${r.kind}-${r.kind === 'program' ? r.p.doc.id : r.g.key}`" role="option"
          :aria-selected="i === active" :class="['opt', r.kind, { active: i === active, current: r.kind === 'program' ? r.p === program : r.g === group }]"
          @pointermove="active = i" @click="choose(r)">
          <span class="kind">{{ r.kind === 'program' ? 'Program' : placementKind(r.g) }}</span>
          <span class="name">{{ r.label }}</span>
          <span class="meta">{{ r.meta }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.picker { position: relative; min-width: 0; }
.picker-btn { width: 100%; display: grid; grid-template-columns: auto minmax(0, 1fr) 16px; align-items: center; gap: 10px; text-align: left; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--text); cursor: pointer; min-height: 48px; }
.picker-btn:hover { border-color: var(--accent); }
.lbl { font: 600 11px var(--font-body); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.val { font-weight: 600; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3; }
.caret { width: 12px; height: 12px; fill: none; stroke: var(--muted); stroke-width: 1.6; }
.panel { outline: none; position: absolute; z-index: 20; left: 0; right: 0; top: calc(100% + 6px); background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 18px 40px rgba(0, 0, 0, .28); padding: 10px; display: grid; gap: 6px; }
.search { width: 100%; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; color: var(--text); font-size: 16px; }
.hint { padding: 0 4px; }
.results { list-style: none; margin: 0; padding: 0; max-height: min(420px, 55vh); overflow: auto; display: grid; gap: 2px; }
.opt { display: grid; grid-template-columns: 96px minmax(0, 1fr); column-gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; }
.opt.active { background: var(--accent-soft); }
.opt.current { border-color: var(--accent); }
.kind { grid-row: span 2; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); padding-top: 2px; }
.opt.group .kind { color: var(--blue); }
.name { font-weight: 600; font-size: 14px; overflow-wrap: anywhere; }
.meta { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
@media (max-width: 520px) {
  .opt { grid-template-columns: 1fr; }
  .kind { grid-row: auto; }
}
</style>
