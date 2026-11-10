<script setup lang="ts">
// One program: a header with Start, and sub-pages for the overview, the coil
// placement, the field on the brain and the sources.
import { useIntersectionObserver } from '@vueuse/core'
import { fmtSetting, unitLabel } from '#core/lib/units.js'
import { device } from '~/lib/device'
import { presetById, sourceEntries, categoryLabel, layoutInfo, sessionSites, program, preview, groupOf, usedCoils, placedCount, stopPreview, selectProgram } from '~/lib/programs'

// Moving between a program's own sub-pages keeps the scroll position (the
// slim bar stays under your thumb); arriving from anywhere else starts at the top.
definePageMeta({
  // The same page for every program (and each sub-page likewise, below):
  // "Switch program" then keeps the open view, its toggles and the 3D scene.
  key: 'program',
  scrollToTop: (to, from) => !(from.path.startsWith('/app/programs/') && to.params.id === from.params.id),
})

const route = useRoute()
const id = computed(() => String(route.params.id))

// The route names the program; an unknown name goes back to the library.
if (!presetById(id.value)) await navigateTo({ path: '/app/programs', query: { missing: id.value } }, { replace: true })
selectProgram(id.value)
watch(id, (v) => (presetById(v) ? selectProgram(v) : navigateTo({ path: '/app/programs', query: { missing: v } }, { replace: true })))

const preset = computed(() => presetById(program.id)!)
const doc = computed(() => preset.value.doc)
const session = computed(() => preset.value.session)
const group = computed(() => groupOf(program.id))
const layout = computed(() => (session.value ? layoutInfo(session.value.layout) : null))
const sites = computed(() => (session.value ? sessionSites(session.value) : []))
const coils = computed(() => sites.value.filter(Boolean).length)
const category = computed(() => categoryLabel(doc.value.category))
const minutes = computed(() => Math.round((session.value?.totalMs ?? 0) / 60000))
// The mark lights up with the preview, or with the helmet while it runs this program.
const running = computed(() => {
  const st = device.status
  // (Only from a live status: while the connection is down, coil activity is not known.)
  return st && !device.stale && st.state !== 'idle' && !st.test && !st.blind && st.sessionId === program.id ? st.levels : null
})
const levels = computed(() => (preview.value ? preview.value.drives.map(Math.abs) : running.value))

useHead({ title: () => doc.value.name })

const sub = computed(() => programSub(route.path))
const subs = computed(() => [
  { key: '', label: 'Overview' },
  { key: 'placement', label: 'Placement', badge: group.value ? `${placedCount(group.value)}/${usedCoils(group.value).length}` : '' },
  { key: 'brain', label: 'Brain' },
  { key: 'sources', label: 'Sources', badge: String(sourceEntries(doc.value.source).length) },
])
const openStart = () => (program.startOpen = true)
const busy = computed(() => !!device.status && device.status.state !== 'idle')

// A slim bar with the sub-pages and Start once the header has scrolled away.
const tabsEl = ref<HTMLElement>()
const stuck = ref(false)
useIntersectionObserver(tabsEl, ([e]) => (stuck.value = !!e && !e.isIntersecting && e.boundingClientRect.top < 80))
onBeforeUnmount(stopPreview)
</script>

<template>
  <div class="grid gap-5">
    <AppLivePanel />

    <header class="relative grid gap-5 overflow-hidden panel px-5 pt-4 sm:px-7 sm:pt-5">
      <div class="stage" aria-hidden="true" />
      <div class="relative flex items-center justify-between gap-3">
        <UButton to="/app/programs" variant="link" color="neutral" icon="i-lucide-arrow-left" class="px-0">All programs</UButton>
        <ProgramSwitcher />
      </div>

      <div class="relative grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-x-5 gap-y-5 sm:grid-cols-[minmax(0,1fr)_13rem] sm:gap-x-8">
        <div class="grid min-w-0 gap-4">
          <p class="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
            <span>{{ category }}</span>
            <EvidenceBadge :level="doc.evidence" />
          </p>
          <h1 class="max-w-[22ch] text-3xl sm:text-[2.6rem]">{{ doc.name }}</h1>
        </div>
        <figure v-if="session" class="row-span-2 m-0 grid justify-items-center gap-1 max-sm:row-span-1">
          <CoilGlyph :sites="sites" :levels="levels ?? undefined" rings :label="`${coils} coils seen from above`" />
          <figcaption v-if="layout" class="text-center text-xs text-muted max-sm:hidden" :title="layout.title">{{ layout.key === 'custom' ? 'Own 10-10 sites' : `${layout.name} layout` }}</figcaption>
        </figure>
        <div v-if="session" class="grid gap-5 max-sm:col-span-2">
          <dl class="readouts">
            <div><dd><b class="num">{{ minutes }}</b> min</dd><dt>Length</dt></div>
            <div><dd><b class="num">{{ coils }}</b> of 8</dd><dt>Coils</dt></div>
            <div><dd><b class="num">{{ session.phases.length }}</b></dd><dt>Phases</dt></div>
            <div><dd><b class="num">{{ fmtSetting(program.uT, false) }}</b> {{ unitLabel() }}</dd><dt>Field at 20 mm</dt></div>
          </dl>
          <div class="max-sm:hidden">
            <UButton color="primary" variant="solid" size="xl" class="min-w-40 justify-center" :disabled="busy" :title="busy ? 'A session is running' : ''" @click="openStart">{{ busy ? 'Session running' : 'Start…' }}</UButton>
          </div>
        </div>
      </div>

      <nav v-if="session" ref="tabsEl" class="subtabs relative" aria-label="Program sections">
        <NuxtLink v-for="t in subs" :key="t.key" :to="programPath(program.id, t.key)" :aria-current="sub === t.key ? 'page' : undefined">
          {{ t.label }}<span v-if="t.badge" class="badge num">{{ t.badge }}</span>
        </NuxtLink>
      </nav>
    </header>

    <div v-if="session" class="slim" :class="{ on: stuck }" :inert="!stuck" :aria-hidden="!stuck">
      <div class="app-container flex items-center gap-3">
        <b class="min-w-0 flex-[0_1_16rem] truncate font-display font-[620] max-sm:hidden">{{ doc.name }}</b>
        <nav class="subtabs flex-1" aria-label="Program sections">
          <NuxtLink v-for="t in subs" :key="t.key" :to="programPath(program.id, t.key)" :aria-current="sub === t.key ? 'page' : undefined">
            {{ t.label }}<span v-if="t.badge" class="badge num">{{ t.badge }}</span>
          </NuxtLink>
        </nav>
        <UButton color="primary" variant="solid" size="sm" class="max-sm:hidden" :disabled="busy" @click="openStart">Start…</UButton>
      </div>
    </div>

    <UAlert v-if="!session" color="error" variant="subtle" icon="i-lucide-file-x" title="Invalid program file" :description="preset.error ?? undefined" />
    <NuxtPage v-else :page-key="(r) => String(r.name)" />

    <template v-if="session">
      <ProgramStartPanel />
      <div class="fixed inset-x-0 bottom-0 z-30 border-t border-default bg-default/90 px-4 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur sm:hidden">
        <UButton color="primary" variant="solid" size="lg" block :disabled="busy" @click="openStart">{{ busy ? 'Session running' : `Start at ${fmtSetting(program.uT)}…` }}</UButton>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* The wash behind the coil mark: where the field is. */
.stage { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(26rem 18rem at calc(100% - 7rem) 48%, var(--stage), transparent 70%); }
.readouts { display: flex; flex-wrap: wrap; margin: 0; gap: 0.75rem 0; }
.readouts > div { padding-right: 1.4rem; margin-right: 1.4rem; border-right: 1px solid var(--ui-border); }
.readouts > div:last-child { border-right: 0; margin-right: 0; padding-right: 0; }
.readouts dt { font-size: 0.78rem; color: var(--ui-text-muted); }
.readouts dd { margin: 0; color: var(--ui-text-muted); font-size: 0.85rem; white-space: nowrap; }
.readouts b { font-family: var(--font-display); font-stretch: 86%; font-size: 1.9rem; line-height: 1.05; font-weight: 620; color: var(--ui-text-highlighted); }

.subtabs { display: flex; gap: 0.15rem; overflow-x: auto; scrollbar-width: none; }
.subtabs a { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.65rem 0.8rem; border-bottom: 2px solid transparent; color: var(--ui-text-muted); font-weight: 600; white-space: nowrap; }
.subtabs a:hover { color: var(--ui-text-highlighted); }
.subtabs a[aria-current="page"] { color: var(--ui-text-highlighted); border-bottom-color: var(--ui-primary); }
.badge { font-size: 0.75rem; padding: 0 0.4rem; border-radius: 99px; background: var(--ui-bg-elevated); border: 1px solid var(--ui-border); color: var(--ui-text-muted); font-weight: 400; }

.slim { position: fixed; z-index: 30; left: 0; right: 0; top: var(--header-h, 3.75rem); background: var(--ui-bg); border-bottom: 1px solid var(--ui-border); transform: translateY(-110%); opacity: 0; transition: transform 0.2s, opacity 0.2s; pointer-events: none; }
.slim.on { transform: none; opacity: 1; pointer-events: auto; }

@media (max-width: 640px) {
  .readouts { display: grid; grid-template-columns: repeat(2, minmax(0, max-content)); }
  .readouts > div:nth-child(2n) { border-right: 0; }
  .readouts b { font-size: 1.5rem; }
  .subtabs a { padding: 0.65rem 0.55rem; }
}
</style>
