<script setup lang="ts">
// One session from start to finish, in five steps. On a wide screen the
// picture stays put while the steps scroll past it; on a phone each step
// carries its own picture.
const STEPS = [
  { title: 'Place the coils', text: 'Each program names its eight 10-10 sites. The app turns them into tape-measure directions in centimetres for your head, and a checklist to tick off coil by coil.' },
  { title: 'Pick a program', text: 'Every program page shows its phases, the signal in each one, which coils run when, where the field reaches in the brain, and the sources it was built from.' },
  { title: 'Start it, blind if you like', text: 'The Start panel lists what is ready and what is not. Tick Blind and the helmet decides, out of your sight, whether this session is real or sham.' },
  { title: 'The helmet runs it', text: 'The helmet plays the session by itself and keeps going if the phone disconnects. In a blind session the coil display stays dark either way.' },
  { title: 'Rate it, then see what it was', text: 'You rate the session before anything is revealed. Only then does the helmet tell you whether the field was on. Do that a few dozen times and you have your own answer.' },
]
const active = ref(0)
const items = ref<HTMLElement[]>([])

onMounted(() => {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) active.value = items.value.indexOf(e.target as HTMLElement)
  }, { rootMargin: '-48% 0px -48% 0px' })
  items.value.forEach((el) => io.observe(el))
  onBeforeUnmount(() => io.disconnect())
})
</script>

<template>
  <UContainer as="section" class="py-20 lg:py-32" aria-labelledby="walk">
    <div class="grid gap-x-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div>
        <h2 id="walk" class="text-4xl sm:text-5xl lg:max-w-[14ch]">From putting it on to knowing what it was</h2>
        <ol class="mt-10 lg:mt-4">
          <li v-for="(s, i) in STEPS" :key="s.title" :ref="(el) => { if (el) items[i] = el as HTMLElement }" class="step" :class="{ on: active === i }">
            <span class="n num" aria-hidden="true">{{ i + 1 }}</span>
            <div class="min-w-0">
              <h3 class="text-2xl sm:text-3xl">{{ s.title }}</h3>
              <p class="mt-3 text-lg text-toned measure">{{ s.text }}</p>
              <div class="panel mt-6 p-5 lg:hidden"><HomeWalkScreen :step="i" :active="active === i" /></div>
            </div>
          </li>
        </ol>
      </div>

      <div class="max-lg:hidden">
        <div class="sticky top-[calc(var(--ui-header-height)+12vh)]">
          <div class="panel stack p-8">
            <div class="halo" aria-hidden="true" />
            <div v-for="(s, i) in STEPS" :key="s.title" class="layer" :class="{ on: active === i }">
              <HomeWalkScreen :step="i" :active="active === i" />
            </div>
          </div>
          <div class="mt-5 flex gap-1.5" aria-hidden="true">
            <span v-for="(s, i) in STEPS" :key="s.title" class="pip" :class="{ on: active === i }" />
          </div>
        </div>
      </div>
    </div>
  </UContainer>
</template>

<style scoped>
.step { display: grid; grid-template-columns: 2.6rem minmax(0, 1fr); gap: 1.1rem; padding-block: 2.2rem; border-top: 1px solid var(--hairline); }
.n { display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border-radius: 50%; border: 1px solid var(--hairline); font-family: var(--font-display); font-weight: 640; color: var(--ui-text-muted); transition: color 0.4s, border-color 0.4s, box-shadow 0.4s, background-color 0.4s; }
@media (min-width: 1024px) {
  /* Each step takes most of a screen, so the picture has time to change. */
  .step { min-height: 62vh; align-content: center; border-top: 0; opacity: 0.55; transition: opacity 0.5s; }
  .step.on { opacity: 1; }
  .step.on .n { color: var(--ui-text-inverted); background: var(--ui-primary); border-color: var(--ui-primary); box-shadow: 0 0 24px var(--glow); }
}
.stack { display: grid; overflow: hidden; }
.halo { position: absolute; inset: -30% -20% auto auto; width: 70%; aspect-ratio: 1; background: radial-gradient(closest-side, var(--stage), transparent); pointer-events: none; }
.layer { grid-area: 1 / 1; position: relative; opacity: 0; transform: translateY(1.2rem) scale(0.985); transition: opacity 0.45s, transform 0.6s var(--ease-out-expo); pointer-events: none; }
.layer.on { opacity: 1; transform: none; }
.pip { height: 3px; flex: 1; border-radius: 99px; background: var(--ui-border); transition: background-color 0.4s; }
.pip.on { background: var(--ui-primary); }
</style>
