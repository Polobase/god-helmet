<script setup>
// One program (#programs/<id>[/<sub>]): a header with Start and sub-tabs for
// the overview, the coil placement, the field on the brain and the sources.
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { nav } from '../../lib/nav.js'
import { presetById, sourceEntries, CATEGORY_LABELS } from '../../lib/presets.js'
import { layoutInfo } from '../../lib/layouts.js'
import { fmtMinutes } from '../../lib/format.js'
import { sessionSites } from '../../lib/brain.js'
import { evidenceLabel, evidenceInfo, evidenceClass } from '../../lib/evidence.js'
import { program, preview, groupOf, usedCoils, placedCount, subHref, stopPreview } from '../../lib/programState.js'
import { device } from '../../ble/device.js'
import LivePanel from '../LivePanel.vue'
import CoilGlyph from '../CoilGlyph.vue'
import ProgramSwitcher from './ProgramSwitcher.vue'
import ProgramOverview from './ProgramOverview.vue'
import ProgramSources from './ProgramSources.vue'
import ProgramPlacement from './ProgramPlacement.vue'
import StartPanel from './StartPanel.vue'

const preset = computed(() => presetById(program.id))
const doc = computed(() => preset.value.doc)
const session = computed(() => preset.value.session)
const group = computed(() => groupOf(program.id))
const layout = computed(() => (session.value ? layoutInfo(session.value.layout) : null))
const coils = computed(() => (session.value ? sessionSites(session.value).filter(Boolean).length : 0))
const category = computed(() => CATEGORY_LABELS[doc.value.category] ?? doc.value.category ?? '')
const sites = computed(() => (session.value ? sessionSites(session.value) : []))
const minutes = computed(() => Math.round((session.value?.totalMs ?? 0) / 60000))
// The plate lights up with the preview, or with the helmet while it runs this program.
const running = computed(() => {
  const st = device.status
  return st && st.state !== 'idle' && !st.test && !st.blind && st.sessionId === program.id ? st.levels : null
})
const levels = computed(() => (preview.value ? preview.value.drives.map(Math.abs) : running.value))

// The Brain sub-tab loads three.js and the meshes on demand.
const ProgramBrain = defineAsyncComponent(() => import('./ProgramBrain.vue'))
const SUBS = { placement: ProgramPlacement, brain: ProgramBrain, sources: ProgramSources }
const sub = computed(() => (SUBS[nav.sub] ? nav.sub : ''))
const subs = computed(() => [
  { key: '', label: 'Overview' },
  { key: 'placement', label: 'Placement', badge: group.value ? `${placedCount(group.value)}/${usedCoils(group.value).length}` : '' },
  { key: 'brain', label: 'Brain' },
  { key: 'sources', label: 'Sources', badge: String(sourceEntries(doc.value.source).length) },
])
const view = computed(() => SUBS[sub.value] ?? ProgramOverview)
const openStart = () => (program.startOpen = true)
const busy = computed(() => !!device.status && device.status.state !== 'idle')

// A slim bar with the sub-tabs and Start once the header has scrolled away.
const tabsEl = ref(null)
const stuck = ref(false)
let io = null
onMounted(() => {
  if (!tabsEl.value) return
  const top = document.querySelector('header.top')?.offsetHeight ?? 0
  io = new IntersectionObserver(([e]) => (stuck.value = !e.isIntersecting && e.boundingClientRect.top < top + 1), { rootMargin: `-${top}px 0px 0px 0px` })
  io.observe(tabsEl.value)
})
onBeforeUnmount(() => {
  io?.disconnect()
  stopPreview()
})
</script>

<template>
  <div class="page ws">
    <LivePanel />

    <header class="card ws-head">
      <div class="top-row">
        <a class="back" href="#programs">‹ All programs</a>
        <ProgramSwitcher />
      </div>
      <div class="plate">
        <div class="ident">
          <p class="kind">
            <span>{{ category }}</span>
            <span v-if="doc.evidence" class="chip" :class="evidenceClass(doc.evidence)" :title="evidenceInfo(doc.evidence)">{{ evidenceLabel(doc.evidence) }}</span>
          </p>
          <h1 class="title">{{ doc.name }}</h1>
          <dl v-if="session" class="readouts">
            <div><dt>Length</dt><dd><b class="num">{{ minutes }}</b> min</dd></div>
            <div><dt>Coils</dt><dd><b class="num">{{ coils }}</b> of 8</dd></div>
            <div><dt>Phases</dt><dd><b class="num">{{ session.phases.length }}</b></dd></div>
            <div><dt>Field at 20 mm</dt><dd><b class="num">{{ program.uT.toFixed(1) }}</b> µT</dd></div>
          </dl>
          <div v-if="session" class="cta">
            <button type="button" class="btn primary start" :disabled="busy" :title="busy ? 'A session is running' : ''" @click="openStart">{{ busy ? 'Session running' : 'Start…' }}</button>
          </div>
        </div>
        <figure v-if="session" class="mark">
          <CoilGlyph :sites="sites" :levels="levels" rings :label="`${coils} coils seen from above`" />
          <figcaption :title="layout.title">{{ layout.key === 'custom' ? 'Own 10-10 sites' : `${layout.name} layout` }}</figcaption>
        </figure>
      </div>
      <nav v-if="session" ref="tabsEl" class="subtabs" aria-label="Program sections">
        <a v-for="t in subs" :key="t.key" :href="subHref(t.key)" :class="{ on: sub === t.key }" :aria-current="sub === t.key ? 'page' : null">{{ t.label }}<span v-if="t.badge" class="badge num">{{ t.badge }}</span></a>
      </nav>
    </header>

    <div v-if="session" class="slim" :class="{ on: stuck }" :inert="!stuck" :aria-hidden="!stuck">
      <div class="slim-inner">
        <b class="slim-name">{{ doc.name }}</b>
        <nav class="subtabs" aria-label="Program sections">
          <a v-for="t in subs" :key="t.key" :href="subHref(t.key)" :class="{ on: sub === t.key }" :aria-current="sub === t.key ? 'page' : null">{{ t.label }}<span v-if="t.badge" class="badge num">{{ t.badge }}</span></a>
        </nav>
        <button type="button" class="btn primary sm" :disabled="busy" @click="openStart">Start…</button>
      </div>
    </div>

    <p v-if="!session" class="card bad small">Invalid program file: {{ preset.error }}</p>
    <component :is="view" v-else />

    <template v-if="session">
      <StartPanel />
      <div class="start-bar">
        <button type="button" class="btn primary" :disabled="busy" @click="openStart">{{ busy ? 'Session running' : `Start at ${program.uT.toFixed(1)} µT…` }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ws-head { gap: 6px; padding-bottom: 0; overflow: hidden; position: relative;
  background: radial-gradient(380px 260px at calc(100% - 120px) 46%, color-mix(in srgb, var(--accent) 11%, transparent), transparent 70%), var(--surface); }
.top-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.back { color: var(--muted); text-decoration: none; font-weight: 600; font-size: 14px; }
.back:hover { color: var(--text); }
.plate { display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: 24px; align-items: center; padding: 6px 0 4px; }
.ident { display: grid; gap: 12px; min-width: 0; }
.kind { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--muted); font-weight: 600; font-size: 13.5px; }
.kind .chip { font-size: 11.5px; }
.title { font: 700 40px/1.04 var(--font-display); letter-spacing: .005em; max-width: 22ch; }
.readouts { display: flex; flex-wrap: wrap; margin: 0; }
.readouts > div { padding: 2px 18px 2px 0; margin-right: 18px; border-right: 1px solid var(--line); }
.readouts > div:last-child { border-right: 0; margin-right: 0; }
.readouts dt { font-size: 12px; color: var(--muted); }
.readouts dd { margin: 0; color: var(--muted); font-size: 13px; white-space: nowrap; }
.readouts b { font-size: 26px; line-height: 1.1; color: var(--text); font-weight: 600; }
.cta { display: flex; gap: 10px; align-items: center; }
.start { padding: 12px 28px; font-size: 16px; border-radius: 11px; }
.mark { margin: 0; display: grid; gap: 4px; justify-items: center; }
.mark figcaption { font-size: 12px; color: var(--muted); text-align: center; }
.subtabs { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; margin-top: 4px; }
.subtabs a { display: inline-flex; align-items: center; gap: 6px; padding: 10px 12px; border-bottom: 2px solid transparent; color: var(--muted); font-weight: 600; text-decoration: none; white-space: nowrap; }
.subtabs a:hover { color: var(--text); }
.subtabs a.on { color: var(--text); border-bottom-color: var(--accent); }
.badge { font-size: 12px; padding: 0 6px; border-radius: 99px; background: var(--surface-2); border: 1px solid var(--line); color: var(--muted); }

.slim { position: fixed; z-index: 9; left: 0; right: 0; top: var(--header-h, 0px); background: var(--bg); border-bottom: 1px solid var(--line); transform: translateY(-110%); opacity: 0; transition: transform .2s, opacity .2s; pointer-events: none; }
.slim.on { transform: none; opacity: 1; pointer-events: auto; }
.slim-inner { max-width: 1100px; margin: 0 auto; padding: 0 max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px)); display: flex; align-items: center; gap: 12px; }
.slim-name { font: 600 16px var(--font-display); letter-spacing: .02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 0 1 260px; }
.slim .subtabs { margin: 0; flex: 1 1 auto; }
.slim .subtabs a { padding: 9px 10px; }

.start-bar { display: none; }
@media (max-width: 760px) {
  .plate { grid-template-columns: minmax(0, 1fr) 96px; gap: 14px; align-items: start; }
  .title { font-size: 30px; }
  .readouts { display: grid; grid-template-columns: repeat(2, minmax(0, max-content)); gap: 8px 0; grid-column: 1 / -1; }
  .readouts > div:nth-child(2n) { border-right: 0; }
  .readouts b { font-size: 22px; }
  .mark figcaption { display: none; }
}
@media (max-width: 640px) {
  .cta { display: none; }
  .slim-name, .slim .btn { display: none; }
  .start-bar { display: block; position: fixed; z-index: 30; left: 0; right: 0; bottom: 0; padding: 10px max(16px, env(safe-area-inset-left, 0px)) calc(10px + env(safe-area-inset-bottom, 0px)); background: color-mix(in srgb, var(--bg) 92%, transparent); border-top: 1px solid var(--line); backdrop-filter: blur(6px); }
  .start-bar .btn { width: 100%; }
  .subtabs a { padding: 10px 8px; }
}
@media (max-width: 400px) {
  .subtabs a:last-child .badge { display: none; }
}
</style>
