<script setup>
// One program in the library: name, its coils on a small head, a line of the
// summary, length, evidence and layout.
import { computed } from 'vue'
import { CATEGORY_LABELS } from '../../lib/presets.js'
import { layoutInfo } from '../../lib/layouts.js'
import { sessionSites } from '../../lib/brain.js'
import { evidenceLabel, evidenceInfo, evidenceClass } from '../../lib/evidence.js'
import { routeHash } from '../../lib/routes.js'
import CoilGlyph from '../CoilGlyph.vue'

const props = defineProps({
  p: { type: Object, required: true }, // preset { doc, session, error }
  current: { type: Boolean, default: false },
  showCategory: { type: Boolean, default: false },
})
const doc = computed(() => props.p.doc)
const minutes = computed(() => Math.round((props.p.session?.totalMs ?? 0) / 60000))
const layout = computed(() => (props.p.session ? layoutInfo(props.p.session.layout) : null))
</script>

<template>
  <a class="pcard" :class="{ on: current }" :href="routeHash('programs', doc.id)" :aria-current="current ? 'true' : null">
    <span class="top">
      <span class="head">
        <span v-if="showCategory" class="cat">{{ CATEGORY_LABELS[doc.category] ?? doc.category }}</span>
        <span class="name">{{ doc.name }}</span>
      </span>
      <CoilGlyph v-if="p.session" class="mark" :sites="sessionSites(p.session)" />
    </span>
    <span v-if="doc.summary" class="sum">{{ doc.summary }}</span>
    <span v-if="p.session" class="meta">
      <span class="dur"><b class="num">{{ minutes }}</b> min</span>
      <span v-if="doc.evidence" class="chip" :class="evidenceClass(doc.evidence)" :title="evidenceInfo(doc.evidence)">{{ evidenceLabel(doc.evidence) }}</span>
      <span v-if="layout.key !== 'custom'" :title="layout.title">{{ layout.name }}</span>
    </span>
    <span v-else class="small bad">Invalid program file: {{ p.error }}</span>
  </a>
</template>

<style scoped>
.pcard { display: grid; align-content: start; gap: 8px; padding: 14px 14px 12px; border-radius: var(--radius); border: 1px solid var(--line); background: var(--surface); color: var(--text); text-decoration: none; min-width: 0; box-shadow: inset 0 1px 0 var(--highlight); transition: border-color .15s, background-color .15s; }
.pcard:hover { border-color: color-mix(in srgb, var(--text) 30%, var(--line)); background: var(--surface-2); color: var(--text); }
.pcard.on { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.top { display: grid; grid-template-columns: minmax(0, 1fr) 44px; gap: 12px; align-items: start; }
.head { display: grid; gap: 3px; min-width: 0; }
.cat { font-size: 12px; font-weight: 600; color: var(--muted); }
.name { font: 600 18px/1.2 var(--font-display); letter-spacing: .01em; overflow-wrap: anywhere; }
.mark { width: 44px; }
.sum { font-size: 13px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; font-size: 12.5px; color: var(--muted); margin-top: auto; }
.meta .chip { font-size: 11px; padding: 0 7px; }
.dur b { font-size: 16px; color: var(--text); font-weight: 600; }
@media (max-width: 520px) {
  .pcard { padding: 12px; gap: 6px; }
  .sum { -webkit-line-clamp: 1; line-clamp: 1; }
}
</style>
