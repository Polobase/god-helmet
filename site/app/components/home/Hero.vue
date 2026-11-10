<script setup lang="ts">
// The hero: one real program playing, run by the same engine as the helmet,
// slowed down so the millisecond steps between coils can be seen. Its field
// is drawn behind the page (FieldStage). One program file is loaded here,
// not the whole library.
import classic from '../../../../presets/god-helmet-classic.json'
import { parseSession, SessionRunner, render } from '#core/engine/session.js'
import { coilsUsed } from '#core/engine/spatial.js'
import { describePattern, describeSpatial } from '#core/lib/format.js'
import { sessionSites, type Session } from '~/lib/model'

const SLOWER = 10
const session = parseSession(classic) as Session
const sites = sessionSites(session)

const phase = ref(1)
const levels = shallowRef<number[] | null>(null)
const playing = ref(false)
// Paused by the visitor (not merely off screen): the field picture holds still too.
const held = ref(false)
const current = computed(() => session.phases[phase.value]!)
const used = computed(() => coilsUsed(current.value.spatial, session.geometry) as number[])
const direction = computed(() => (current.value.spatial.mode === 'rotate' ? (current.value.spatial.ccw ? 'ccw' : 'cw') : undefined))

let raf = 0
function stop() {
  cancelAnimationFrame(raf)
  raf = 0
  playing.value = false
  levels.value = null
}
function play(from = phase.value) {
  stop()
  phase.value = from
  const runner = new SessionRunner()
  runner.start(session)
  runner.advance(runner.phaseStart(from) + session.fadeInMs + 2000)
  playing.value = true
  let last = performance.now()
  const step = (t: number) => {
    const f = runner.advance(Math.min(100, t - last) / SLOWER)
    last = t
    if (!f.running) return stop()
    // The preview stays on the chosen phase: a phase lasts half an hour.
    if (f.phase !== from) return play(from)
    levels.value = (render(session, f) as number[]).map(Math.abs)
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}
const pick = (i: number) => (held.value ? (phase.value = i) : play(i))

const root = ref<HTMLElement>()
onMounted(() => {
  // Plays by itself only while it is on screen, and never for people who asked for less motion.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? !playing.value && !held.value && play() : stop()), { threshold: 0.2 })
  io.observe(root.value!)
  onBeforeUnmount(() => io.disconnect())
})
onBeforeUnmount(stop)
</script>

<template>
  <section ref="root" class="hero">
    <HomeFieldStage :sites="sites" :levels="levels" :used="used" :direction="direction" :paused="held" />
    <div class="veil" aria-hidden="true" />

    <UContainer class="relative flex min-h-[inherit] flex-col justify-center pb-[31rem] pt-16 lg:pb-36 lg:pt-20">
      <div class="max-w-[44rem]">
        <p class="kicker"><span class="live-dot" aria-hidden="true" />Open hardware, open evidence</p>
        <h1 class="headline">
          <span class="line" style="--i: 0"><span>A God Helmet</span></span>
          <span class="line" style="--i: 1"><span>you can build,</span></span>
          <span class="line" style="--i: 2"><span>and test blind.</span></span>
        </h1>
        <p class="lede">
          Eight weak-field coils on a headband, an ESP32, and this app. It plays the signals Persinger’s laboratory and its imitators used,
          and gives you sham sessions you cannot tell apart from real ones, so you can find out whether the field does anything to you.
        </p>
        <div class="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
          <UButton to="/app/programs" color="primary" variant="solid" size="xl" trailing-icon="i-lucide-arrow-right" class="px-6">Try it in the demo</UButton>
          <UButton to="/docs/overview" size="xl" variant="ghost" class="px-5">How to build one</UButton>
        </div>
        <p class="mt-4 text-sm text-muted">The demo runs the helmet’s engine in your browser. No hardware, nothing to install.</p>
      </div>
    </UContainer>

    <!-- What the picture is: said in words, with the controls. -->
    <div class="absolute inset-x-0 bottom-0">
      <UContainer class="pb-6">
        <div class="now glass">
          <p class="min-w-0 text-sm text-toned">
            <span class="text-muted">{{ held ? 'Paused' : `Playing, ${SLOWER}× slower` }}: </span>
            <NuxtLink to="/app/programs/god-helmet-classic" class="font-semibold text-highlighted underline decoration-(--ui-border-accented) underline-offset-4 hover:decoration-primary">{{ classic.name }}</NuxtLink><span class="max-sm:hidden">.
              Phase {{ phase + 1 }} of {{ session.phases.length }}: {{ describePattern(current.pattern) }}. {{ describeSpatial(current.spatial) }}.</span>
          </p>
          <div class="flex shrink-0 items-center gap-2">
            <UFieldGroup size="xs" role="group" aria-label="Phase">
              <UButton v-for="(p, i) in session.phases" :key="i" :variant="phase === i ? 'soft' : 'outline'" :color="phase === i ? 'primary' : 'neutral'" :aria-pressed="phase === i" @click="pick(i)">Phase {{ i + 1 }}</UButton>
            </UFieldGroup>
            <UButton size="xs" variant="ghost" :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'" :aria-label="playing ? 'Pause the preview' : 'Play the preview'" @click="playing ? (stop(), (held = true)) : ((held = false), play())" />
          </div>
        </div>
      </UContainer>
    </div>
  </section>
</template>

<style scoped>
.hero { position: relative; min-height: min(100dvh - var(--ui-header-height), 60rem); overflow: hidden; isolation: isolate; }
@media (min-width: 1024px) { .hero { min-height: max(40rem, min(100dvh - var(--ui-header-height), 58rem)); } }
/* Keeps the words readable over the field. */
.veil { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(90deg, var(--page) 8%, color-mix(in oklab, var(--page) 70%, transparent) 36%, transparent 62%); }
@media (max-width: 1023px) { .veil { background: linear-gradient(180deg, var(--page) 20%, color-mix(in oklab, var(--page) 60%, transparent) 48%, transparent 66%); } }

.kicker { display: inline-flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0.85rem 0.3rem 0.7rem; border: 1px solid var(--hairline); border-radius: 99px; font-size: 0.85rem; color: var(--ui-text-toned); background: color-mix(in oklab, var(--page) 55%, transparent); backdrop-filter: blur(8px); }
.live-dot { width: 0.45rem; height: 0.45rem; border-radius: 50%; background: var(--ui-primary); box-shadow: 0 0 0 0 var(--glow); animation: pulse 2.4s ease-out infinite; }
@keyframes pulse { 70% { box-shadow: 0 0 0 0.6rem transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }

.headline { margin-top: 1.5rem; font-size: clamp(2.9rem, 7.4vw, 6.6rem); line-height: 0.94; letter-spacing: -0.035em; font-weight: 660; font-stretch: 80%; }
.line { display: block; overflow: hidden; padding-bottom: 0.12em; margin-bottom: -0.12em; }
.line > span { display: block; }
@media (prefers-reduced-motion: no-preference) {
  .line > span { animation: rise 1.25s var(--ease-out-expo) both; animation-delay: calc(var(--i) * 110ms + 60ms); }
  .lede, .kicker { animation: fade 1.1s var(--ease-out-expo) 0.45s both; }
  .kicker { animation-delay: 0s; }
}
/* The letters arrive condensed and open up as they settle. */
@keyframes rise { from { transform: translateY(108%); font-stretch: 75%; } }
@keyframes fade { from { opacity: 0; transform: translateY(0.6rem); } }

.lede { margin-top: 1.75rem; max-width: 36rem; font-size: 1.15rem; line-height: 1.65; color: var(--ui-text-toned); }

.now { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.6rem 0.75rem 0.6rem 1.1rem; border: 1px solid var(--hairline); border-radius: 99px; }
@media (max-width: 639px) { .now { border-radius: 1.1rem; flex-wrap: wrap; } }
</style>
