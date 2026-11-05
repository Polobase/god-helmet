<script setup>
// One program (#programs/<id>[/<sub>]): a header with Start and sub-tabs for
// the overview, the coil placement, the field on the brain and the sources.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { nav } from '../../lib/nav.js'
import { presetById, sourceEntries, CATEGORY_LABELS } from '../../lib/presets.js'
import { layoutInfo } from '../../lib/layouts.js'
import { fmtMinutes } from '../../lib/format.js'
import { sessionSites } from '../../lib/brain.js'
import { evidenceLabel, evidenceInfo, evidenceClass } from '../../lib/evidence.js'
import { program, groupOf, usedCoils, placedCount, subHref, stopPreview } from '../../lib/programState.js'
import { device } from '../../ble/device.js'
import LivePanel from '../LivePanel.vue'
import ProgramSwitcher from './ProgramSwitcher.vue'
import ProgramOverview from './ProgramOverview.vue'
import ProgramSources from './ProgramSources.vue'
import StartPanel from './StartPanel.vue'

const preset = computed(() => presetById(program.id))
const doc = computed(() => preset.value.doc)
const session = computed(() => preset.value.session)
const group = computed(() => groupOf(program.id))
const layout = computed(() => (session.value ? layoutInfo(session.value.layout) : null))
const coils = computed(() => (session.value ? sessionSites(session.value).filter(Boolean).length : 0))
const category = computed(() => CATEGORY_LABELS[doc.value.category] ?? doc.value.category ?? '')

const sub = computed(() => (nav.sub === 'sources' ? 'sources' : ''))
const subs = computed(() => [
  { key: '', label: 'Overview' },
  { key: 'placement', label: 'Placement', badge: group.value ? `${placedCount(group.value)}/${usedCoils(group.value).length}` : '' },
  { key: 'brain', label: 'Brain' },
  { key: 'sources', label: 'Sources', badge: String(sourceEntries(doc.value.source).length) },
])
const view = computed(() => (sub.value === 'sources' ? ProgramSources : ProgramOverview))
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
      <div class="meta">
        <span class="eyebrow">{{ category }}</span>
        <span v-if="doc.evidence" class="chip" :class="evidenceClass(doc.evidence)" :title="evidenceInfo(doc.evidence)">{{ evidenceLabel(doc.evidence) }}</span>
        <span v-if="session" class="facts small">
          <span class="num">{{ fmtMinutes(session.totalMs) }}</span> · {{ coils }} coil{{ coils === 1 ? '' : 's' }} ·
          <span :title="layout.title">{{ layout.key === 'custom' ? '10-10 sites' : `${layout.name} layout` }}</span>
        </span>
      </div>
      <div class="title-row">
        <h2>{{ doc.name }}</h2>
        <button v-if="session" type="button" class="btn primary start" :disabled="busy" :title="busy ? 'A session is running' : ''" @click="openStart">{{ busy ? 'Session running' : '▶ Start…' }}</button>
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
        <button type="button" class="btn primary sm" :disabled="busy" @click="openStart">▶ Start</button>
      </div>
    </div>

    <p v-if="!session" class="card bad small">Invalid program file: {{ preset.error }}</p>
    <component :is="view" v-else />

    <template v-if="session">
      <StartPanel />
      <div class="start-bar">
        <button type="button" class="btn primary" :disabled="busy" @click="openStart">{{ busy ? 'Session running' : `▶ Start · ${program.uT.toFixed(1)} µT` }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ws-head { gap: 8px; padding-bottom: 0; }
.top-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.back { color: var(--muted); text-decoration: none; font-weight: 600; font-size: 14px; }
.back:hover { color: var(--text); }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.meta .chip { font-size: 11.5px; }
.facts { color: var(--muted); }
.title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.title-row h2 { font-size: 28px; line-height: 1.15; }
.start { flex: none; padding-inline: 20px; }
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
@media (max-width: 640px) {
  .title-row h2 { font-size: 24px; }
  .title-row .start { display: none; }
  .slim-name, .slim .btn { display: none; }
  .start-bar { display: block; position: fixed; z-index: 9; left: 0; right: 0; bottom: 0; padding: 10px max(16px, env(safe-area-inset-left, 0px)) calc(10px + env(safe-area-inset-bottom, 0px)); background: color-mix(in srgb, var(--bg) 92%, transparent); border-top: 1px solid var(--line); backdrop-filter: blur(6px); }
  .start-bar .btn { width: 100%; }
  .subtabs a { padding: 10px 8px; }
}
@media (max-width: 400px) {
  .subtabs a:last-child .badge { display: none; }
}
</style>
