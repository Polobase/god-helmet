<script setup lang="ts">
// The hero's picture: the field of the coils, made visible. Thousands of
// short streaks follow the field lines of the coils that are on (each coil
// drawn as a dipole pointing into the head), over a map of the head with the
// coils at their real 10-10 sites. `levels` comes from the helmet's engine,
// so the picture is the program that is playing. The pointer is a ninth,
// weak magnet: move it and the field bends.
import { SITES, siteName } from '#core/lib/brain.js'
import { HEAD_CENTRE } from '#core/engine/field.js'
import { makeTopView } from '#core/lib/topview.js'

const props = defineProps<{
  /** Site per coil (null = unused). */
  sites: (string | null)[]
  /** Drive per coil, 0..1, live; null while paused. */
  levels: number[] | null
  /** Coils the current phase uses (0..1 weights), for the resting picture. */
  used: number[]
  direction?: string
  /** Hold the picture still (the Pause button). */
  paused?: boolean
}>()

const root = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const head = ref<HTMLElement>()

// Coil positions on the unit circle of the head map (the same projection SiteMap draws).
const top = makeTopView(SITES, HEAD_CENTRE) as (p: number[]) => [number, number]
const unit = props.sites.map((s) => {
  const p = (SITES as Record<string, number[]>)[siteName(s) ?? '']
  return p ? top(p) : null
})

interface Coil { x: number, y: number, mx: number, my: number }
let coils: (Coil | null)[] = []
let W = 0
let H = 0
let R = 1
let dpr = 1
let raf = 0
let visible = true
let light = false
let color = '#58d1bd'
const env = new Float32Array(8)
const pointer = { x: 0, y: 0, on: false, a: 0 }

// Particles: x, y, life, direction along the field (+1 / -1).
let N = 0
let px = new Float32Array(0)
let py = new Float32Array(0)
let life = new Float32Array(0)
let dir = new Float32Array(0)

function layout() {
  const el = root.value
  const svg = head.value?.querySelector('svg')
  const cv = canvas.value
  if (!el || !svg || !cv) return
  const rr = el.getBoundingClientRect()
  const hr = svg.getBoundingClientRect()
  dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  W = rr.width
  H = rr.height
  cv.width = Math.round(W * dpr)
  cv.height = Math.round(H * dpr)
  // SiteMap's top view: a 340 x 320 box, the head circle r = 100 at (170, 162).
  const s = hr.width / 340
  const cx = hr.left - rr.left + 170 * s
  const cy = hr.top - rr.top + 162 * s
  R = 100 * s
  coils = unit.map((u) => {
    if (!u) return null
    const l = Math.hypot(u[0], u[1]) || 1
    return { x: cx + R * u[0], y: cy + R * u[1], mx: -u[0] / l, my: -u[1] / l }
  })
  const want = Math.round(Math.min(2400, Math.max(500, (W * H) / 520)))
  if (want !== N) {
    N = want
    px = new Float32Array(N)
    py = new Float32Array(N)
    life = new Float32Array(N)
    dir = new Float32Array(N)
    for (let i = 0; i < N; i++) spawn(i, true)
  }
  readTheme()
}

function readTheme() {
  const css = getComputedStyle(root.value!)
  color = css.getPropertyValue('--ui-primary').trim() || color
  const cls = document.documentElement.classList
  light = !cls.contains('dark') && !cls.contains('night')
}

function spawn(i: number, anywhere = false) {
  const live = coils.filter(Boolean) as Coil[]
  if (live.length && Math.random() < 0.72) {
    // Near a coil, more often near one that is on.
    let pick = live[0]!
    let best = -1
    for (let k = 0; k < 3; k++) {
      const j = Math.floor(Math.random() * coils.length)
      const c = coils[j]
      if (c && env[j]! + Math.random() * 0.3 > best) {
        best = env[j]! + Math.random() * 0.3
        pick = c
      }
    }
    const a = Math.random() * Math.PI * 2
    const r = R * (0.08 + Math.random() ** 2 * 1.9)
    px[i] = pick.x + Math.cos(a) * r
    py[i] = pick.y + Math.sin(a) * r
  } else {
    px[i] = Math.random() * W
    py[i] = Math.random() * H
  }
  life[i] = (anywhere ? Math.random() : 1) * (70 + Math.random() * 150)
  dir[i] = Math.random() < 0.5 ? 1 : -1
}

// Field at (x, y): the sum of the coils' dipole fields, in units of the head's radius.
let bx = 0
let by = 0
function field(x: number, y: number) {
  bx = 0
  by = 0
  for (let i = 0; i < coils.length; i++) {
    const c = coils[i]
    const a = env[i]!
    if (!c || a < 0.003) continue
    const dx = (x - c.x) / R
    const dy = (y - c.y) / R
    const d2 = dx * dx + dy * dy + 0.006
    const d = Math.sqrt(d2)
    const rx = dx / d
    const ry = dy / d
    const mr = c.mx * rx + c.my * ry
    const k = a / (d2 * d)
    bx += k * (3 * mr * rx - c.mx)
    by += k * (3 * mr * ry - c.my)
  }
  if (pointer.a > 0.003) {
    const dx = (x - pointer.x) / R
    const dy = (y - pointer.y) / R
    const d2 = dx * dx + dy * dy + 0.02
    const d = Math.sqrt(d2)
    const k = (pointer.a * 0.5) / (d2 * d)
    // A magnet lying flat: its field circles the pointer.
    bx += k * (3 * (dx / d) * (dx / d) - 1)
    by += k * (3 * (dx / d) * (dy / d))
  }
}

const BUCKETS = 5
function step(draw: CanvasRenderingContext2D, fade: number) {
  // What the coils are doing, smoothed: quick to light, slow to fade, and never quite dark.
  for (let i = 0; i < 8; i++) {
    const rest = (props.used[i] ?? 0) > 0 ? 0.1 : 0
    const target = Math.max(props.levels ? Math.min(1, Math.abs(props.levels[i] ?? 0)) : (props.used[i] ?? 0) * 0.5, rest)
    env[i] = env[i]! + (target - env[i]!) * (target > env[i]! ? 0.22 : 0.03)
  }
  pointer.a += ((pointer.on ? 1 : 0) - pointer.a) * 0.06

  draw.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (fade > 0) {
    draw.globalCompositeOperation = 'destination-out'
    draw.globalAlpha = 1
    draw.fillStyle = `rgba(0,0,0,${fade})`
    draw.fillRect(0, 0, W, H)
  }
  draw.globalCompositeOperation = light ? 'source-over' : 'lighter'
  draw.strokeStyle = color
  draw.lineWidth = 1.1
  draw.lineCap = 'round'

  const paths = Array.from({ length: BUCKETS }, () => new Path2D())
  for (let i = 0; i < N; i++) {
    const x = px[i]!
    const y = py[i]!
    field(x, y)
    const mag = Math.hypot(bx, by)
    if (mag < 0.004 || --life[i]! <= 0 || x < -40 || y < -40 || x > W + 40 || y > H + 40) {
      spawn(i)
      continue
    }
    const strength = Math.min(1, Math.log1p(mag * 1.6) / 3.2)
    const speed = 0.55 + 2.4 * strength
    const nx = x + dir[i]! * (bx / mag) * speed
    const ny = y + dir[i]! * (by / mag) * speed
    const young = Math.min(1, life[i]! / 24)
    const b = Math.min(BUCKETS - 1, Math.floor((0.1 + 0.9 * strength) * young * BUCKETS))
    paths[b]!.moveTo(x, y)
    paths[b]!.lineTo(nx, ny)
    px[i] = nx
    py[i] = ny
    // Into a coil's core: start again somewhere else.
    if (mag > 400) life[i] = 0
  }
  for (let b = 0; b < BUCKETS; b++) {
    draw.globalAlpha = (light ? 0.55 : 0.7) * ((b + 1) / BUCKETS) ** 1.5
    draw.stroke(paths[b]!)
  }
}

function frame() {
  raf = 0
  const cv = canvas.value
  if (!cv || !visible || props.paused) return
  step(cv.getContext('2d')!, light ? 0.085 : 0.06)
  raf = requestAnimationFrame(frame)
}
const start = () => !raf && visible && !props.paused && (raf = requestAnimationFrame(frame))
watch(() => props.paused, (p) => !p && start())

function onPointer(e: PointerEvent) {
  const r = root.value?.getBoundingClientRect()
  if (!r) return
  pointer.x = e.clientX - r.left
  pointer.y = e.clientY - r.top
  pointer.on = e.pointerType === 'mouse' && pointer.x >= 0 && pointer.y >= 0 && pointer.x <= r.width && pointer.y <= r.height
}

onMounted(() => {
  layout()
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  const ro = new ResizeObserver(() => {
    layout()
    if (still) drawStill()
  })
  ro.observe(root.value!)
  const mo = new MutationObserver(() => {
    readTheme()
    if (still) drawStill()
  })
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  // For people who asked for less motion: one still picture of the field lines.
  function drawStill() {
    const draw = canvas.value!.getContext('2d')!
    draw.setTransform(1, 0, 0, 1, 0, 0)
    draw.clearRect(0, 0, canvas.value!.width, canvas.value!.height)
    for (let i = 0; i < 8; i++) env[i] = (props.used[i] ?? 0) > 0 ? 0.6 : 0
    for (let k = 0; k < 160; k++) step(draw, 0)
  }
  if (still) {
    drawStill()
    onBeforeUnmount(() => (ro.disconnect(), mo.disconnect()))
    return
  }

  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting
    start()
  })
  io.observe(root.value!)
  window.addEventListener('pointermove', onPointer, { passive: true })
  start()
  onBeforeUnmount(() => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    mo.disconnect()
    io.disconnect()
    window.removeEventListener('pointermove', onPointer)
  })
})
</script>

<template>
  <div ref="root" class="stage" aria-hidden="true">
    <canvas ref="canvas" class="absolute inset-0 size-full" />
    <div ref="head" class="head">
      <SiteMap :sites="sites" :used="levels ? undefined : used" :levels="levels ?? undefined" :direction="direction" :caption="false" />
    </div>
  </div>
</template>

<style scoped>
.stage { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
/* The streaks fade out toward the edges of the hero. */
.stage canvas { mask-image: radial-gradient(120% 90% at 68% 50%, #000 45%, transparent 96%); }
.head { position: absolute; width: min(31rem, 40vw); right: max(1.5rem, calc((100vw - 80rem) / 2 + 2.5rem)); top: 50%; transform: translateY(-53%); }
/* The head is glass here: the field shows through it. */
.head :deep(.hl.head) { fill: color-mix(in oklab, var(--surface-2) 30%, transparent); }
.head :deep(.site) { opacity: 0.45; }
@media (max-width: 1023px) {
  .stage canvas { mask-image: radial-gradient(130% 70% at 50% 72%, #000 40%, transparent 95%); }
  .head { width: min(21rem, 80vw); right: auto; left: 50%; top: auto; bottom: 9.5rem; transform: translateX(-50%); }
}
</style>
