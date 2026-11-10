<script setup lang="ts">
import type { SceneId } from '~/lib/art'

const { data: articles } = await usePageList('articles')
const effects = computed(() => (articles.value ?? []).filter((a) => a.group === 'Effect'))
// Claims that go beyond a reported experience: one research article each.
const claimed = computed(() => (articles.value ?? []).filter((a) => a.group === 'Claim'))
const background = computed(() => (articles.value ?? []).filter((a) => a.group !== 'Effect' && a.group !== 'Claim'))
// Counted from the program and guide files when the site is built.
const { data: lib } = await useFetch<{ programs: number, guides: number, names: string[] }>('/library.json')

useSeoMeta({
  description: 'What the God Helmet was said to do, from a sensed presence to telepathy and remote viewing, the evidence for and against, and an app to test the claims yourself: targets sealed in advance, blind real-or-sham sessions, and a demo that needs no hardware.',
  ogTitle: 'God Helmet: don’t believe it, don’t dismiss it, test it blind',
})

// Tests anyone can run today in the demo, without a helmet.
const tests: { scene: SceneId, title: string, text: string, needs: string, to: string }[] = [
  {
    scene: 'micro-pk',
    title: 'Mind over random numbers',
    text: 'Aim a random generator high, then low, in blocks of a thousand bits. A control block comes first, and the high and low blocks are compared, so a biased generator cannot fake a result.',
    needs: 'Alone, about 25 minutes, nothing to prepare',
    to: '/app/guides/rng-pk',
  },
  {
    scene: 'remote-viewing',
    title: 'A picture sealed in advance',
    text: 'The app picks a picture from your own pool and seals the choice before you start. You describe and sketch it, lock your answer, rank the pictures blind, and only then see the target.',
    needs: 'Alone, about 40 minutes; add a few sets of pictures first',
    to: '/app/guides/photo-target-trial',
  },
  {
    scene: 'ganzfeld',
    title: 'The ganzfeld',
    text: 'The classic psi test: eyes covered, steady noise in the headphones, half an hour of saying what comes to mind, then a blind ranking of the pictures. Questions on belief and mood before and after.',
    needs: 'Alone, about an hour, headphones; add pictures first',
    to: '/app/guides/psi-trial-flow',
  },
]

// What turns a session into a test. A sequence: the order matters.
const rules: { title: string, text: string }[] = [
  { title: 'Decide first', text: 'How many trials, and what counts as a hit. Write it down before the first one.' },
  { title: 'Let the app hide the answer', text: 'The target is chosen and sealed before you start, and the seal can be checked afterwards.' },
  { title: 'Answer, then look', text: 'Lock your response or rate the session before anything is revealed.' },
  { title: 'Compare with chance', text: 'One hit proves nothing. The app shows how often chance alone would do as well, and keeps the misses too.' },
]

// The method behind every article: what the record says in a sentence or two,
// and where the site goes into it.
const claims: { scene: SceneId, kind: string, title: string, text: string, to: string, more: string }[] = [
  {
    scene: 'blind',
    kind: 'Method',
    title: 'Real or sham',
    text: 'In the best independent test, suggestibility predicted the experiences and the field did not. So every effect here can be run blind: the helmet picks real or sham, and says which only after you have rated the session.',
    to: '/docs/experiments#blinded-realsham-sessions',
    more: 'How to run a blinded series',
  },
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

    <!-- An invitation: tests that need no hardware, and what makes them count. -->
    <section id="test" class="scroll-mt-20 border-b border-(--hairline)" aria-labelledby="test-now">
      <UContainer class="py-24 lg:py-36">
        <div class="max-w-3xl">
          <h2 id="test-now" class="text-4xl sm:text-5xl">Test a claim yourself</h2>
          <p class="mt-5 text-lg text-toned measure">Three tests you can run in the demo today, without any hardware. Whether you expect a hit or are sure there is nothing to find, the result is the same kind of number, and it is yours.</p>
        </div>
        <div v-reveal class="mt-10 grid gap-4 lg:grid-cols-3" data-test="tests">
          <NuxtLink v-for="t in tests" :key="t.to" v-spotlight data-reveal-item :to="t.to" class="panel group flex flex-col gap-4 p-7 sm:p-8">
            <ArtScene :name="t.scene" class="mx-auto mb-1 max-w-88 text-highlighted" />
            <h3 class="text-[1.9rem] transition-colors group-hover:text-primary">{{ t.title }}</h3>
            <p class="text-toned">{{ t.text }}</p>
            <p class="mt-auto pt-2 text-sm text-muted">{{ t.needs }}</p>
            <p class="flex items-center gap-1.5 text-sm font-semibold text-primary">Start this test<UIcon name="i-lucide-arrow-right" class="size-4 transition-transform group-hover:translate-x-0.5" /></p>
          </NuxtLink>
        </div>
        <p class="mt-5 text-toned">Or start with the <NuxtLink to="/app/guides/forced-choice-trainer" class="text-primary underline underline-offset-4">ten-choice trainer</NuxtLink>: 25 guesses with feedback after each one, in under 20 minutes. With a helmet, two people can run the telepathy test, and the same app runs real against sham.</p>

        <h3 class="mt-16 text-3xl">What makes it a test</h3>
        <ol class="mt-6 grid gap-x-8 gap-y-6 border-t border-(--hairline) pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <li v-for="(r, i) in rules" :key="r.title">
            <p class="num text-sm text-muted">{{ i + 1 }}</p>
            <h4 class="mt-1 font-sans text-lg font-semibold text-highlighted">{{ r.title }}</h4>
            <p class="mt-2 text-toned">{{ r.text }}</p>
          </li>
        </ol>
      </UContainer>
    </section>

    <!-- What you can do with it: each tile runs the real thing, small. -->
    <UContainer as="section" class="py-24 lg:py-36" aria-labelledby="uses">
      <div class="max-w-3xl">
        <h2 id="uses" class="text-4xl sm:text-5xl">The tools for a fair test</h2>
        <p class="mt-5 text-lg text-toned measure">Everything here also runs in the demo, with the helmet’s engine in your browser and nothing switched on.</p>
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
            <h2 id="read" class="text-4xl sm:text-5xl">What is claimed</h2>
            <p class="mt-5 text-lg text-toned measure">What people report, what the laboratory record says, what happened when others tried, and a test you can run for each one.</p>
          </div>
          <UButton to="/articles" size="lg" variant="ghost" trailing-icon="i-lucide-arrow-right">All articles</UButton>
        </div>
        <div v-reveal class="mt-10 grid gap-4 lg:grid-cols-3">
          <ArticleCard v-for="a in effects" :key="a.path" data-reveal-item :article="a" large />
        </div>
        <!-- The claims that go further, one research article each. -->
        <div class="mt-16 max-w-2xl">
          <h3 id="claims" class="text-3xl sm:text-4xl">Six claims that go further</h3>
          <p class="mt-4 text-lg text-toned measure">Each rests on one laboratory’s report, or on an effect that shrinks as the controls get tighter. Every article gives the best case for and against, and ends with a test you can run.</p>
        </div>
        <div v-reveal class="mt-8 grid gap-4 lg:grid-cols-3" data-test="claim-articles">
          <ArticleCard v-for="a in claimed" :key="a.path" data-reveal-item :article="a" large />
        </div>
        <!-- The method that goes with all of them. -->
        <div v-reveal class="mt-4 grid gap-4" data-test="claims">
          <NuxtLink v-for="c in claims" :key="c.scene" v-spotlight data-reveal-item :to="c.to" class="panel group grid items-center gap-x-10 gap-y-4 p-7 sm:p-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <ArtScene :name="c.scene" class="mx-auto max-w-88 text-highlighted" />
            <div class="flex flex-col gap-4">
              <p class="flex items-center justify-between text-sm text-muted">
                <span>{{ c.kind }}</span>
                <UIcon name="i-lucide-arrow-up-right" class="size-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </p>
              <h3 class="text-[2rem] transition-colors group-hover:text-primary lg:text-[2.3rem]">{{ c.title }}</h3>
              <p class="text-toned measure">{{ c.text }}</p>
              <p class="pt-2 text-sm font-semibold text-primary">{{ c.more }}</p>
            </div>
          </NuxtLink>
        </div>
        <ul class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

    <!-- The hardware: not published until a complete helmet has been built and measured. -->
    <UContainer as="section" class="py-20 lg:py-28" aria-labelledby="build">
      <div class="max-w-3xl">
        <h2 id="build" class="text-4xl sm:text-5xl">The hardware comes later</h2>
        <p class="mt-5 text-lg text-toned measure">The control box and the headband are still being tested. The schematic, the parts list and the build guide will be published here once a complete helmet has been built and measured. Until then the trials, the guides and the random-number test all run in the demo, without any hardware.</p>
        <div class="mt-7 flex flex-wrap gap-2">
          <UButton to="#test">Test a claim</UButton>
          <UButton to="/docs/safety" variant="ghost">Read the safety page</UButton>
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
            </div>
          </div>
        </div>
      </UContainer>
    </section>

    <!-- The way out of the page: into the demo. -->
    <section class="closing" aria-labelledby="closing">
      <UContainer class="relative py-28 text-center lg:py-44">
        <h2 id="closing" v-reveal class="mx-auto max-w-[12ch] text-[clamp(3rem,9vw,8rem)] font-[660] leading-[0.92] tracking-[-0.04em] [font-stretch:78%]">Find out for yourself.</h2>
        <p class="mx-auto mt-8 max-w-xl text-lg text-toned">Pick a claim, decide what would convince you, and test it blind. Nothing to install, no hardware.</p>
        <div class="mt-9 flex flex-wrap justify-center gap-3">
          <UButton to="/app/guides" color="primary" variant="solid" size="xl" trailing-icon="i-lucide-arrow-right" class="px-7">Choose a test</UButton>
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
