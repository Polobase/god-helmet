<script setup>
// Evidence and sources of a program.
import { computed } from 'vue'
import { presetById, sourceEntries } from '../../lib/presets.js'
import { evidenceLabel, evidenceInfo, evidenceClass } from '../../lib/evidence.js'
import { program } from '../../lib/programState.js'

const doc = computed(() => presetById(program.id).doc)
const sources = computed(() => sourceEntries(doc.value.source))
// The Persinger/Murphy caveat only applies to programs from that line of work.
const persingerNote = computed(() => /persinger|murphy|shiva|shakti|koren/i.test(`${doc.value.source ?? ''} ${doc.value.origin ?? ''}`))
</script>

<template>
  <section class="card">
    <div v-if="doc.evidence" class="row ev small">
      <span class="chip" :class="evidenceClass(doc.evidence)">Evidence: {{ evidenceLabel(doc.evidence) }}</span>
      <span class="muted">{{ evidenceInfo(doc.evidence) }}</span>
    </div>
    <h3>Sources <span class="muted small">({{ sources.length }})</span></h3>
    <ul v-if="sources.length" class="sources">
      <li v-for="(s, i) in sources" :key="i">
        <a v-if="s.url" :href="s.url" target="_blank" rel="noopener">{{ s.text }}</a><span v-else>{{ s.text }}</span>
        <a v-for="(u, j) in s.extra" :key="u" :href="u" target="_blank" rel="noopener" class="extra small" :aria-label="`${s.text}, link ${j + 2}`">[{{ j + 2 }}]</a>
      </li>
    </ul>
    <p v-else class="small muted">No sources listed.</p>
    <p v-if="persingerNote" class="muted small">Persinger-lab and Murphy claims are reported as claims. Independent double-blind tests (Granqvist 2005) found no effect of the field; use Blind to test it yourself.</p>
  </section>
</template>

<style scoped>
.ev { gap: 8px; }
.sources { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 14px; overflow-wrap: anywhere; }
.sources .extra { margin-left: 6px; }
</style>
