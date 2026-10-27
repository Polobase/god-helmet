<script setup>
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { device, connect, disconnect, call } from './ble/device.js'
import { nav, TABS, go } from './lib/nav.js'
import { guideState } from './lib/guideState.js'
import ProgramsView from './views/ProgramsView.vue'
import PlacementView from './views/PlacementView.vue'
import ExperimentView from './views/ExperimentView.vue'
import TargetsView from './views/TargetsView.vue'
import LogView from './views/LogView.vue'
import SetupView from './views/SetupView.vue'
import SafetyView from './views/SafetyView.vue'
import DocsView from './views/DocsView.vue'

// Guides load on demand (audio engine + content).
const GuidesView = defineAsyncComponent(() => import('./views/GuidesView.vue'))
// The brain view loads three.js and the meshes on demand.
const BrainView = defineAsyncComponent(() => import('./views/BrainView.vue'))
const views = { programs: ProgramsView, placement: PlacementView, brain: BrainView, guides: GuidesView, experiment: ExperimentView, targets: TargetsView, log: LogView, setup: SetupView, safety: SafetyView, docs: DocsView }
const view = computed(() => views[nav.tab])
const running = computed(() => device.status && device.status.state !== 'idle')

// Theme: auto (system), dark, light, night (red).
const THEMES = ['auto', 'dark', 'light', 'night']
const theme = ref((() => { try { return localStorage.getItem('theme') || 'auto' } catch { return 'auto' } })())
watch(theme, (t) => {
  if (t === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
  try { localStorage.setItem('theme', t) } catch { /* ignore */ }
}, { immediate: true })
const nextTheme = () => (theme.value = THEMES[(THEMES.indexOf(theme.value) + 1) % THEMES.length])
const THEME_LABEL = { auto: '◐ Auto', dark: '☾ Dark', light: '☀ Light', night: '● Night' }

// Keep the active tab visible in the scrolling tab bar (phones).
const tabsEl = ref(null)
const tabsEnd = ref(true)
function tabsScrolled() {
  const el = tabsEl.value
  if (el) tabsEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
}
watch(() => nav.tab, async (tab, prev) => {
  // A new tab starts at the top; a view's onMounted may still scroll to its target.
  if (prev) window.scrollTo({ top: 0 })
  await nextTick()
  const el = tabsEl.value
  const a = el?.querySelector('.active')
  if (el && a) el.scrollTo({ left: a.offsetLeft - (el.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' })
  tabsScrolled()
}, { immediate: true })
window.addEventListener('resize', tabsScrolled)
</script>

<template>
  <header class="top">
    <div class="bar-inner">
      <div class="brand">
        <svg viewBox="0 0 32 32" class="logo" aria-hidden="true"><circle cx="16" cy="17" r="11" fill="none" stroke="currentColor" stroke-width="2" /><circle v-for="a in 8" :key="a" :cx="16 + 11 * Math.cos((a * Math.PI) / 4)" :cy="17 + 11 * Math.sin((a * Math.PI) / 4)" r="2.6" class="dot" /></svg>
        <span>God Helmet</span>
      </div>
      <div class="actions">
        <button v-if="running" class="btn danger sm" @click="call('session.stop')">Stop</button>
        <template v-if="device.kind">
          <span class="chip on">{{ device.kind === 'demo' ? 'Demo' : device.name }}</span>
          <button v-if="!running" class="btn ghost sm" @click="disconnect">Disconnect</button>
        </template>
        <template v-else>
          <button class="btn primary sm" :disabled="!device.bluetooth || device.connecting" @click="connect('ble')">{{ device.connecting ? 'Connecting…' : 'Connect' }}</button>
          <button class="btn ghost sm" @click="connect('demo')">Demo</button>
        </template>
        <button class="btn ghost sm" :title="`Theme: ${theme} (click to change)`" :aria-label="`Theme: ${theme}. Change theme`" @click="nextTheme">{{ THEME_LABEL[theme] }}</button>
      </div>
    </div>
    <nav ref="tabsEl" class="tabs bar-inner" :class="{ more: !tabsEnd }" aria-label="Sections" @scroll.passive="tabsScrolled">
      <button v-for="t in TABS" :key="t.key" :class="{ active: nav.tab === t.key }" :aria-current="nav.tab === t.key ? 'page' : null" @click="go(t.key)">
        {{ t.label }}<span v-if="t.key === 'guides' && guideState.phase === 'running'" class="live-dot" :class="{ paused: guideState.paused }" role="img" :aria-label="guideState.paused ? 'guide paused' : 'guide running'"></span>
      </button>
    </nav>
  </header>

  <div v-if="device.error || !device.bluetooth || (device.kind && device.info && !device.info.safetyAccepted && nav.tab !== 'safety')" class="notices">
    <p v-if="device.error" class="notice bad">{{ device.error }}</p>
    <p v-if="!device.bluetooth" class="notice">This browser has no Web Bluetooth. Use Chrome or Edge on Android, Mac or Windows, or the free Bluefy browser on iPhone. The demo works everywhere.</p>
    <p v-if="device.kind && device.info && !device.info.safetyAccepted && nav.tab !== 'safety'" class="notice warn">Read and accept the <a href="#safety">safety page</a> before the first session.</p>
  </div>

  <main>
    <component :is="view" :key="nav.tab" />
  </main>
</template>

<style scoped>
.top { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); border-bottom: 1px solid var(--line); }
.bar-inner { max-width: 1100px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.top > .bar-inner:first-child { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding-block: 10px; flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 8px; font: 700 20px var(--font-display); letter-spacing: .03em; }
.logo { width: 26px; height: 26px; color: var(--muted); }
.logo .dot { fill: var(--accent); }
.actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.tabs { position: relative; display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
.tabs.more { -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent); }
.live-dot { display: inline-block; width: 7px; height: 7px; margin-left: 6px; border-radius: 50%; background: var(--ok); vertical-align: middle; box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 25%, transparent); }
.live-dot.paused { background: var(--warn); box-shadow: none; }
.tabs button { background: none; border: 0; border-bottom: 2px solid transparent; color: var(--muted); padding: 8px 10px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.tabs button.active { color: var(--text); border-bottom-color: var(--accent); }
.notices { max-width: 1100px; margin: 12px auto 0; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 8px; }
.notice { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; font-size: 14px; }
</style>
