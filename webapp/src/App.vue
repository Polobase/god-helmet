<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { device, connect, disconnect, reconnect, linkNote } from './ble/device.js'
import { nav, TABS, openTab, tabOf } from './lib/nav.js'
import { guideState } from './lib/guideState.js'
import ProgramsView from './views/ProgramsView.vue'
import TrialsView from './views/TrialsView.vue'
import LogView from './views/LogView.vue'
import HelmetView from './views/HelmetView.vue'
import SafetyView from './views/SafetyView.vue'
import DocsView from './views/DocsView.vue'
import SessionPill from './components/SessionPill.vue'
import LivePanel from './components/LivePanel.vue'
import { units, setFieldUnit, UNIT_LABEL, UNIT_NAME } from './lib/units.js'

// Guides load on demand (audio engine + content).
const GuidesView = defineAsyncComponent(() => import('./views/GuidesView.vue'))
const views = { programs: ProgramsView, guides: GuidesView, trials: TrialsView, log: LogView, helmet: HelmetView, safety: SafetyView, docs: DocsView }
const view = computed(() => views[nav.tab])
const running = computed(() => !!device.status && device.status.state !== 'idle')
// The link dropped: the helmet and its session stay on screen while the app reconnects (ble/device.js).
const lost = computed(() => !!device.kind && device.link !== 'connected')
const linkLine = computed(() => linkNote())

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
const deviceLabel = computed(() => (device.kind === 'demo' ? 'Demo' : device.name))

const liveOpen = ref(false) // live panel under the header
const menuOpen = ref(false) // connection and theme menu (phones)

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
  liveOpen.value = false
  menuOpen.value = false
  await nextTick()
  const el = tabsEl.value
  const a = el?.querySelector('.active')
  if (el && a) el.scrollTo({ left: a.offsetLeft - (el.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' })
  tabsScrolled()
}, { immediate: true })
window.addEventListener('resize', tabsScrolled)

// The live panel opens under the header on every tab but Programs (which shows it on the page).
function toggleLive() {
  if (nav.tab === 'programs') return window.scrollTo({ top: 0, behavior: 'smooth' })
  liveOpen.value = !liveOpen.value
}
watch(running, (r) => !r && (liveOpen.value = false))

// Connection and theme menu (phones).
const menuEl = ref(null)
const outside = (e) => menuOpen.value && menuEl.value && !menuEl.value.contains(e.target) && (menuOpen.value = false)
const onKey = (e) => e.key === 'Escape' && ((menuOpen.value = false), (liveOpen.value = false))
document.addEventListener('pointerdown', outside)
document.addEventListener('keydown', onKey)
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', onKey)
})
const connectFrom = (kind) => ((menuOpen.value = false), connect(kind))
const disconnectFrom = () => ((menuOpen.value = false), disconnect())

// Its height, for bars that stick under it (--header-h).
const headerEl = ref(null)
onMounted(() => {
  const set = () => document.documentElement.style.setProperty('--header-h', `${headerEl.value.offsetHeight}px`)
  new ResizeObserver(set).observe(headerEl.value)
  set()
})
</script>

<template>
  <header ref="headerEl" class="top">
    <div class="bar-inner head-row">
      <a class="brand" href="#programs" aria-label="God Helmet: programs" @click.prevent="openTab('programs')">
        <svg viewBox="0 0 32 32" class="logo" aria-hidden="true"><circle cx="16" cy="17" r="11" fill="none" stroke="currentColor" stroke-width="2" /><circle v-for="a in 8" :key="a" :cx="16 + 11 * Math.cos((a * Math.PI) / 4)" :cy="17 + 11 * Math.sin((a * Math.PI) / 4)" r="2.6" class="dot" /></svg>
        <span class="brand-name">God Helmet</span>
      </a>
      <nav ref="tabsEl" class="tabs" :class="{ more: !tabsEnd }" aria-label="Sections" @scroll.passive="tabsScrolled">
        <button v-for="t in TABS" :key="t.key" type="button" :class="{ active: tabOf(nav.tab) === t.key }" :aria-current="tabOf(nav.tab) === t.key ? 'page' : null" @click="openTab(t.key)">
          {{ t.label }}<span v-if="t.key === 'guides' && guideState.phase === 'running'" class="live-dot" :class="{ paused: guideState.paused }" role="img" :aria-label="guideState.paused ? 'guide paused' : 'guide running'"></span>
        </button>
      </nav>
      <div class="actions">
        <SessionPill class="wide-only" :open="liveOpen" @toggle="toggleLive" />
        <div class="wide-only conn">
          <template v-if="device.kind">
            <span class="chip conn-chip"><span class="conn-dot" aria-hidden="true"></span>{{ deviceLabel }}</span>
            <button v-if="lost" type="button" class="btn sm" :disabled="device.link === 'reconnecting'" @click="reconnect">Reconnect</button>
            <button v-if="!running || lost" type="button" class="btn ghost sm" @click="disconnect">Disconnect</button>
          </template>
          <template v-else>
            <button type="button" class="btn primary sm" :disabled="!device.bluetooth || device.connecting" title="Connect over Bluetooth" @click="connect('ble')">{{ device.connecting ? 'Connecting…' : 'Bluetooth' }}</button>
            <button v-if="device.serial" type="button" class="btn sm" :disabled="device.connecting" title="Connect over a USB cable (Chrome or Edge on a computer)" @click="connect('usb')">USB</button>
            <button type="button" class="btn ghost sm" @click="connect('demo')">Demo</button>
          </template>
          <div class="seg unit-seg" role="group" aria-label="Field unit" title="Show fields in tesla (µT) or gauss (mG): 1 µT = 10 mG">
            <button v-for="u in ['T', 'G']" :key="u" type="button" :class="{ on: units.field === u }" :aria-pressed="units.field === u" :aria-label="`${UNIT_LABEL[u]} (${UNIT_NAME[u]})`" @click="setFieldUnit(u)">{{ UNIT_LABEL[u] }}</button>
          </div>
          <button type="button" class="btn ghost sm" :title="`Theme: ${theme} (click to change)`" :aria-label="`Theme: ${theme}. Change theme`" @click="nextTheme">{{ THEME_LABEL[theme] }}</button>
        </div>
        <div ref="menuEl" class="narrow-only menu-wrap">
          <button type="button" class="btn sm menu-btn" :class="{ primary: !device.kind }" :aria-expanded="menuOpen" aria-haspopup="true" @click="menuOpen = !menuOpen">
            <span v-if="device.kind" class="conn-dot" aria-hidden="true"></span>{{ device.kind ? deviceLabel : device.connecting ? 'Connecting…' : 'Connect' }}
          </button>
          <div v-if="menuOpen" class="menu" role="menu">
            <template v-if="device.kind">
              <p class="small muted">{{ lost ? 'Connection lost.' : device.kind === 'demo' ? 'Demo: no helmet, nothing is switched on.' : `Connected to ${device.name} over ${device.kind === 'usb' ? 'USB' : 'Bluetooth'}.` }}</p>
              <button v-if="lost" type="button" class="btn sm" role="menuitem" :disabled="device.link === 'reconnecting'" @click="reconnect">Reconnect</button>
              <button v-if="!running || lost" type="button" class="btn sm" role="menuitem" @click="disconnectFrom">Disconnect</button>
            </template>
            <template v-else>
              <button type="button" class="btn primary sm" role="menuitem" :disabled="!device.bluetooth || device.connecting" @click="connectFrom('ble')">Bluetooth</button>
              <button v-if="device.serial" type="button" class="btn sm" role="menuitem" :disabled="device.connecting" @click="connectFrom('usb')">USB cable</button>
              <button type="button" class="btn ghost sm" role="menuitem" @click="connectFrom('demo')">Demo (no helmet)</button>
            </template>
            <div class="theme-pick">
              <span class="small muted">Field unit (1 µT = 10 mG)</span>
              <div class="seg" role="group" aria-label="Field unit">
                <button v-for="u in ['T', 'G']" :key="u" type="button" :class="{ on: units.field === u }" :aria-pressed="units.field === u" @click="setFieldUnit(u)">{{ UNIT_LABEL[u] }} ({{ UNIT_NAME[u] }})</button>
              </div>
            </div>
            <div class="theme-pick">
              <span class="small muted">Theme</span>
              <div class="seg" role="group" aria-label="Theme">
                <button v-for="t in THEMES" :key="t" type="button" :class="{ on: theme === t }" :aria-pressed="theme === t" @click="theme = t">{{ THEME_LABEL[t].split(' ')[1] }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="running" class="narrow-only bar-inner pill-row">
      <SessionPill :open="liveOpen" @toggle="toggleLive" />
    </div>
    <div v-if="liveOpen && running && nav.tab !== 'programs'" class="live-drop">
      <div class="bar-inner"><LivePanel :rate="false" /></div>
    </div>
  </header>

  <div v-if="device.error || linkLine || device.kind === 'usb' || (!device.bluetooth && !device.serial) || (device.kind && device.info && !device.info.safetyAccepted && !['safety', 'helmet'].includes(nav.tab))" class="notices">
    <p v-if="device.error" class="notice bad">{{ device.error }}</p>
    <p v-if="linkLine" class="notice" :class="{ warn: linkLine.tone === 'warning' }">{{ linkLine.text }}</p>
    <p v-if="!device.bluetooth && !device.serial" class="notice">This browser can't reach the helmet: no Web Bluetooth and no USB (Web Serial). Use Chrome or Edge on a computer (Bluetooth or USB) or on Android (Bluetooth), or the free Bluefy browser on iPhone. The demo works everywhere.</p>
    <p v-if="device.kind === 'usb'" class="notice warn">Connected over USB: the cable joins the helmet to this computer. Wear the helmet only with a laptop on battery, charger unplugged, never with a desktop computer. Connect before putting it on.</p>
    <p v-if="device.kind && device.info && !device.info.safetyAccepted && !['safety', 'helmet'].includes(nav.tab)" class="notice warn">Read and accept the <a href="#safety">safety page</a> before the first session.</p>
  </div>

  <main>
    <component :is="view" :key="nav.tab" />
  </main>
</template>

<style scoped>
.top { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 10; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); }
.bar-inner { max-width: 1100px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.head-row { display: flex; align-items: center; gap: 18px; min-height: 58px; }
.brand { display: flex; align-items: center; gap: 8px; font: 700 20px var(--font-display); letter-spacing: .02em; color: var(--text); text-decoration: none; flex: none; }
.brand:hover { color: var(--text); }
.logo { width: 26px; height: 26px; color: var(--muted); }
.logo .dot { fill: var(--accent); }
.tabs { position: relative; display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; flex: 1 1 auto; min-width: 0; align-self: stretch; }
.tabs.more { -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent); }
.tabs button { background: none; border: 0; border-bottom: 2px solid transparent; color: var(--muted); padding: 0 11px; font-weight: 600; font-size: 15px; cursor: pointer; white-space: nowrap; }
.tabs button:hover { color: var(--text); }
.tabs button.active { color: var(--text); border-bottom-color: var(--accent); }
.live-dot { display: inline-block; width: 7px; height: 7px; margin-left: 6px; border-radius: 50%; background: var(--ok); vertical-align: middle; box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 25%, transparent); }
.live-dot.paused { background: var(--warn); box-shadow: none; }
.actions { display: flex; gap: 8px; align-items: center; flex: none; min-width: 0; }
.conn { display: flex; gap: 6px; align-items: center; }
.conn-chip { color: var(--text); border-color: color-mix(in srgb, var(--ok) 50%, var(--line)); }
.conn-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--ok); }
.menu-wrap { position: relative; }
.menu-btn .conn-dot { margin-right: 2px; }
.menu { position: absolute; right: 0; top: calc(100% + 8px); z-index: 30; width: min(280px, calc(100vw - 32px)); display: grid; gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); box-shadow: 0 18px 40px rgb(0 0 0 / .35); }
.theme-pick { display: grid; gap: 4px; border-top: 1px solid var(--line); padding-top: 8px; }
.unit-seg { align-self: center; padding: 2px; }
.unit-seg button { min-height: 26px; padding: 3px 9px; font-size: 12.5px; }
.pill-row { padding-block: 0 8px; display: flex; }
.pill-row .pill { width: 100%; justify-content: space-between; }
.live-drop { position: absolute; left: 0; right: 0; top: 100%; max-height: calc(100dvh - var(--header-h, 60px) - 12px); overflow: auto; padding-block: 10px; background: color-mix(in srgb, var(--bg) 70%, transparent); backdrop-filter: blur(6px); border-bottom: 1px solid var(--line); }
.notices { max-width: 1100px; margin: 12px auto 0; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 8px; }
.notice { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px 12px; font-size: 14px; }
.narrow-only { display: none; }
@media (max-width: 900px) {
  .wide-only { display: none; }
  .narrow-only { display: block; }
  .pill-row.narrow-only { display: flex; }
  .head-row { gap: 10px; min-height: 52px; }
  .brand-name { display: none; }
  .tabs button { padding: 0 9px; font-size: 14.5px; }
}
</style>
