<script setup lang="ts">
// Library, by site: what lies under each scalp site, and the programs with a
// coil there. Below the map, every charted site as a table.
import { library } from '~/lib/programs'
import { useRegions } from '~/lib/placement'

const { charted } = useRegions()
const rows = computed(() => Object.values(charted.value))
const section = ref<HTMLElement>()
const explorer = ref<{ show: () => void }>()
function openSite(n: string) {
  library.site = n
  // on phones the site card sits under the map
  nextTick(() => (matchMedia('(max-width: 820px)').matches ? explorer.value?.show() : section.value?.scrollIntoView({ behavior: smooth(), block: 'start' })))
}
</script>

<template>
  <section ref="section" class="panel grid gap-4 p-5 sm:p-7">
    <p class="measure text-sm text-muted">Tap any site to see how to find it, what lies under it, what stimulating that area did, and which programs use it.</p>
    <PlacementSiteExplorer ref="explorer" v-model:site="library.site" />
    <details v-if="rows.length" class="min-w-0">
      <summary class="cursor-pointer font-semibold text-highlighted">All {{ rows.length }} charted sites as a table</summary>
      <div class="mt-3 overflow-x-auto rounded-lg border border-default">
        <table class="w-full border-collapse text-left text-sm">
          <thead>
            <tr class="bg-elevated/60 text-[0.8rem] text-muted">
              <th class="px-2.5 py-2 font-semibold">Site</th>
              <th class="px-2.5 py-2 font-semibold whitespace-nowrap">Scalp → brain</th>
              <th class="px-2.5 py-2 font-semibold">Underneath (MRI studies)</th>
              <th class="px-2.5 py-2 font-semibold">Function (mainstream)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" class="cursor-pointer border-t border-default align-top hover:bg-primary/10" @click="openSite(r.site)">
              <td class="num px-2.5 py-2"><UButton variant="link" color="primary" class="p-0 font-semibold" :aria-label="`Show ${r.site} on the map`" @click.stop="openSite(r.site)">{{ r.site }}</UButton></td>
              <td class="num px-2.5 py-2 whitespace-nowrap">{{ r.depthMm.toFixed(1) }} mm</td>
              <td class="px-2.5 py-2">{{ r.anatomy.split(' | ')[0] }}</td>
              <td class="px-2.5 py-2 text-muted">{{ r.function }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-sm text-muted">Template values (MNI); real heads differ by 5–10 mm. Sources: Koessler 2009, Jurcak/Dan lab 10/5 projections, Scrivener &amp; Reader 2022.</p>
    </details>
  </section>
</template>
