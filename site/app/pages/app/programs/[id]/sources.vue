<script setup lang="ts">
// Evidence and sources of a program.
import { evidenceInfo } from '#core/lib/evidence.js'
import { fidelityInfo } from '#core/lib/presetSchema.js'
import { presetById, sourceEntries, program, doseText } from '~/lib/programs'

const doc = computed(() => presetById(program.id)!.doc)
const sources = computed(() => sourceEntries(doc.value.source))
// The Persinger/Murphy caveat only applies to programs from that line of work.
const persingerNote = computed(() => /persinger|murphy|shiva|shakti|koren/i.test(`${doc.value.source ?? ''} ${doc.value.origin ?? ''}`))
</script>

<template>
  <section class="panel grid gap-4 p-5 sm:p-7">
    <p v-if="doc.evidence" class="flex flex-wrap items-center gap-2 text-sm">
      <span class="text-muted">Evidence:</span>
      <EvidenceBadge :level="doc.evidence" size="md" />
      <span class="text-muted">{{ evidenceInfo(doc.evidence) }}</span>
    </p>
    <p v-if="doc.fidelity" class="flex flex-wrap items-center gap-2 text-sm">
      <span class="text-muted">On this helmet:</span>
      <FidelityBadge :level="doc.fidelity" size="md" />
      <span class="text-muted">{{ fidelityInfo(doc.fidelity) }}</span>
    </p>
    <p v-if="doc.dose" class="text-sm"><span class="text-muted">Field in the source:</span> {{ doseText(doc.dose) }}. <span class="text-muted">This program's own setting is the peak 20 mm in front of each coil.</span></p>
    <h2 class="text-xl">Sources <span class="num font-sans text-sm font-normal text-muted">{{ sources.length }}</span></h2>
    <ul v-if="sources.length" class="grid list-disc gap-1.5 pl-5 text-sm [overflow-wrap:anywhere]">
      <li v-for="(s, i) in sources" :key="i">
        <a v-if="s.url" :href="s.url" target="_blank" rel="noopener" class="text-primary underline underline-offset-4">{{ s.text }}</a><span v-else>{{ s.text }}</span>
        <a v-for="(u, j) in s.extra" :key="u" :href="u" target="_blank" rel="noopener" class="ml-1.5 text-primary" :aria-label="`${s.text}, link ${j + 2}`">[{{ j + 2 }}]</a>
      </li>
    </ul>
    <p v-else class="text-sm text-muted">No sources listed.</p>
    <p v-if="persingerNote" class="measure text-sm text-muted">Persinger-lab and Murphy claims are reported as claims. Independent double-blind tests (Granqvist 2005) found no effect of the field; use Blind to test it yourself.</p>
  </section>
</template>
