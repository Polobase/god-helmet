<script>
// Top view shared by every glyph: nose up, the band line on the unit circle.
import { SITES, siteName } from '#core/lib/brain.js'
import { HEAD_CENTRE } from '#core/engine/field.js'
import { makeTopView } from '#core/lib/topview.js'

const top = makeTopView(SITES, HEAD_CENTRE)
let n = 0
</script>

<script setup>
// A program's mark: its coils on a small head seen from above (their real
// 10-10 positions), in copper. `levels` (0..1, live) light each coil and its
// field rings; `rings` draws the rings that stand for the field.

const props = defineProps({
  sites: { type: Array, default: () => [] }, // 8 names or null
  levels: { type: Array, default: null }, // live 0..1 per coil
  rings: { type: Boolean, default: false },
  label: { type: String, default: '' }, // accessible name; empty = decorative
})
const id = `cg${++n}`
const coils = computed(() => props.sites.map((s, i) => {
  const p = SITES[siteName(s)]
  if (!p) return null
  const [x, y] = top(p)
  return { i, x: x * 100, y: y * 100 }
}).filter(Boolean))
const level = (c) => (props.levels ? Math.min(1, Math.max(0, props.levels[c.i] ?? 0)) : 1)
const RINGS = [24, 38, 54]
</script>

<template>
  <svg class="glyph" :class="{ live: !!levels }" :viewBox="rings ? '-185 -185 370 370' : '-136 -136 272 272'" :role="label ? 'img' : undefined" :aria-label="label || undefined" :aria-hidden="label ? undefined : 'true'">
    <defs>
      <radialGradient :id="`${id}-metal`" cx="38%" cy="32%" r="78%">
        <stop offset="0" style="stop-color: var(--accent-hi)" />
        <stop offset=".5" style="stop-color: var(--accent)" />
        <stop offset="1" style="stop-color: var(--accent-lo)" />
      </radialGradient>
    </defs>
    <path d="M -16 -99 L 0 -121 L 16 -99" class="head" />
    <ellipse cx="-106" cy="0" rx="9" ry="22" class="head" />
    <ellipse cx="106" cy="0" rx="9" ry="22" class="head" />
    <circle r="100" class="head" />
    <g v-if="rings">
      <template v-for="c in coils" :key="`r${c.i}`">
        <circle v-for="(r, k) in RINGS" :key="k" :cx="c.x" :cy="c.y" :r="r" class="fring" :style="{ opacity: (0.42 - k * 0.12) * level(c) }" />
      </template>
    </g>
    <circle v-for="c in coils" :key="c.i" :cx="c.x" :cy="c.y" :r="rings ? 13 : 17" class="coil" :style="{ fill: `url(#${id}-metal)`, fillOpacity: 0.25 + 0.75 * level(c) }" />
  </svg>
</template>

<style scoped>
.glyph { display: block; width: 100%; height: auto; overflow: visible; }
/* strokes keep their width at every size (card mark or header plate) */
.head { fill: color-mix(in srgb, var(--surface-2) 70%, transparent); stroke: color-mix(in srgb, var(--muted) 75%, transparent); stroke-width: 1.3px; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.fring { fill: none; stroke: var(--accent); stroke-width: 1px; vector-effect: non-scaling-stroke; transition: opacity .12s; }
.coil { stroke: color-mix(in srgb, var(--accent-lo) 80%, black); stroke-width: 1px; vector-effect: non-scaling-stroke; transition: fill-opacity .08s; }
</style>
