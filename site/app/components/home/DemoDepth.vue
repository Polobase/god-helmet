<script setup lang="ts">
// How fast the field falls off with depth: the on-axis field of one coil,
// from the same coil model the brain view uses, scaled to 1 µT at 20 mm
// (where the programs' intensity is defined). Move across it to read a depth.
import { onAxisUtPerMa } from '#core/engine/field.js'

const MIN = 8
const MAX = 80
const W = 320
const H = 150
const ref20 = onAxisUtPerMa(20) as number
const at = (mm: number) => (onAxisUtPerMa(mm) as number) / ref20
const TOP = at(MIN)
const x = (mm: number) => ((mm - MIN) / (MAX - MIN)) * W
const y = (uT: number) => H - 6 - (uT / TOP) * (H - 16)
const path = Array.from({ length: 73 }, (_, i) => MIN + i).map((mm, i) => `${i ? 'L' : 'M'}${x(mm).toFixed(1)},${y(at(mm)).toFixed(1)}`).join(' ')

const depth = ref(20)
const value = computed(() => at(depth.value))
const svg = ref<SVGSVGElement>()
function move(e: PointerEvent) {
  const r = svg.value!.getBoundingClientRect()
  depth.value = Math.round(Math.min(MAX, Math.max(MIN, MIN + ((e.clientX - r.left) / r.width) * (MAX - MIN))))
}
const fmt = (uT: number) => (uT >= 1 ? uT.toFixed(1) : uT.toFixed(2))
</script>

<template>
  <figure class="m-0 grid gap-2">
    <p class="flex items-baseline justify-between gap-3 text-sm">
      <span class="text-muted">At <b class="num text-highlighted">{{ depth }} mm</b> below the coil</span>
      <b class="num font-display text-2xl text-highlighted">{{ fmt(value) }} <span class="text-sm font-normal text-muted">µT</span></b>
    </p>
    <svg ref="svg" :viewBox="`0 0 ${W} ${H}`" class="w-full touch-pan-y overflow-visible" role="img"
      :aria-label="`Field against depth: 1 µT at 20 mm, ${fmt(at(40))} µT at 40 mm, ${fmt(at(60))} µT at 60 mm`" @pointermove="move" @pointerdown="move">
      <defs>
        <linearGradient id="depth-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--ui-primary)" stop-opacity=".28" />
          <stop offset="1" stop-color="var(--ui-primary)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path :d="`${path} L${W},${H} L0,${H} Z`" fill="url(#depth-fill)" />
      <path :d="path" fill="none" stroke="var(--ui-primary)" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      <line :x1="x(depth)" :x2="x(depth)" y1="0" :y2="H" stroke="var(--ui-border-accented)" stroke-dasharray="2 4" vector-effect="non-scaling-stroke" />
      <circle :cx="x(depth)" :cy="y(value)" r="4.5" fill="var(--ui-bg)" stroke="var(--ui-primary)" stroke-width="2" />
    </svg>
    <figcaption class="flex justify-between text-xs text-muted"><span>{{ MIN }} mm</span><span>a program's strength is set at 20 mm</span><span>{{ MAX }} mm</span></figcaption>
  </figure>
</template>
