<script setup>
// Plots s(t) for one pattern; colours follow the theme tokens.
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { patternValue } from '../engine/patterns.js'

const props = defineProps({
  pattern: { type: Object, required: true },
  ms: { type: Number, default: 0 }, // window length; 0 = pick from the pattern
})

const canvas = ref(null)
let observer = null

function windowMs() {
  if (props.ms) return props.ms
  const p = props.pattern
  if (['chirp', 'burst', 'thomas'].includes(p.type)) return p.sweepMs + Math.min(p.gapMs, 1500) + 200
  if (p.type === 'sine') return Math.max(500, 4000 / Math.max(p.f0, 0.5))
  if (p.type === 'pulse') return 4 * (p.pulseMs + p.gapMs)
  return 1000
}

function draw() {
  const c = canvas.value
  if (!c) return
  const dpr = window.devicePixelRatio || 1
  const w = c.clientWidth
  const h = c.clientHeight
  c.width = Math.round(w * dpr)
  c.height = Math.round(h * dpr)
  const ctx = c.getContext('2d')
  ctx.scale(dpr, dpr)
  const css = getComputedStyle(c)
  const accent = css.getPropertyValue('--accent').trim() || '#e08a4c'
  const line = css.getPropertyValue('--line').trim() || '#333'
  const muted = css.getPropertyValue('--muted').trim() || '#888'
  ctx.clearRect(0, 0, w, h)
  const mid = h / 2
  const amp = h / 2 - 8
  ctx.strokeStyle = line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, mid)
  ctx.lineTo(w, mid)
  ctx.stroke()

  const total = windowMs()
  ctx.strokeStyle = accent
  ctx.lineWidth = 1.5
  ctx.beginPath()
  const n = Math.max(200, Math.round(w * 2))
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * total
    const x = (i / n) * w
    const y = mid - amp * patternValue(props.pattern, t)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.fillStyle = muted
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`${(total / 1000).toFixed(total < 1000 ? 2 : 1)} s`, w - 4, h - 4)
}

onMounted(() => {
  draw()
  observer = new ResizeObserver(draw)
  observer.observe(canvas.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => [props.pattern, props.ms], draw, { deep: true })
</script>

<template>
  <canvas ref="canvas" class="wave" role="img" :aria-label="`Waveform of the ${pattern.type} pattern`"></canvas>
</template>

<style scoped>
.wave { width: 100%; height: 96px; display: block; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; }
</style>
