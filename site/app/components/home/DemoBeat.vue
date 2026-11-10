<script setup lang="ts">
// What the guides' audio does: a slightly different tone in each ear, and
// the slow beat between them. Drawn, not played; the tones are slowed down
// so their waves can be seen.
const canvas = ref<HTMLCanvasElement>()
const theme = useCanvasTheme(canvas)
const LEFT_HZ = 200
const RIGHT_HZ = 204
let phase = 0

function draw() {
  const c = canvas.value
  if (!c) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = c.clientWidth
  const h = c.clientHeight
  if (c.width !== Math.round(w * dpr)) {
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
  }
  const ctx = c.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  // Half a second of sound across the picture, the tones drawn 10 times slower.
  const SPAN_S = 0.5
  const wave = (hz: number, x: number) => Math.sin(2 * Math.PI * (hz / 10) * ((x / w) * SPAN_S) + phase * (hz / LEFT_HZ))
  const rows = [
    { y: h * 0.17, amp: h * 0.1, f: (x: number) => wave(LEFT_HZ, x), alpha: 0.55 },
    { y: h * 0.42, amp: h * 0.1, f: (x: number) => wave(RIGHT_HZ, x), alpha: 0.55 },
    { y: h * 0.77, amp: h * 0.095, f: (x: number) => wave(LEFT_HZ, x) + wave(RIGHT_HZ, x), alpha: 1 },
  ]
  ctx.lineJoin = 'round'
  for (const r of rows) {
    ctx.beginPath()
    for (let x = 0; x <= w; x += 1.5) {
      const y = r.y - r.amp * r.f(x)
      if (x) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.strokeStyle = theme.accent
    ctx.globalAlpha = r.alpha
    ctx.lineWidth = r.alpha === 1 ? 1.7 : 1.1
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

useFrameLoop(canvas, (_t, dt) => {
  phase -= dt * 0.004
  draw()
}, draw)
watch(() => theme.accent, draw)
</script>

<template>
  <figure class="relative m-0">
    <canvas ref="canvas" class="h-44 w-full" role="img" :aria-label="`Two tones, ${LEFT_HZ} Hz in the left ear and ${RIGHT_HZ} Hz in the right, and the ${RIGHT_HZ - LEFT_HZ} Hz beat between them`" />
    <figcaption class="pointer-events-none absolute inset-0 text-xs text-muted">
      <span class="tag" style="top: 0">Left ear, {{ LEFT_HZ }} Hz</span>
      <span class="tag" style="top: 26%">Right ear, {{ RIGHT_HZ }} Hz</span>
      <span class="tag text-highlighted" style="top: 57%">Together: a {{ RIGHT_HZ - LEFT_HZ }} Hz beat</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.tag { position: absolute; left: 0; padding: 0 0.4rem 0 0; background: linear-gradient(90deg, var(--panel-bottom) 70%, transparent); }
</style>
