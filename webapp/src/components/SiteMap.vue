<script setup>
// 10-10 map seen from above (nose up, your left on the left): every standard
// site as a dot, the program's coils as numbered discs. Positions are the
// MNI 10-05 coordinates projected around the vertex (azimuthal equidistant).
import { computed } from 'vue'
import { SITES, siteName } from '../lib/brain.js'
import { HEAD_CENTRE } from '../engine/field.js'

const props = defineProps({
  sites: { type: Array, default: () => [] }, // 8 names or null
  used: { type: Array, default: null }, // static weights 0..1
  levels: { type: Array, default: null }, // live 0..1
  highlight: { type: Array, default: () => [] }, // extra site names to outline (e.g. a zone)
  labels: { type: Boolean, default: true },
})

const TEN_TEN = /^(Fp|AF|F|FT|FC|T|C|TP|CP|P|PO|O|I)(z|\d+)$/
const sub = (a, b) => a.map((v, i) => v - b[i])
const unit = (a) => {
  const l = Math.hypot(...a)
  return a.map((v) => v / l)
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

const C = HEAD_CENTRE
const up = unit(sub(SITES.Cz, C))
const front = unit(sub(sub(SITES.Fpz, C), up.map((v) => v * dot(sub(SITES.Fpz, C), up))))
const right = cross(front, up)
const R = 105 // radius in the drawing for 90° from the vertex

function project(p) {
  const d = unit(sub(p, C))
  const theta = Math.acos(Math.max(-1, Math.min(1, dot(d, up))))
  const phi = Math.atan2(dot(d, right), dot(d, front))
  const r = (theta / (Math.PI / 2)) * R
  return { x: 160 + r * Math.sin(phi), y: 160 - r * Math.cos(phi) }
}

const grid = Object.entries(SITES)
  .filter(([n]) => TEN_TEN.test(n))
  .map(([name, p]) => ({ name, ...project(p) }))
  .filter((s) => Math.hypot(s.x - 160, s.y - 160) < 135)

const coils = computed(() =>
  props.sites.map((s, i) => {
    const name = siteName(s)
    if (!name) return null
    const live = props.levels ? Math.min(1, Math.abs(props.levels[i] ?? 0)) : null
    const weight = props.used ? props.used[i] ?? 0 : 1
    return { ch: i + 1, name, ...project(SITES[name]), live, weight }
  }).filter(Boolean),
)
const outlined = computed(() => props.highlight.map(siteName).filter(Boolean).map((n) => ({ name: n, ...project(SITES[n]) })))
const opacity = (c) => (c.live !== null ? 0.12 + 0.88 * c.live : c.weight > 0 ? 0.3 + 0.5 * c.weight : 0.06)
</script>

<template>
  <svg viewBox="0 0 320 330" class="sitemap" role="img"
    :aria-label="`10-10 map seen from above with coils at ${coils.map((c) => `CH${c.ch} ${c.name}`).join(', ') || 'no sites'}`">
    <circle cx="160" cy="160" :r="R" class="outline" />
    <path d="M148 57 L160 40 L172 57" class="outline" />
    <ellipse cx="22" cy="160" rx="7" ry="18" class="outline" />
    <ellipse cx="298" cy="160" rx="7" ry="18" class="outline" />
    <circle cx="160" cy="160" :r="R / 2" class="ring" />
    <line x1="160" :y1="160 - R" x2="160" :y2="160 + R" class="ring" />
    <line :x1="160 - R" y1="160" :x2="160 + R" y2="160" class="ring" />
    <g v-for="s in grid" :key="s.name">
      <circle :cx="s.x" :cy="s.y" r="1.8" class="site" />
      <text v-if="labels && !coils.some((c) => c.name === s.name)" :x="s.x" :y="s.y - 3.5" class="site-label">{{ s.name }}</text>
    </g>
    <circle v-for="o in outlined" :key="'o' + o.name" :cx="o.x" :cy="o.y" r="9" class="zone" />
    <g v-for="c in coils" :key="c.ch">
      <circle :cx="c.x" :cy="c.y" r="9.5" class="coil" :style="{ fillOpacity: opacity(c) }" />
      <text :x="c.x" :y="c.y + 3.6" class="coil-num">{{ c.ch }}</text>
      <text v-if="labels" :x="c.x" :y="c.y + 19" class="coil-site">{{ c.name }}</text>
    </g>
    <text x="160" y="318" class="caption">10-10 sites seen from above · nose up · left on the left</text>
  </svg>
</template>

<style scoped>
.sitemap { width: 100%; height: auto; display: block; }
.outline { fill: none; stroke: var(--muted); stroke-width: 1.4; }
.ring { fill: none; stroke: var(--line); stroke-width: 1; stroke-dasharray: 2 3; }
.site { fill: var(--muted); }
.site-label { font: 6.5px var(--font-mono); fill: var(--muted); text-anchor: middle; }
.zone { fill: none; stroke: var(--blue); stroke-width: 1.4; stroke-dasharray: 3 2; }
.coil { fill: var(--accent); stroke: var(--accent); stroke-width: 1.4; transition: fill-opacity .08s; }
.coil-num { font: 700 10px var(--font-body); fill: var(--text); text-anchor: middle; }
.coil-site { font: 600 8px var(--font-body); fill: var(--text); text-anchor: middle; }
.caption { font: 9px var(--font-body); fill: var(--muted); text-anchor: middle; }
</style>
