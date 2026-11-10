<script setup lang="ts">
import type { SceneId } from '~/lib/art'

const { data: articles } = await usePageList('articles')
const effects = computed(() => (articles.value ?? []).filter((a) => a.group === 'Effect'))
const background = computed(() => (articles.value ?? []).filter((a) => a.group !== 'Effect'))
// Counted from the program and guide files when the site is built.
const { data: lib } = await useFetch<{ programs: number, guides: number, names: string[] }>('/library.json')

useSeoMeta({
  description: 'An open, DIY recreation of the Persinger and Koren God Helmet: eight weak-field coils, an ESP32, programs rebuilt from the literature, and blinded sham sessions to test what they do.',
  ogTitle: 'God Helmet: a weak-field helmet you can build, and test blind',
})

// Three things people ask about that have no article of their own: what the
// record says in a sentence or two, and where the site goes into it.
const claims: { scene: SceneId, kind: string, title: string, text: string, to: string, more: string }[] = [
  {
    scene: 'telepathy',
    kind: 'Single-lab claim',
    title: 'Telepathy',
    text: 'The lab reported that a person in another room could describe what a partner was shown, in studies of four to seven pairs that nobody has repeated. The app runs it as a committed trial: the helmet fixes the picture before the receiver answers.',
    to: '/docs/experiments#telepathy-trials',
    more: 'How a telepathy trial works',
  },
  {
    scene: 'ring',
    kind: 'Single-lab claim',
    title: 'The ring, or “Octopus”',
    text: 'Eight coils around the head, the field stepping from one to the next counter-clockwise, each step a little shorter or longer than the last. The lab’s remote-viewing, telepathy and linked-brains reports all used it. Each comes from that one lab, some from a single subject.',
    to: '/articles/research#circumcerebral-octopus-protocols',
    more: 'The ring protocols in the evidence review',
  },
  {
    scene: 'blind',
    kind: 'Method',
    title: 'Real or sham',
    text: 'In the best independent test, suggestibility predicted the experiences and the field did not. So every effect here can be run blind: the helmet picks real or sham, and says which only after you have rated the session.',
    to: '/docs/experiments#blinded-realsham-sessions',
    more: 'How to run a blinded series',
  },
]

const EXPECT = 'The fields are about 1–8 µT at the cortex, about a million times weaker than TMS, and the induced electric field is microvolts to millivolts per metre. The best double-blind test (Granqvist 2005, N = 89) found no effect of the field; suggestibility predicted the experiences.'

const parts = [
  ['Controller', 'ESP32-S3, classic ESP32, C3 or C6. Updates all eight coils together at 2 kHz and keeps a session running if the phone disconnects.'],
  ['Output', 'AD5328 8-channel ±10 V DAC, a 2.2 kΩ series resistor per coil, and a PhotoMOS arming switch.'],
  ['Coils', 'Eight small coils on a Velcro headband, placed on 10-10 sites with a tape measure.'],
  ['Power', 'A USB power bank. Never mains while the helmet is worn.'],
  ['Control', 'This app over Bluetooth LE or a USB cable, or a 2.8" touchscreen board with a microSD card.'],
]

const verified = ['All five firmware targets build', 'Host unit tests pass', 'The JavaScript engine reproduces the C++ engine’s output for every program', 'Protocol, blind reveal and trial commitment logic are tested against the demo helmet']
const unverified = ['Bluetooth with a real phone', 'The DAC module’s transfer function', 'SPI and LDAC timing', 'The coils’ real µT per mA']
</script>

<template>
  <div>
    <HomeHero />

    <!-- The library in numbers, and its names drifting past. -->
    <section class="relative border-y border-(--hairline) py-14 lg:py-16" aria-label="The project in numbers">
      <UContainer>
        <dl v-reveal class="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-4">
          <div data-reveal-item class="stat">
            <dd><HomeCountUp :value="lib?.programs ?? 0" /></dd>
            <dt>programs, each labelled with the evidence behind it</dt>
          </div>
          <div data-reveal-item class="stat">
            <dd><HomeCountUp :value="lib?.guides ?? 0" /></dd>
            <dt>guided sessions with audio and questionnaires</dt>
          </div>
          <div data-reveal-item class="stat">
            <dd><HomeCountUp :value="8" /></dd>
            <dt>coils, driven together 2,000 times a second</dt>
          </div>
          <div data-reveal-item class="stat">
            <dd class="num">1–8<span class="unit">µT</span></dd>
            <dt>at the cortex: about a million times weaker than TMS</dt>
          </div>
        </dl>
      </UContainer>
      <HomeMarquee v-if="lib?.names.length" :names="lib.names" class="mt-12" />
    </section>

    <!-- Honest expectations: said early, in the project's own words. -->
    <UContainer as="section" class="py-24 lg:py-40" aria-labelledby="expect">
      <h2 id="expect" class="font-sans text-base font-semibold tracking-normal text-primary [font-stretch:100%]">Honest expectations</h2>
      <HomeScrubText :text="EXPECT" class="mt-6 max-w-[26ch] font-display text-[clamp(1.9rem,4.6vw,4rem)] font-[620] leading-[1.08] text-highlighted sm:max-w-[30ch] lg:max-w-[34ch]" />
      <div v-reveal class="mt-10 grid gap-6 border-t border-(--hairline) pt-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <p class="text-lg text-toned measure">That is why the blinding is built into the helmet and not left to the person wearing it: so that what you find out is about the field, and not about what you hoped for.</p>
        <p class="lg:justify-self-end"><UButton to="/articles/research" size="lg" trailing-icon="i-lucide-arrow-right">Read the evidence review</UButton></p>
      </div>
    </UContainer>

    <!-- What you can do with it: each tile runs the real thing, small. -->
    <UContainer as="section" class="pb-24 lg:pb-36" aria-labelledby="uses">
      <div class="max-w-3xl">
        <h2 id="uses" class="text-4xl sm:text-5xl">What you can do with it</h2>
        <p class="mt-5 text-lg text-toned measure">Everything here runs in the demo too, with the helmet’s engine in your browser and nothing switched on.</p>
      </div>

      <div v-reveal class="mt-10 grid gap-4 lg:grid-cols-12">
        <article v-spotlight data-reveal-item class="tile panel lg:col-span-7">
          <div>
            <h3>{{ lib?.programs }} programs</h3>
            <p>Todd Murphy’s Shiva and Shakti sessions on their exact 10-10 sites, 38 Persinger-lab protocols, the timing of clinical low-field methods, and replications of the independent tests. Each one states the evidence for the original and what it approximates.</p>
          </div>
          <HomeDemoScope />
          <NuxtLink to="/app/programs" class="more">Browse the programs</NuxtLink>
        </article>

        <article v-spotlight data-reveal-item class="tile panel lg:col-span-5">
          <div>
            <h3>Blind sessions</h3>
            <p>Tick Blind and the helmet picks real or sham at random. The coil display is hidden, and you learn which it was only after you have rated the session.</p>
          </div>
          <HomeDemoBlind />
          <NuxtLink to="/docs/experiments" class="more">How the blinding works</NuxtLink>
        </article>

        <article v-spotlight data-reveal-item class="tile panel lg:col-span-4">
          <div>
            <h3>Committed trials</h3>
            <p>Remote-viewing and telepathy trials where the target is fixed, and provably so, before you respond.</p>
          </div>
          <HomeDemoCommit />
          <NuxtLink to="/app/trials" class="more">Open the trials</NuxtLink>
        </article>

        <article v-spotlight data-reveal-item class="tile panel lg:col-span-4">
          <div>
            <h3>{{ lib?.guides }} guided sessions</h3>
            <p>Step-by-step sessions with binaural, monaural or isochronic audio, questionnaires, and a blinded helmet arm where the guide calls for one.</p>
          </div>
          <HomeDemoBeat />
          <NuxtLink to="/app/guides" class="more">See the guides</NuxtLink>
        </article>

        <article v-spotlight data-reveal-item class="tile panel lg:col-span-4">
          <div>
            <h3>Where the field reaches</h3>
            <p>A weak field falls off fast. Every program shows an estimate of it at each brain region, for every phase.</p>
          </div>
          <HomeDemoDepth />
          <NuxtLink to="/app/programs/god-helmet-classic/brain" class="more">See it on the brain</NuxtLink>
        </article>
      </div>
    </UContainer>

    <div class="rule-fade" />
    <HomeWalkthrough />

    <!-- Articles. -->
    <section class="border-y border-(--hairline)" aria-labelledby="read">
      <UContainer class="py-20 lg:py-32">
        <div class="flex flex-wrap items-end justify-between gap-6">
          <div class="max-w-2xl">
            <h2 id="read" class="text-4xl sm:text-5xl">The effects people ask about</h2>
            <p class="mt-5 text-lg text-toned measure">What is reported, what the laboratory record says, what happened when others tried, and how to test each one with this helmet.</p>
          </div>
          <UButton to="/articles" size="lg" variant="ghost" trailing-icon="i-lucide-arrow-right">All articles</UButton>
        </div>
        <div v-reveal class="mt-10 grid gap-4 lg:grid-cols-3">
          <ArticleCard v-for="a in effects" :key="a.path" data-reveal-item :article="a" large />
        </div>
        <!-- Claims and the method, without an article of their own. -->
        <div v-reveal class="mt-4 grid gap-4 lg:grid-cols-3" data-test="claims">
          <NuxtLink v-for="c in claims" :key="c.scene" v-spotlight data-reveal-item :to="c.to" class="panel group flex flex-col gap-4 p-7 sm:p-8">
            <ArtScene :name="c.scene" class="mx-auto mb-1 max-w-88 text-highlighted" />
            <p class="flex items-center justify-between text-sm text-muted">
              <span>{{ c.kind }}</span>
              <UIcon name="i-lucide-arrow-up-right" class="size-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
            </p>
            <h3 class="text-[2rem] transition-colors group-hover:text-primary lg:text-[2.3rem]">{{ c.title }}</h3>
            <p class="text-toned">{{ c.text }}</p>
            <p class="mt-auto pt-2 text-sm font-semibold text-primary">{{ c.more }}</p>
          </NuxtLink>
        </div>
        <ul class="mt-4 grid gap-4 sm:grid-cols-2">
          <li v-for="a in background" :key="a.path">
            <NuxtLink v-spotlight :to="a.path" class="panel group flex items-baseline gap-4 px-6 py-5">
              <span class="font-display text-xl font-[640] text-highlighted group-hover:text-primary">{{ a.label }}</span>
              <span class="num ml-auto text-sm text-muted">{{ a.minutes }} min</span>
              <UIcon name="i-lucide-arrow-up-right" class="size-4 self-center text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
            </NuxtLink>
          </li>
        </ul>
      </UContainer>
    </section>

    <!-- How it is built. -->
    <UContainer as="section" class="py-20 lg:py-32" aria-labelledby="build">
      <div class="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <h2 id="build" class="text-4xl sm:text-5xl">How it is built</h2>
          <p class="mt-5 text-lg text-toned measure">A control box, two network cables and a headband. Everything is in the repository: firmware for five boards, the schematic, the parts list and a printable coil clip.</p>
          <dl class="mt-8 border-t border-(--hairline) text-sm">
            <div v-for="[k, v] in parts" :key="k" class="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 border-b border-(--hairline) py-3.5">
              <dt class="font-semibold text-highlighted">{{ k }}</dt>
              <dd class="m-0 text-toned">{{ v }}</dd>
            </div>
          </dl>
          <div class="mt-7 flex flex-wrap gap-2">
            <UButton to="/docs/parts">Parts list</UButton>
            <UButton to="/docs/wiring">Wiring</UButton>
            <UButton to="/docs/calibration">Calibration</UButton>
            <UButton to="/app/helmet">Install the firmware</UButton>
          </div>
        </div>
        <div v-reveal class="min-w-0 self-start">
          <div class="panel p-3">
            <ProseImg src="schematic.svg" alt="Wiring schematic: power bank, ESP32, AD5328 module, eight coil outputs with series resistors, arming switch and STOP button" class="my-0!" />
          </div>
          <p class="mt-3 text-sm text-muted">The whole circuit. <NuxtLink to="/docs/wiring" class="underline underline-offset-4 hover:text-highlighted">Pin tables for every supported board</NuxtLink></p>
        </div>
      </div>
    </UContainer>

    <!-- Safety, then what has and has not been checked. -->
    <section class="border-t border-(--hairline)" aria-labelledby="safety">
      <UContainer class="grid gap-4 py-20 lg:grid-cols-2 lg:py-28">
        <div class="panel p-7 sm:p-9">
          <h2 id="safety" class="text-3xl">Read the safety page first</h2>
          <p class="mt-5 border-l-[3px] border-error pl-5 text-lg text-highlighted measure">
            Not for people with epilepsy or seizure history, psychiatric conditions, or implanted electronics. Battery power only. Experimental, non-medical.
          </p>
          <p class="mt-5 text-toned measure">The helmet refuses to start a field until the safety page has been accepted on it, and it has a STOP button, an arming switch, a field ceiling and a 60-minute cap.</p>
          <UButton to="/docs/safety" size="lg" class="mt-6">Safety</UButton>
        </div>
        <div class="panel p-7 sm:p-9">
          <h2 class="text-3xl">Where the project stands</h2>
          <div class="mt-5 grid gap-7 text-sm sm:grid-cols-2">
            <div>
              <h3 class="font-sans text-sm font-semibold tracking-normal [font-stretch:100%]">Verified</h3>
              <ul class="mt-3 grid gap-2.5 text-toned">
                <li v-for="v in verified" :key="v" class="flex gap-2.5"><UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />{{ v }}</li>
              </ul>
            </div>
            <div>
              <h3 class="font-sans text-sm font-semibold tracking-normal [font-stretch:100%]">Not yet verified on hardware</h3>
              <ul class="mt-3 grid gap-2.5 text-toned">
                <li v-for="v in unverified" :key="v" class="flex gap-2.5"><UIcon name="i-lucide-circle-dashed" class="mt-0.5 size-4 shrink-0 text-muted" />{{ v }}</li>
              </ul>
              <p class="mt-4 text-muted"><NuxtLink to="/docs/calibration" class="underline underline-offset-4 hover:text-highlighted">Calibration</NuxtLink> walks through them.</p>
            </div>
          </div>
        </div>
      </UContainer>
    </section>

    <!-- The way out of the page: into the demo. -->
    <section class="closing" aria-labelledby="closing">
      <UContainer class="relative py-28 text-center lg:py-44">
        <h2 id="closing" v-reveal class="mx-auto max-w-[12ch] text-[clamp(3rem,9vw,8rem)] font-[660] leading-[0.92] tracking-[-0.04em] [font-stretch:78%]">Find out for yourself.</h2>
        <p class="mx-auto mt-8 max-w-xl text-lg text-toned">Open the demo, pick a program, and run it blind. It takes two minutes and no hardware.</p>
        <div class="mt-9 flex flex-wrap justify-center gap-3">
          <UButton to="/app/programs" color="primary" variant="solid" size="xl" trailing-icon="i-lucide-arrow-right" class="px-7">Try it in the demo</UButton>
          <UButton to="https://github.com/Polobase/god-helmet" target="_blank" size="xl" variant="ghost" class="px-5">Get the source</UButton>
        </div>
      </UContainer>
    </section>
  </div>
</template>

<style scoped>
.stat dd { margin: 0; font-family: var(--font-display); font-stretch: 78%; font-weight: 660; font-size: clamp(3.2rem, 7vw, 5.5rem); line-height: 0.95; letter-spacing: -0.03em; color: var(--ui-text-highlighted); }
.stat .unit { font-size: 0.34em; font-stretch: 90%; letter-spacing: 0; margin-left: 0.35em; color: var(--ui-text-muted); font-weight: 600; }
.stat dt { margin-top: 0.9rem; max-width: 17rem; color: var(--ui-text-muted); font-size: 0.95rem; line-height: 1.45; }

.tile { display: grid; grid-template-rows: auto 1fr auto; gap: 1.75rem; padding: 1.75rem; }
@media (min-width: 640px) { .tile { padding: 2.25rem; } }
.tile h3 { font-size: 1.9rem; }
.tile p { margin-top: 0.75rem; color: var(--ui-text-toned); max-width: 56ch; }
.tile > :nth-child(2) { align-self: end; }
.more { justify-self: start; font-weight: 600; font-size: 0.95rem; color: var(--ui-primary); text-decoration: underline; text-underline-offset: 0.3em; text-decoration-color: color-mix(in oklab, var(--ui-primary) 40%, transparent); transition: text-decoration-color 0.2s; }
.more:hover { text-decoration-color: var(--ui-primary); }

/* The last screen: the field's light rising from below. */
.closing { position: relative; overflow: hidden; border-top: 1px solid var(--hairline); }
.closing::before { content: ""; position: absolute; inset: auto -10% -55% -10%; height: 110%; background: radial-gradient(closest-side, var(--light-a), transparent 70%); pointer-events: none; }
</style>
