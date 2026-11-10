<script setup lang="ts">
// One screen of the walkthrough: a small picture of what the app shows at
// that step, drawn with the app's own parts. A picture only: the words next
// to it say the same, so it is hidden from screen readers and cannot be used.
import classic from '../../../../presets/god-helmet-classic.json'
import { parseSession } from '#core/engine/session.js'
import { sessionSites, type Session } from '~/lib/model'

const props = defineProps<{ step: number, active?: boolean }>()
const session = parseSession(classic) as Session
const sites = sessionSites(session)
const placed = sites.map((s, i) => !!s && i < 5)
const checklist = sites.map((s, i) => ({ ch: i + 1, site: s, done: placed[i] })).filter((c) => c.site).slice(0, 5)
const READY = ['Helmet connected', 'Safety page accepted', 'Head measured', 'Coils placed: 8 of 8', 'Calibrated']

// Step 3: a session that counts down while you look at it.
const root = ref<HTMLElement>()
const left = ref(3597)
const done = ref(0.004)
useFrameLoop(root, (_t, dt) => {
  if (props.step !== 3 || !props.active) return
  left.value = left.value > 3540 ? left.value - dt / 1000 : 3597
  done.value = 1 - left.value / 3600 + 0.004
})
const clock = computed(() => `${Math.floor(left.value / 60)}:${String(Math.floor(left.value % 60)).padStart(2, '0')}`)
</script>

<template>
  <div ref="root" class="screen" aria-hidden="true" inert>
    <template v-if="step === 0">
      <div class="grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <SiteMap :sites="sites" view="left" :checked="placed" :caption="false" />
        <ul class="grid gap-2.5 text-sm">
          <li v-for="c in checklist" :key="c.ch" class="flex items-center gap-2.5">
            <UIcon :name="c.done ? 'i-lucide-circle-check-big' : 'i-lucide-circle'" class="size-4.5" :class="c.done ? 'text-success' : 'text-dimmed'" />
            <span class="text-highlighted">Coil {{ c.ch }}</span><span class="num text-muted">{{ c.site }}</span>
          </li>
        </ul>
      </div>
    </template>

    <template v-else-if="step === 1">
      <p class="flex items-center gap-2 text-sm text-muted">God Helmet <EvidenceBadge level="single-lab" /></p>
      <p class="mt-3 font-display text-3xl font-[640] leading-tight text-highlighted">{{ classic.name }}</p>
      <dl class="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-sm text-muted">
        <div><dd class="font-display text-2xl font-[640] text-highlighted num">60</dd><dt>minutes</dt></div>
        <div><dd class="font-display text-2xl font-[640] text-highlighted num">8</dd><dt>coils</dt></div>
        <div><dd class="font-display text-2xl font-[640] text-highlighted num">2</dd><dt>phases</dt></div>
        <div><dd class="font-display text-2xl font-[640] text-highlighted num">1.0</dd><dt>µT at 20 mm</dt></div>
      </dl>
      <div class="mt-6"><PhaseTimeline :phases="session.phases" :selected="0" /></div>
      <p class="mt-3 text-sm text-muted">{{ session.phases[0]!.name }}</p>
    </template>

    <template v-else-if="step === 2">
      <ul class="grid gap-2.5 text-sm">
        <li v-for="r in READY" :key="r" class="flex items-center gap-2.5 text-toned"><UIcon name="i-lucide-check" class="size-4.5 text-success" />{{ r }}</li>
      </ul>
      <div class="mt-5 flex items-center justify-between gap-4 rounded-xl border border-(--hairline) px-4 py-3">
        <div>
          <p class="font-semibold text-highlighted">Blind</p>
          <p class="text-sm text-muted">The helmet picks real or sham at random.</p>
        </div>
        <span class="toggle"><i /></span>
      </div>
      <div class="mt-5"><span class="go">Start</span></div>
    </template>

    <template v-else-if="step === 3">
      <p class="text-sm text-muted">Session running, blind</p>
      <p class="mt-1 font-display text-2xl font-[640] text-highlighted">{{ classic.name }}</p>
      <p class="num mt-5 font-display text-7xl font-[660] leading-none tracking-tight text-highlighted">{{ clock }}</p>
      <div class="bar mt-7"><i :style="{ width: `${done * 100}%` }" /></div>
      <p class="mt-4 text-sm text-muted">Coil activity is hidden. The log reveals real or sham after you rate it.</p>
    </template>

    <template v-else>
      <p class="font-display text-2xl font-[640] text-highlighted">How was it?</p>
      <div class="mt-5 flex items-baseline justify-between text-sm text-muted"><span>0 = nothing … 10 = profound</span><b class="num font-display text-2xl text-highlighted">6</b></div>
      <div class="bar knob mt-2"><i style="width: 60%" /><em style="left: 60%" /></div>
      <p class="mt-6 flex items-center gap-2.5 rounded-xl border border-(--hairline) px-4 py-3 text-highlighted">
        <UIcon name="i-lucide-circle-dashed" class="size-5 shrink-0 text-primary" />
        This blind session was <b class="text-primary">sham</b>.
      </p>
      <p class="mt-3 text-sm text-muted">The rating, your notes and the condition go into the log, with the day’s geomagnetic index.</p>
    </template>
  </div>
</template>

<style scoped>
.screen { min-height: 21rem; display: flex; flex-direction: column; justify-content: center; }
.toggle { flex: none; width: 2.6rem; height: 1.5rem; border-radius: 99px; background: var(--ui-primary); position: relative; box-shadow: 0 0 18px var(--glow); }
.toggle i { position: absolute; top: 0.2rem; right: 0.2rem; width: 1.1rem; height: 1.1rem; border-radius: 50%; background: var(--ui-bg); }
.go { display: inline-flex; justify-content: center; min-width: 9rem; padding: 0.7rem 1.4rem; border-radius: 0.75rem; font-weight: 600; color: var(--ui-text-inverted); background: var(--ui-primary); box-shadow: 0 10px 28px -10px var(--glow); }
.bar { position: relative; height: 0.4rem; border-radius: 99px; background: var(--ui-border); }
.bar i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--ui-primary); }
.bar em { position: absolute; top: 50%; width: 1.1rem; height: 1.1rem; margin: -0.55rem 0 0 -0.55rem; border-radius: 50%; background: var(--ui-bg); border: 2px solid var(--ui-primary); }
</style>
