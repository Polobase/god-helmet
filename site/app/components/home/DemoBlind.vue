<script setup lang="ts">
// A blind session in fifteen seconds: it runs with the coil display hidden,
// you rate it, and only then does the helmet say whether the field was on.
const root = ref<HTMLElement>()
const RUN = 4200
const RATE = 2200
const SHOW = 3400
const clock = ref(RUN + RATE + 400) // server and resting picture: the reveal
const sham = ref(true)
const score = ref(6)

const stage = computed(() => (clock.value < RUN ? 'run' : clock.value < RUN + RATE ? 'rate' : 'reveal'))
const progress = computed(() => Math.min(1, clock.value / RUN))
const thumb = computed(() => {
  if (stage.value === 'run') return 0
  const t = Math.min(1, (clock.value - RUN) / (RATE * 0.7))
  return (score.value / 10) * (1 - (1 - t) ** 3)
})
const rating = computed(() => Math.round(thumb.value * 10))

useFrameLoop(root, (_t, dt) => {
  clock.value += dt
  if (clock.value > RUN + RATE + SHOW) {
    clock.value = 0
    sham.value = Math.random() < 0.5
    score.value = 2 + Math.floor(Math.random() * 7)
  }
})
</script>

<template>
  <div ref="root" class="grid gap-4 text-sm" aria-hidden="true">
    <div class="flex items-center justify-between gap-3">
      <span class="inline-flex items-center gap-2 text-highlighted"><UIcon name="i-lucide-eye-off" class="size-4 text-primary" />Blind session</span>
      <span class="num text-muted">{{ stage === 'run' ? 'running' : stage === 'rate' ? 'finished' : 'rated' }}</span>
    </div>

    <div class="coils" :class="{ hidden_: stage !== 'reveal' || sham }">
      <span v-for="i in 8" :key="i" :style="{ '--d': `${i * 90}ms` }" />
    </div>
    <div class="track"><i :style="{ width: `${progress * 100}%` }" /></div>

    <div class="grid gap-1.5" :class="{ 'opacity-35': stage === 'run' }">
      <div class="flex justify-between text-muted"><span>Your rating</span><b class="num font-display text-base text-highlighted">{{ stage === 'run' ? '–' : rating }}</b></div>
      <div class="track thin"><i :style="{ width: `${thumb * 100}%` }" /><em :style="{ left: `${thumb * 100}%` }" /></div>
    </div>

    <p class="reveal" :class="{ on: stage === 'reveal' }">
      <UIcon :name="sham ? 'i-lucide-circle-dashed' : 'i-lucide-zap'" class="size-4 shrink-0" />
      This blind session was <b>{{ sham ? 'sham' : 'real' }}</b>.
    </p>
  </div>
</template>

<style scoped>
.coils { display: flex; justify-content: space-between; gap: 0.4rem; }
.coils span { flex: 1; height: 0.5rem; border-radius: 99px; background: var(--ui-primary); box-shadow: 0 0 14px var(--glow); transition: background-color 0.5s, box-shadow 0.5s; transition-delay: var(--d); }
/* Hidden while blind, and dark when the session was sham. */
.coils.hidden_ span { background: var(--ui-border-accented); box-shadow: none; }
.track { position: relative; height: 0.4rem; border-radius: 99px; background: var(--ui-border); }
.track i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--ui-primary); }
.track.thin { height: 0.25rem; }
.track em { position: absolute; top: 50%; width: 0.9rem; height: 0.9rem; margin: -0.45rem 0 0 -0.45rem; border-radius: 50%; background: var(--ui-bg); border: 2px solid var(--ui-primary); }
.reveal { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.8rem; border-radius: 0.7rem; border: 1px solid var(--hairline); color: var(--ui-text-highlighted); opacity: 0; transform: translateY(0.4rem); transition: opacity 0.5s, transform 0.5s var(--ease-out-expo); }
.reveal.on { opacity: 1; transform: none; }
.reveal b { color: var(--ui-primary); }
</style>
