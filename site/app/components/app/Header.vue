<script setup lang="ts">
// The app's header: tabs, the running session, the connection, unit and theme.
import { useEventListener, useResizeObserver } from '@vueuse/core'
import { guideState } from '#core/lib/guideState.js'
import { call, device, restore, running, type DeviceInfo } from '~/lib/device'

const { tab, tabTarget } = useAppNav()
const route = useRoute()
const { theme, THEMES } = useTheme()

const isRunning = computed(() => running())
const { lost } = useHelmetLink()
// Arriving in the app from a public page: the helmet that was connected before the last reload, if it was not reached for there.
onMounted(() => restore())
const liveOpen = ref(false) // live panel under the header
const menuOpen = ref(false) // connection, unit and theme (phones)

// The live panel opens under the header on every tab but Programs (which shows it on the page).
function toggleLive() {
  if (tab.value === 'programs') return window.scrollTo({ top: 0, behavior: smooth() })
  liveOpen.value = !liveOpen.value
}
// What the helmet says about itself ("hello"), read again. Only that: reading
// the settings too would throw away unsaved edits on the Helmet tab.
const readInfo = () => device.link === 'connected' && call<DeviceInfo>('hello').then((info) => (device.info = info), () => {})
watch(isRunning, (r, was) => {
  if (!r) liveOpen.value = false
  // The helmet's "last session" time has moved: the Start panel's advice depends on it.
  if (was && !r) readInfo()
})
// On connecting, the environment (Kp, clock) is sent after the first read: read once more.
watch(() => device.connecting, (now, was) => was && !now && readInfo())
watch(() => route.fullPath, () => {
  liveOpen.value = false
  menuOpen.value = false
})
// Escape closes the live panel. A plain listener: it must not swallow the key,
// or open selects and dialogs would no longer close on it.
useEventListener('keydown', (e: KeyboardEvent) => e.key === 'Escape' && (liveOpen.value = false))

// Keep the open tab in view in the scrolling tab bar (phones), and fade the
// bar's right edge while there are tabs beyond it.
const tabsEl = ref<HTMLElement>()
const tabsEnd = ref(true)
function tabsScrolled() {
  const el = tabsEl.value
  if (el) tabsEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
}
async function showTab(behavior: ScrollBehavior) {
  await nextTick()
  const el = tabsEl.value
  const a = el?.querySelector<HTMLElement>('[aria-current="page"]')
  if (el && a) el.scrollTo({ left: a.offsetLeft - (el.clientWidth - a.offsetWidth) / 2, behavior })
  tabsScrolled()
}
watch(tab, () => showTab(smooth()))
onMounted(() => showTab('auto'))
useEventListener('resize', tabsScrolled)

// Its height, for bars that stick under it.
const headerEl = ref<HTMLElement>()
useResizeObserver(headerEl, () => document.documentElement.style.setProperty('--header-h', `${headerEl.value!.offsetHeight}px`))

const deviceLabel = computed(() => (device.kind === 'demo' ? 'Demo' : device.name))
</script>

<template>
  <header ref="headerEl" class="sticky top-0 z-40 border-b border-(--hairline) bg-(--page)/70 backdrop-blur-xl backdrop-saturate-150 pt-[env(safe-area-inset-top)]">
    <div class="app-container flex h-(--ui-header-height) items-center gap-3 lg:gap-5">
      <BrandWordmark :to="tabTarget('programs')" label="God Helmet: programs" compact />

      <nav ref="tabsEl" class="tabs flex min-w-0 flex-1 self-stretch overflow-x-auto" :class="{ more: !tabsEnd }" aria-label="Sections" @scroll.passive="tabsScrolled">
        <NuxtLink v-for="t in APP_TABS" :key="t.key" :to="tabTarget(t.key)" class="tab" :aria-current="tab === t.key ? 'page' : undefined">
          {{ t.label }}
          <span v-if="t.key === 'guides' && guideState.phase === 'running'" class="ml-1.5 inline-block size-1.5 rounded-full align-middle" :class="guideState.paused ? 'bg-warning' : 'bg-success'" role="img" :aria-label="guideState.paused ? 'guide paused' : 'guide running'" />
        </NuxtLink>
        <NuxtLink to="/docs" class="tab">Docs</NuxtLink>
      </nav>

      <div class="flex shrink-0 items-center gap-2">
        <AppSessionPill class="max-lg:hidden" :open="liveOpen" @toggle="toggleLive" />
        <AppConnect class="max-lg:hidden" status />
        <UnitToggle class="max-lg:hidden" />
        <ThemeMenu class="max-lg:hidden" />

        <UPopover v-model:open="menuOpen" :content="{ align: 'end' }">
          <UButton class="lg:hidden" size="sm" :color="device.kind ? 'neutral' : 'primary'" :variant="device.kind ? 'outline' : 'solid'" aria-haspopup="true">
            <span v-if="device.kind" class="size-2 rounded-full" :class="lost ? 'bg-warning' : 'bg-success'" aria-hidden="true" />
            {{ device.kind ? deviceLabel : device.connecting ? 'Connecting…' : 'Connect' }}<span v-if="lost" class="sr-only">, connection lost</span>
          </UButton>
          <template #content>
            <div class="grid w-72 max-w-[calc(100vw-2rem)] gap-4 p-4">
              <AppConnect stacked status @done="menuOpen = false" />
              <div class="grid gap-1.5 border-t border-default pt-3">
                <span class="text-sm text-muted">Field unit (1 µT = 10 mG)</span>
                <UnitToggle long />
              </div>
              <div class="grid gap-1.5 border-t border-default pt-3">
                <span class="text-sm text-muted">Theme</span>
                <UFieldGroup size="xs" role="group" aria-label="Theme">
                  <UButton v-for="t in THEMES" :key="t.value" :variant="theme === t.value ? 'soft' : 'outline'" :color="theme === t.value ? 'primary' : 'neutral'" :aria-pressed="theme === t.value" @click="theme = t.value">{{ t.label }}</UButton>
                </UFieldGroup>
              </div>
            </div>
          </template>
        </UPopover>
      </div>
    </div>

    <div v-if="isRunning" class="app-container flex pb-2 lg:hidden">
      <AppSessionPill class="w-full justify-between" :open="liveOpen" @toggle="toggleLive" />
    </div>

    <div v-if="liveOpen && isRunning && tab !== 'programs'" class="absolute inset-x-0 top-full max-h-[calc(100dvh-var(--header-h,4rem)-0.75rem)] overflow-auto border-b border-(--hairline) bg-(--page)/85 py-3 backdrop-blur-xl">
      <div class="app-container"><AppLivePanel :rate="false" /></div>
    </div>
  </header>
</template>

<style scoped>
.tabs { scrollbar-width: none; }
.tabs.more { mask-image: linear-gradient(to right, #000 calc(100% - 2rem), transparent); }
.tab {
  display: inline-flex; align-items: center; white-space: nowrap;
  padding: 0 0.7rem; font-weight: 600; font-size: 0.95rem;
  color: var(--ui-text-muted); border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tab:hover { color: var(--ui-text-highlighted); }
.tab[aria-current="page"] { color: var(--ui-text-highlighted); border-bottom-color: var(--ui-primary); }
</style>
