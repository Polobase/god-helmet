<script setup lang="ts">
// The lab's ring of eight coils ("the Octopus"), seen from above. The field
// steps from coil to coil counter-clockwise, and each step is a little shorter
// than the last ("20+2": 20, 18, 16 ... 6 ms). Here a turn that speeds up is
// followed by one that slows down again, at one fortieth of the speed.
import { ringPoint } from '~/lib/art'

const CX = 120
const CY = 66
const R = 43
const UNIT = 0.04 // seconds on screen per millisecond of the lab's schedule
const DWELL = [20, 18, 16, 14, 12, 10, 8, 6, 6, 8, 10, 12, 14, 16, 18, 20]
const TOTAL = DWELL.reduce((a, b) => a + b, 0)
const starts = DWELL.map((_, i) => DWELL.slice(0, i).reduce((a, b) => a + b, 0))

const coil = (i: number) => {
  const [x, y] = ringPoint(i % 8, R)
  return { cx: CX + x, cy: CY + y }
}
const steps = starts.map((t, i) => ({ i, ...coil(i), delay: `${(t * UNIT).toFixed(2)}s` }))

// The same schedule as a row of ticks: close together where the steps are short.
const X0 = 36
const W = 168
const tickX = (t: number) => Number((X0 + (t / TOTAL) * W).toFixed(1))
const ticks = [...starts, TOTAL].map((t) => `M ${tickX(t)} 142 v 6`).join(' ')

// Which way round: an arc inside the head, with an arrowhead at its end.
const at = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180
  return `${(CX + r * Math.sin(a)).toFixed(1)} ${(CY - r * Math.cos(a)).toFixed(1)}`
}
const turn = `M ${at(-40, 29)} A 29 29 0 0 0 ${at(-158, 29)}`
const arrow = `M ${at(-147, 33.2)} L ${at(-158, 29)} L ${at(-149, 24.4)}`
</script>

<template>
  <g :style="{ '--art-ring-t': `${(TOTAL * UNIT).toFixed(2)}s`, '--art-pt': '5.5px' }">
    <ArtKitHeadTop :x="CX" :y="CY" :r="R" />
    <path :d="`M ${X0} 145 H ${X0 + W}`" />
    <path :d="ticks" />
    <g class="art-a">
      <path class="art-dots" :d="turn" />
      <path :d="arrow" />
      <!-- the still picture: the field at the third coil, fading behind it -->
      <g class="art-still">
        <circle v-bind="coil(2)" r="8.5" class="art-dash" />
        <circle v-bind="coil(2)" r="14.5" class="art-dash" />
        <circle v-bind="coil(1)" r="8.5" class="art-dash" opacity="0.5" />
        <circle v-bind="coil(0)" r="8.5" class="art-dash" opacity="0.22" />
        <path class="art-pt" :d="`M ${tickX(starts[2]!)} 136 h 0.01`" />
      </g>
      <g class="art-live">
        <g v-for="s in steps" :key="s.i" class="art-ring-step" :style="{ animationDelay: s.delay }">
          <circle :cx="s.cx" :cy="s.cy" r="8.5" class="art-dash" />
          <circle :cx="s.cx" :cy="s.cy" r="14.5" class="art-dash" />
        </g>
        <path class="art-pt art-ring-head" :d="`M ${X0} 136 h 0.01`" />
      </g>
    </g>
  </g>
</template>

<style>
.art .art-ring-step { opacity: 0; transform-box: fill-box; transform-origin: center; }
@media (prefers-reduced-motion: no-preference) {
  .art[data-art] .art-ring-step { animation: art-ring-step var(--art-ring-t) linear infinite; }
  .art[data-art] .art-ring-head { animation: art-ring-head var(--art-ring-t) linear infinite; }
}
@keyframes art-ring-step {
  0% { opacity: 0; transform: scale(0.72); }
  0.7% { opacity: 1; transform: scale(0.8); }
  3% { opacity: 1; }
  11% { opacity: 0; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(1.2); }
}
@keyframes art-ring-head { to { transform: translateX(168px); } }
</style>
