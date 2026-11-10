<script setup lang="ts">
// A live trace of what the coils play: the two signals of the classic
// program, drawn from the same pattern code the helmet runs.
import classic from '../../../../presets/god-helmet-classic.json'
import { parseSession } from '#core/engine/session.js'
import { patternValue } from '#core/engine/patterns.js'
import { describePattern } from '#core/lib/format.js'
import type { Pattern, Session } from '~/lib/model'

const session = parseSession(classic) as Session
const signals = session.phases.map((p) => ({ name: p.name, pattern: p.pattern as Pattern & { sweepMs?: number, gapMs?: number } }))
const index = ref(0)
const signal = computed(() => signals[index.value]!)

const canvas = ref<HTMLCanvasElement>()
const theme = useCanvasTheme(canvas)
const SPAN_MS = 1500 // of signal across the trace
const SPEED = 0.4 // of real time
let clock = 0
let shown = 0

// The signal with its long pauses cut short, so the trace is never empty for seconds.
function value(tMs: number) {
  const p = signal.value.pattern
  if (!p.sweepMs) return patternValue(p, tMs) as number
  const period = p.sweepMs + Math.min(p.gapMs ?? 0, 260)
  const local = ((tMs % period) + period) % period
  return local < p.sweepMs ? (patternValue(p, local) as number) : 0
}

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
  const mid = h / 2
  const amp = h / 2 - 10
  ctx.strokeStyle = theme.line
  ctx.lineWidth = 1
  ctx.setLineDash([2, 5])
  ctx.beginPath()
  ctx.moveTo(0, mid)
  ctx.lineTo(w, mid)
  ctx.stroke()
  ctx.setLineDash([])

  const n = Math.round(w * 1.5)
  const path = new Path2D()
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w
    const y = mid - amp * value(clock - SPAN_MS + (i / n) * SPAN_MS)
    if (i) path.lineTo(x, y)
    else path.moveTo(x, y)
  }
  ctx.strokeStyle = theme.accent
  ctx.lineJoin = 'round'
  // A soft glow under a sharp line; the newest part (right) is brightest.
  const fade = ctx.createLinearGradient(0, 0, w, 0)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(0.5, 'rgba(0,0,0,1)')
  ctx.globalAlpha = 0.22
  ctx.lineWidth = 6
  ctx.stroke(path)
  ctx.globalAlpha = 1
  ctx.lineWidth = 1.6
  ctx.stroke(path)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
}

useFrameLoop(canvas, (_t, dt) => {
  clock += dt * SPEED
  shown += dt
  if (shown > 9000) {
    shown = 0
    index.value = (index.value + 1) % signals.length
  }
  draw()
}, () => {
  clock = 900
  draw()
})
watch(() => theme.accent, draw)
</script>

<template>
  <figure class="m-0 grid gap-3">
    <canvas ref="canvas" class="h-36 w-full" role="img" :aria-label="`Trace of the signal: ${describePattern(signal.pattern)}`" />
    <figcaption class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
      <span class="text-highlighted">{{ describePattern(signal.pattern) }}</span>
      <span class="text-muted">{{ signal.name }}</span>
    </figcaption>
  </figure>
</template>
