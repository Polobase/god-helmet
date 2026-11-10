<script setup lang="ts">
// Program reference: every program, generated from presets/*.json, the same
// files the helmet runs. Each program folds open; nothing is left out.
import { describePattern, describeSpatial, fmtMinutes } from '#core/lib/format.js'
import { fmtSetting } from '#core/lib/units.js'
import { PROGRAM_REFERENCE } from '~~/shared/content-meta'
import { repoUrl } from '~~/shared/links'
import { presets, CATEGORY_LABELS, sourceEntries, LAYOUTS, EVIDENCE } from '~/lib/programs'

useSeoMeta({ title: PROGRAM_REFERENCE.label, description: PROGRAM_REFERENCE.description })

interface Row { n: number, name: string, min: number, signal: string, coils: string }
interface Entry {
  id: string, name: string, minutes: string, uT: number, layout: string, evidence?: string, origin?: string
  summary?: string, setting?: string, schedule?: string, coils: string, phases: Row[], notes?: string
  targets: string[], sources: { text: string, url: string | null, extra: string[] }[]
}

const groups = (() => {
  const out: { key: string, label: string, programs: Entry[] }[] = []
  for (const p of presets) {
    if (!p.session) continue
    const d = p.doc
    const s = p.session
    const key = d.category ?? 'other'
    let g = out.find((x) => x.key === key)
    if (!g) out.push((g = { key, label: CATEGORY_LABELS[key] ?? key, programs: [] }))
    g.programs.push({
      id: d.id,
      name: d.name,
      minutes: fmtMinutes(s.totalMs),
      uT: Number(d.uT ?? 1),
      layout: s.layout === 'custom' ? 'custom' : LAYOUTS[s.layout].title,
      evidence: d.evidence,
      origin: d.origin,
      summary: d.summary,
      setting: d.setting,
      schedule: d.schedule,
      coils: s.sites.map((site, i) => (site ? `CH${i + 1} ${site}` : null)).filter(Boolean).join(', '),
      phases: s.phases.map((ph, i) => ({
        n: i + 1,
        name: ph.name,
        min: +(ph.durationMs / 60000).toFixed(2),
        signal: describePattern(ph.pattern) + (ph.track2 ? ` + ${describePattern(ph.track2.pattern)}` : ''),
        coils: describeSpatial(ph.spatial) + (ph.track2 ? ` + ${describeSpatial(ph.track2.spatial)}` : '') + (ph.level < 1 ? `, level ${ph.level}` : ''),
      })),
      notes: d.notes,
      targets: d.targets ?? [],
      sources: sourceEntries(d.source),
    })
  }
  return out
})()

const total = groups.reduce((n, g) => n + g.programs.length, 0)
const levels = Object.entries(EVIDENCE)
// Every category with its programs, as the old page's contents list had them.
const toc = groups.map((g) => ({ id: `cat-${g.key}`, depth: 2, text: `${g.label} (${g.programs.length})`, children: g.programs.map((p) => ({ id: p.id, depth: 3, text: p.name })) }))

// Field strengths in the unit chosen in the app (µT or mG). The page is
// delivered in µT; the choice is applied once it has come alive.
const alive = ref(false)
onNuxtReady(() => (alive.value = true))
const field = (uT: number) => (alive.value ? fmtSetting(uT) as string : `${uT.toFixed(1)} µT`)

// Open every fold (for printing or the browser's find), or close them again.
const allOpen = ref(false)
// A link to one program (#<id>) opens its fold.
const openId = ref('')
onMounted(() => {
  const follow = async () => {
    openId.value = decodeURIComponent(location.hash.slice(1))
    await nextTick()
    document.getElementById(openId.value)?.scrollIntoView()
  }
  // After the page has taken over from the delivered HTML: a fold opened
  // while that is still going on would be left closed.
  onNuxtReady(() => location.hash && follow())
  window.addEventListener('hashchange', follow)
  onBeforeUnmount(() => window.removeEventListener('hashchange', follow))
})
</script>

<template>
  <DocsShell>
    <article>
      <header class="pb-8 border-b border-default">
        <h1 class="text-4xl sm:text-[2.9rem]">{{ PROGRAM_REFERENCE.label }}</h1>
        <p class="mt-5 text-lg text-toned measure">
          All {{ total }} programs, generated from <a :href="repoUrl('presets')" target="_blank" rel="noopener" class="text-primary underline underline-offset-4">presets/*.json</a>, the same files the helmet runs.
          Field values are the peak at 20 mm depth; calibrate your coils before you rely on them.
        </p>
        <dl class="mt-6 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr] text-sm">
          <template v-for="[key, e] in levels" :key="key">
            <dt><EvidenceBadge :level="key" /></dt>
            <dd class="text-muted">{{ e.info }}</dd>
          </template>
        </dl>
      </header>

      <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
        <div class="min-w-0 py-8">
          <UContentToc :links="toc" title="Categories and programs" class="mb-6 lg:hidden" />
          <div class="flex flex-wrap items-center justify-end gap-3">
            <ClientOnly><UnitToggle /></ClientOnly>
            <UButton size="sm" :icon="allOpen ? 'i-lucide-fold-vertical' : 'i-lucide-unfold-vertical'" @click="allOpen = !allOpen">{{ allOpen ? 'Close all programs' : 'Open all programs' }}</UButton>
          </div>

          <section v-for="g in groups" :key="g.key" class="mt-10 first:mt-4">
            <h2 :id="`cat-${g.key}`" class="text-2xl">{{ g.label }} <span class="num text-base font-sans font-normal text-muted">{{ g.programs.length }}</span></h2>
            <div class="mt-4 border-y border-default divide-y divide-default">
              <details v-for="p in g.programs" :id="p.id" :key="p.id" class="group scroll-mt-24" :open="allOpen || p.id === openId">
                <summary class="flex cursor-pointer list-none flex-wrap items-baseline gap-x-4 gap-y-1 py-3 [&::-webkit-details-marker]:hidden">
                  <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 self-center text-muted transition-transform group-open:rotate-90" />
                  <span class="font-semibold text-highlighted">{{ p.name }}</span>
                  <EvidenceBadge :level="p.evidence" />
                  <span class="num ml-auto text-sm text-muted">{{ p.minutes }}, {{ field(p.uT) }}</span>
                </summary>
                <div class="grid gap-3 pb-6 pl-8 text-[0.95rem]">
                  <p class="text-sm text-muted"><code class="text-xs">{{ p.id }}</code>, layout: {{ p.layout }}<template v-if="p.origin">, {{ p.origin }}</template></p>
                  <p v-if="p.summary" class="measure">{{ p.summary }}</p>
                  <p v-if="p.setting" class="measure"><b>Setting:</b> {{ p.setting }}</p>
                  <p v-if="p.schedule" class="measure"><b>Schedule:</b> {{ p.schedule }}</p>
                  <p><b>Coils:</b> <span class="num">{{ p.coils }}</span></p>
                  <div class="overflow-x-auto">
                    <table class="w-full min-w-[34rem] text-sm">
                      <thead class="text-left text-muted">
                        <tr class="border-b border-default"><th class="py-1.5 pr-3 font-normal">#</th><th class="py-1.5 pr-3 font-normal">Phase</th><th class="py-1.5 pr-3 font-normal">Min</th><th class="py-1.5 pr-3 font-normal">Signal</th><th class="py-1.5 font-normal">Coils</th></tr>
                      </thead>
                      <tbody class="align-top">
                        <tr v-for="r in p.phases" :key="r.n" class="border-b border-muted last:border-0">
                          <td class="num py-1.5 pr-3 text-muted">{{ r.n }}</td><td class="py-1.5 pr-3">{{ r.name }}</td><td class="num py-1.5 pr-3">{{ r.min }}</td><td class="py-1.5 pr-3">{{ r.signal }}</td><td class="py-1.5">{{ r.coils }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p v-if="p.notes" class="measure text-toned">{{ p.notes }}</p>
                  <p v-if="p.targets.length"><b>Aims at:</b> {{ p.targets.join(', ') }} (<NuxtLink :to="`/app/programs/${p.id}/brain`" class="text-primary underline underline-offset-4">field on the brain</NuxtLink>)</p>
                  <p v-if="p.sources.length" class="text-sm">
                    <b>Sources:</b>
                    <template v-for="(s, i) in p.sources" :key="i">
                      <template v-if="i">; </template>
                      <a v-if="s.url" :href="s.url" target="_blank" rel="noopener" class="text-primary underline underline-offset-4">{{ s.text || s.url }}</a><template v-else>{{ s.text }}</template>
                      <a v-for="(u, j) in s.extra" :key="u" :href="u" target="_blank" rel="noopener" class="text-primary"> [{{ j + 2 }}]</a>
                    </template>
                  </p>
                  <p><UButton :to="`/app/programs/${p.id}`" size="sm" trailing-icon="i-lucide-arrow-right">Open in the app</UButton></p>
                </div>
              </details>
            </div>
          </section>
        </div>
        <aside class="max-lg:hidden">
          <div class="sticky top-(--ui-header-height) max-h-[calc(100dvh-var(--ui-header-height))] overflow-y-auto py-8">
            <UContentToc :links="toc" title="Categories and programs" highlight />
          </div>
        </aside>
      </div>
    </article>
  </DocsShell>
</template>
