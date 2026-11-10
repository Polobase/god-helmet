<script setup lang="ts">
// Library, by experience: which brain region is said to give it, and the
// program for it. The page header's search filters the rows.
import { fmtRange } from '#core/lib/units.js'
import { norm } from '#core/lib/search.js'
import { STATE_MAP, presetById, library, type Preset } from '~/lib/programs'
import { programMark } from '~/lib/art'

const experiences = computed(() => {
  const q = norm(library.query.trim()) as string
  return STATE_MAP.map((row) => ({ ...row, p: presetById(row.preset) }))
    .filter((r) => !q || (norm(`${r.state} ${r.region} ${r.p?.doc.name ?? ''}`) as string).includes(q))
})
const open = (p?: Preset) => p && navigateTo(programPath(p.doc.id))
</script>

<template>
  <section class="panel grid gap-4 p-5 sm:p-7">
    <p class="max-w-[85ch] text-sm text-muted">"Claim" = Persinger lab or Todd Murphy. Every mainstream induction of out-of-body or presence experiences used milliamp currents through electrodes on the brain, not µT fields from outside the skull. The fields reach the cortex at about {{ fmtRange(1, 5) }} and deep structures at 10–20× less.</p>
    <div v-if="experiences.length" class="overflow-x-auto rounded-lg border border-default">
      <table class="w-full border-collapse text-left text-sm">
        <thead>
          <tr class="bg-elevated/60 text-[0.8rem] text-muted">
            <th class="px-2.5 py-2 font-semibold">Experience</th>
            <th class="px-2.5 py-2 font-semibold">Brain region</th>
            <th class="px-2.5 py-2 font-semibold">Program</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in experiences" :key="row.preset" class="cursor-pointer border-t border-default align-top hover:bg-primary/10" @click="open(row.p)">
            <td class="px-2.5 py-2">
              <span class="flex items-center gap-2.5">
                <ArtMark v-if="programMark(row.p?.doc.category, row.preset)" :name="programMark(row.p?.doc.category, row.preset)!" class="w-9 shrink-0 text-toned max-sm:hidden" />
                <b class="text-highlighted">{{ row.state }}</b>
              </span>
            </td>
            <td class="px-2.5 py-2 text-muted">{{ row.region }}</td>
            <td class="px-2.5 py-2"><NuxtLink v-if="row.p" :to="programPath(row.p.doc.id)" class="font-semibold text-primary underline underline-offset-4" @click.stop>{{ row.p.doc.name }}</NuxtLink></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="text-sm text-muted">No experience matches.</p>
  </section>
</template>
