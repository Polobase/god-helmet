<script setup lang="ts">
// The earth's field lines: quiet on the left; on the right the same lines,
// pulled out and shaken. A line is a loop from near one pole to near the other.
type P = [number, number]
const CX = 120

function loop(side: -1 | 1, from: P, pull: P, ripple: number, waves: number): string {
  // A cubic curve, the same above and below the equator (y = 58), mirrored for the right side.
  const ctrl: P[] = [from, pull, [pull[0], 116 - pull[1]], [from[0], 116 - from[1]]]
  const xs = ctrl.map(([x]) => CX + side * (CX - x))
  const ys = ctrl.map(([, y]) => y)
  const bez = (v: number[], t: number) => (1 - t) ** 3 * v[0]! + 3 * (1 - t) ** 2 * t * v[1]! + 3 * (1 - t) * t * t * v[2]! + t ** 3 * v[3]!
  // `ripple` moves the points off the curve, most in the middle of the loop.
  const n = ripple ? 72 : 24
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const [t1, t2] = [Math.max(0, t - 0.01), Math.min(1, t + 0.01)]
    const dx = bez(xs, t2) - bez(xs, t1)
    const dy = bez(ys, t2) - bez(ys, t1)
    const off = (ripple * Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * waves * t)) / (Math.hypot(dx, dy) || 1)
    return `${(bez(xs, t) - dy * off).toFixed(1)} ${(bez(ys, t) + dx * off).toFixed(1)}`
  })
  return `M ${pts.join(' L ')}`
}
const calm = [loop(-1, [112, 37], [74, 22], 0, 0), loop(-1, [106, 33], [36, 2], 0, 0)]
const storm = [loop(1, [112, 37], [62, 22], 2, 4), loop(1, [106, 33], [8, 4], 3.2, 5)]
</script>

<template>
  <g>
    <!-- the earth -->
    <circle cx="120" cy="58" r="22" />
    <ellipse cx="120" cy="58" rx="9.5" ry="22" />
    <path d="M 98 58 H 142 M 102 45.5 Q 120 49.5 138 45.5 M 102 70.5 Q 120 66.5 138 70.5" />
    <g class="art-a">
      <path v-for="d in calm" :key="d" class="art-dots art-march" style="--art-t: 2.6s" :d="d" />
      <g class="art-geo-storm">
        <path v-for="d in storm" :key="d" class="art-dots art-march" style="--art-t: 0.6s" :d="d" />
      </g>
    </g>
    <!-- someone asleep under it -->
    <ArtKitBed :x="118" :y="128" :w="76" />
    <ArtKitPerson :x="124" :y="128" :s="0.8" pose="lie" />
  </g>
</template>

<style>
@media (prefers-reduced-motion: no-preference) {
  .art[data-art] .art-geo-storm { transform-origin: 120px 58px; animation: art-geo-storm 2.6s ease-in-out infinite; }
}
@keyframes art-geo-storm {
  0%, 100% { transform: skewY(0deg) scaleX(1); }
  30% { transform: skewY(-2.2deg) scaleX(1.05); }
  65% { transform: skewY(1.6deg) scaleX(0.97); }
}
</style>
