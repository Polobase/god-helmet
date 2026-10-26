<script setup>
// Coil placement drawing. Ring layout = view from above (nose up, your left on
// the left). Temporal layout = both sides of the head.
// `levels` (live, 0..1) or `used` (static weights) set how bright each coil is.
import { computed } from 'vue'
import { LAYOUTS } from '../lib/layouts.js'

const props = defineProps({
  layout: { type: String, default: 'temporal' },
  levels: { type: Array, default: null },
  used: { type: Array, default: null },
  direction: { type: String, default: null }, // 'ccw' | 'cw' rotation arrow (ring)
  labels: { type: Boolean, default: true },
})

const RING_ANGLES = [-90, -135, 180, 135, 90, 45, 0, -45] // degrees; CH1 at the nose, counter-clockwise
const ring = computed(() =>
  RING_ANGLES.map((a) => {
    const r = (a * Math.PI) / 180
    return {
      x: 120 + 84 * Math.cos(r), y: 128 + 98 * Math.sin(r),
      lx: 120 + 110 * Math.cos(r), ly: 128 + 120 * Math.sin(r) + 4,
    }
  }),
)
// Side views: left half = your left side (face to the left), right half mirrored.
const LEFT = [[70, 104], [92, 74], [130, 78], [138, 108]]
const temporal = computed(() => {
  const pts = LEFT.map(([x, y]) => ({ x, y }))
  const mirrored = LEFT.map(([x, y]) => ({ x: 360 - x, y }))
  return [...pts, ...mirrored].map((p) => ({ ...p, lx: p.x, ly: p.y - 15 }))
})

const coils = computed(() => {
  const pos = props.layout === 'ring' ? ring.value : temporal.value
  const meta = LAYOUTS[props.layout].channels
  return pos.map((p, i) => {
    const live = props.levels ? Math.min(1, Math.abs(props.levels[i] ?? 0)) : null
    const weight = props.used ? props.used[i] ?? 0 : 1
    return { ...p, ch: i + 1, site: meta[i].site, live, weight }
  })
})

function fillOpacity(c) {
  if (c.live !== null) return 0.1 + 0.9 * c.live
  return c.weight > 0 ? 0.25 + 0.45 * c.weight : 0.04
}
</script>

<template>
  <svg v-if="layout === 'ring'" viewBox="0 0 240 262" class="head" role="img"
    aria-label="Ring layout seen from above: eight coils evenly around the head, CH1 at the forehead, numbered counter-clockwise">
    <defs>
      <marker id="hd-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
      </marker>
    </defs>
    <ellipse cx="120" cy="128" rx="84" ry="98" class="outline" />
    <path d="M108 32 L120 14 L132 32" class="outline" />
    <ellipse cx="34" cy="132" rx="7" ry="16" class="outline" />
    <ellipse cx="206" cy="132" rx="7" ry="16" class="outline" />
    <text x="120" y="135" text-anchor="middle" class="hint">top view</text>
    <text x="120" y="150" text-anchor="middle" class="hint">nose ↑</text>
    <path v-if="direction" :d="direction === 'ccw' ? 'M156 64 A58 66 0 0 0 84 64' : 'M84 64 A58 66 0 0 1 156 64'"
      class="dir" marker-end="url(#hd-arrow)" />
    <g v-for="c in coils" :key="c.ch">
      <circle :cx="c.x" :cy="c.y" r="11" class="coil" :class="{ off: c.live === null && c.weight === 0 }"
        :style="{ fillOpacity: fillOpacity(c) }" />
      <text :x="c.x" :y="c.y + 4" text-anchor="middle" class="ch">{{ c.ch }}</text>
      <text v-if="labels" :x="c.lx" :y="c.ly" text-anchor="middle" class="site">{{ c.site }}</text>
    </g>
  </svg>

  <svg v-else viewBox="0 0 360 190" class="head" role="img"
    aria-label="Temporal layout: four coils over each temporal lobe, left side CH1 to CH4, right side CH5 to CH8">
    <g v-for="side in [0, 1]" :key="side" :transform="side ? 'translate(360 0) scale(-1 1)' : ''">
      <path d="M40 104 C40 52 82 22 118 22 C160 22 176 60 176 98 C176 138 152 168 112 170 C88 171 72 160 64 146 L60 134 L46 132 L52 120 L38 112 Z" class="outline" />
      <ellipse cx="112" cy="116" rx="9" ry="14" class="outline" />
    </g>
    <text x="96" y="186" text-anchor="middle" class="hint">left side</text>
    <text x="264" y="186" text-anchor="middle" class="hint">right side</text>
    <g v-for="c in coils" :key="c.ch">
      <circle :cx="c.x" :cy="c.y" r="11" class="coil" :class="{ off: c.live === null && c.weight === 0 }"
        :style="{ fillOpacity: fillOpacity(c) }" />
      <text :x="c.x" :y="c.y + 4" text-anchor="middle" class="ch">{{ c.ch }}</text>
      <text v-if="labels" :x="c.lx" :y="c.ly" text-anchor="middle" class="site">{{ c.site }}</text>
    </g>
  </svg>
</template>

<style scoped>
.head { width: 100%; height: auto; display: block; }
.outline { fill: none; stroke: var(--muted); stroke-width: 1.5; opacity: .7; }
.coil { fill: var(--accent); stroke: var(--accent); stroke-width: 1.5; transition: fill-opacity .12s; }
.coil.off { stroke: var(--line); stroke-dasharray: 3 3; }
.ch { fill: var(--text); font: 700 10px var(--font-body); pointer-events: none; }
.site { fill: var(--muted); font: 600 9.5px var(--font-body); letter-spacing: .03em; }
.hint { fill: var(--muted); font: 10px var(--font-body); opacity: .8; }
.dir { fill: none; stroke: var(--blue); stroke-width: 2; }
.arrowhead { fill: var(--blue); }
</style>
