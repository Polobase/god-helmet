<script setup>
// "Switch program" in the program header: a search over all programs that
// keeps the open sub-tab (compare fields in Brain, placements in Placement).
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { presets, CATEGORY_LABELS } from '../../lib/presets.js'
import { fmtMinutes } from '../../lib/format.js'
import { queryWords, score } from '../../lib/search.js'
import { program } from '../../lib/programState.js'
import { nav, go } from '../../lib/nav.js'

const open = ref(false)
const query = ref('')
const active = ref(0)
const root = ref(null)
const input = ref(null)
const uid = `ps-${Math.random().toString(36).slice(2, 8)}`

const catLabel = (p) => CATEGORY_LABELS[p.doc.category] ?? p.doc.category ?? 'Other'
const meta = (p) => `${catLabel(p)}${p.session ? ` · ${fmtMinutes(p.session.totalMs)}` : ''}`
const MAX = 60
const results = computed(() => {
  const words = queryWords(query.value)
  if (!words.length) return presets.map((p) => ({ p, label: p.doc.name, meta: meta(p) }))
  return presets
    .map((p) => ({ p, s: score(words, [[p.doc.name, 3], [p.doc.id, 3], [catLabel(p), 2], [(p.session?.sites ?? []).filter(Boolean).join(' '), 2], [(p.doc.targets ?? []).join(' '), 2], [p.doc.summary ?? '', 1]], p.doc.id) }))
    .filter((x) => x.s).sort((a, b) => b.s - a.s).slice(0, MAX)
    .map(({ p }) => ({ p, label: p.doc.name, meta: meta(p) }))
})
watch(results, () => (active.value = 0))

function choose(r) {
  close()
  if (r.p.doc.id !== program.id) go('programs', r.p.doc.id, r.p.session ? nav.sub : '')
}
async function toggle() {
  open.value = !open.value
  if (!open.value) return
  query.value = ''
  await nextTick()
  input.value?.focus()
  active.value = Math.max(0, results.value.findIndex((r) => r.p.doc.id === program.id))
  scrollActive()
}
function close(refocus = true) {
  open.value = false
  if (refocus) root.value?.querySelector('.switch-btn')?.focus()
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
// Close when focus moves to another control; a click on nothing is left to the outside handler.
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
  <div ref="root" class="switcher" @keydown.esc="onEsc" @focusout="onFocusOut">
    <button type="button" class="switch-btn btn ghost sm" :aria-expanded="open" aria-haspopup="dialog" @click="toggle">
      <svg viewBox="0 0 16 16" aria-hidden="true" class="icon"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></svg>
      Switch program
    </button>
    <div v-if="open" class="panel" role="dialog" aria-label="Switch program" tabindex="-1">
      <input ref="input" v-model="query" type="search" class="search" placeholder="Search programs, sites, regions, e.g. Shiva, obe, T7"
        role="combobox" aria-autocomplete="list" :aria-expanded="results.length > 0" :aria-controls="`${uid}-list`"
        :aria-activedescendant="results.length ? `${uid}-${active}` : undefined" @keydown="onKey" />
      <p class="small muted hint" role="status">{{ query.trim() ? (results.length ? `${results.length}${results.length === MAX ? '+' : ''} matches, best first` : 'Nothing matches. Try a site name (FT7) or a word from the program name.') : `All ${presets.length} programs. Type to search.` }}</p>
      <ul :id="`${uid}-list`" role="listbox" class="results" tabindex="-1" aria-label="Programs">
        <li v-for="(r, i) in results" :id="`${uid}-${i}`" :key="r.p.doc.id" role="option" :aria-selected="i === active"
          :class="['opt', { active: i === active, current: r.p.doc.id === program.id }]" @pointermove="active = i" @click="choose(r)">
          <span class="name">{{ r.label }}</span>
          <span class="meta">{{ r.meta }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.switcher { position: relative; }
.icon { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.panel { outline: none; position: absolute; z-index: 30; right: 0; top: calc(100% + 6px); width: min(460px, calc(100vw - 32px)); background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 18px 40px rgba(0, 0, 0, .28); padding: 10px; display: grid; gap: 6px; }
.search { font-size: 16px; }
.hint { padding: 0 4px; }
.results { list-style: none; margin: 0; padding: 0; max-height: min(420px, 55vh); overflow: auto; display: grid; gap: 2px; }
.opt { display: grid; gap: 1px; padding: 8px 10px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; }
.opt.active { background: var(--accent-soft); }
.opt.current { border-color: var(--accent); }
.name { font-weight: 600; font-size: 14px; overflow-wrap: anywhere; }
.meta { font-size: 12px; color: var(--muted); }
</style>
