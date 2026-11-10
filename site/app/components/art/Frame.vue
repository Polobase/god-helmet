<script lang="ts">
import { ART_QUIET } from '~/lib/art'

// One observer for every drawing on the page: a drawing moves only while it is on screen.
const seen = new WeakMap<Element, (visible: boolean) => void>()
let io: IntersectionObserver | null = null
function watchVisible(el: Element, fn: (visible: boolean) => void) {
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) seen.get(e.target)?.(e.isIntersecting)
  }, { rootMargin: '40px' })
  seen.set(el, fn)
  io.observe(el)
  return () => {
    seen.delete(el)
    io?.unobserve(el)
  }
}
</script>

<script setup lang="ts">
// The sheet every drawing is made on, and the rules of the drawing style.
//   Ink (the text colour, solid): what is physically there.
//   Accent (the primary colour, dashed or dotted): what is invisible, felt, imagined or claimed.
// One line weight at every size (the strokes do not scale with the drawing).
// Only the accent moves, only while the drawing is on screen, and not at all
// for people who asked for less motion or while the helmet runs a session:
// then it is the still picture, which is what the drawing looks like without
// any of the animation rules below.
const props = defineProps<{
  viewBox: string
  /** Says what the drawing shows. Without it the drawing is decoration and hidden from screen readers. */
  label?: string
  /** Never animate. */
  still?: boolean
}>()

const el = ref<SVGSVGElement>()
/** 'run' while on screen, 'pause' once it has left; unset = the still picture. */
const state = ref<'run' | 'pause'>()
const quiet = inject(ART_QUIET, undefined)

onMounted(() => {
  if (props.still || !el.value) return
  const less = matchMedia('(prefers-reduced-motion: reduce)')
  let visible = false
  const apply = () => (state.value = less.matches || quiet?.value ? undefined : visible ? 'run' : state.value ? 'pause' : undefined)
  const stop = watchVisible(el.value, (v) => {
    visible = v
    apply()
  })
  less.addEventListener('change', apply)
  if (quiet) watch(quiet, apply)
  onBeforeUnmount(() => {
    stop()
    less.removeEventListener('change', apply)
  })
})
</script>

<template>
  <svg ref="el" class="art" :viewBox="viewBox" :data-art="state" :role="label ? 'img' : undefined" :aria-label="label || undefined" :aria-hidden="label ? undefined : 'true'" focusable="false">
    <slot />
  </svg>
</template>

<style>
/* A class on the drawing sets its size (utilities win over this layer); without one it fills its box. */
@layer base {
  .art { display: block; width: 100%; height: auto; overflow: visible; }
}
.art { --art-w: 1.5px; }
.art :where(path, circle, ellipse, rect, line, polyline, polygon) { fill: none; stroke: currentColor; stroke-width: var(--art-w); stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }

/* The second voice. */
.art .art-a { color: var(--ui-primary); }
.art .art-dash { stroke-dasharray: 4 3.6; }
.art .art-dots { stroke-dasharray: 0.01 4.6; }
/* A solid dot (a coil, an eye, a star) is a line of no length with a round cap: it keeps its size too. */
.art .art-pt { stroke-width: var(--art-pt, calc(var(--art-w) * 2.3)); }
/* Seen through something. */
.art .art-faint { opacity: 0.45; }
/* A mark is small: finer dashes and dots, the same line. */
.art.art-mark { --art-pt: 2.7px; }
.art.art-mark .art-dash { stroke-dasharray: 3 2.8; }
.art.art-mark .art-dots { stroke-dasharray: 0.01 3.7; }

/* Parts that only the still picture has, and parts that only the moving one has. */
.art .art-live { display: none; }
.art[data-art] .art-live { display: inline; }
.art[data-art] .art-still { display: none; }

@media (prefers-reduced-motion: no-preference) {
  /* fades out and back: a presence, a thought */
  .art[data-art] .art-breathe { animation: art-breathe var(--art-t, 7s) ease-in-out var(--art-d, 0s) infinite; }
  /* dots or dashes travel along their line: a signal */
  .art[data-art] .art-march { animation: art-march var(--art-t, 1.1s) linear infinite; }
  .art[data-art] .art-march.art-dash { animation-name: art-march-dash; }
  .art.art-mark[data-art] .art-march { animation-name: art-march-mark; }
  .art.art-mark[data-art] .art-march.art-dash { animation-name: art-march-dash-mark; }
  /* floats up and back */
  .art[data-art] .art-drift { animation: art-drift var(--art-t, 8s) ease-in-out var(--art-d, 0s) infinite; }
  .art[data-art="pause"] * { animation-play-state: paused !important; }
}
@keyframes art-breathe { 0%, 100% { opacity: 1; } 50% { opacity: var(--art-lo, 0.12); } }
@keyframes art-march { to { stroke-dashoffset: -4.61px; } }
@keyframes art-march-dash { to { stroke-dashoffset: -7.6px; } }
@keyframes art-march-mark { to { stroke-dashoffset: -3.71px; } }
@keyframes art-march-dash-mark { to { stroke-dashoffset: -5.8px; } }
@keyframes art-drift { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(var(--art-dx, 0), var(--art-dy, -5px)); } }
</style>
