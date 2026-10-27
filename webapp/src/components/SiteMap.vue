<script setup>
// 10-10 map of the head from the MNI 10-05 positions.
// Top: seen from above (nose up, your left on the left), azimuthal around the
// vertex like an EEG topoplot: the circle is the band line through Fpz, T7, Oz
// and T8; sites below the band (T9, Iz ...) fall outside it.
// Left / right: seen from that side (orthographic), band line dashed.
// Coils are numbered discs; `levels` (live, 0..1) or `used` (weights) set how
// bright each one is.
import { computed, nextTick, ref } from 'vue'
import { SITES, siteName } from '../lib/brain.js'
import { HEAD_CENTRE } from '../engine/field.js'

const props = defineProps({
  sites: { type: Array, default: () => [] }, // 8 names or null
  used: { type: Array, default: null }, // static weights 0..1
  levels: { type: Array, default: null }, // live 0..1
  highlight: { type: Array, default: () => [] }, // extra site names to outline (e.g. a zone)
  labels: { type: Boolean, default: true }, // site name next to each coil
  view: { type: String, default: 'top' }, // top | left | right
  gridLabels: { type: Boolean, default: false }, // name every 10-10 site
  selectable: { type: Boolean, default: false }, // grid sites are buttons (emit 'site')
  coilButtons: { type: Boolean, default: false }, // coils are buttons (emit 'coil')
  selected: { type: String, default: null }, // site to ring
  checked: { type: Array, default: null }, // coils ticked as placed
  focus: { type: Number, default: null }, // channel index to emphasise
  compact: { type: Boolean, default: false }, // thumbnail: no labels, no caption
  caption: { type: Boolean, default: true },
  measure: { type: Boolean, default: false }, // side view: number the three tape lines
  direction: { type: String, default: null }, // 'ccw' | 'cw' rotation arrow (top view)
})
const emit = defineEmits(['site', 'coil'])

const TEN_TEN = /^(Fp|AF|F|FT|FC|T|C|TP|CP|P|PO|O|I)(z|\d+)$/
const BAND = ['Fpz', 'Fp1', 'AF7', 'F7', 'FT7', 'T7', 'TP7', 'P7', 'PO7', 'O1', 'Oz', 'O2', 'PO8', 'P8', 'TP8', 'T8', 'FT8', 'F8', 'AF8', 'Fp2']
const MIDLINE = ['Nz', 'Fpz', 'AFz', 'Fz', 'FCz', 'Cz', 'CPz', 'Pz', 'POz', 'Oz', 'Iz']
const sub = (a, b) => a.map((v, i) => v - b[i])
const unit = (a) => {
  const l = Math.hypot(...a)
  return a.map((v) => v / l)
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const r1 = (v) => Math.round(v * 10) / 10

// ---------------------------------------------------------------- top view
const C = HEAD_CENTRE
const up = unit(sub(SITES.Cz, C))
const front = unit(sub(sub(SITES.Fpz, C), up.map((v) => v * dot(sub(SITES.Fpz, C), up))))
const right = cross(front, up)
const polar = (p) => Math.acos(Math.max(-1, Math.min(1, dot(unit(sub(p, C)), up))))
const BAND_POLAR = BAND.reduce((s, n) => s + polar(SITES[n]), 0) / BAND.length
const R = 100 // the band circle
const TOP = { w: 340, h: 320, cx: 170, cy: 162 }
function topXY(p) {
  const d = unit(sub(p, C))
  const r = (polar(p) / BAND_POLAR) * R
  const phi = Math.atan2(dot(d, right), dot(d, front))
  return [TOP.cx + r * Math.sin(phi), TOP.cy - r * Math.cos(phi)]
}

// ---------------------------------------------------------------- side views
const all = Object.values(SITES)
const YC = (Math.max(...all.map((p) => p[1])) + Math.min(...all.map((p) => p[1]))) / 2
const ZC = (Math.max(...all.map((p) => p[2])) + Math.min(...all.map((p) => p[2]))) / 2
const SIDE = { w: 340, h: 250, cx: 170, cy: 122, s: 1.3 }
const sideXY = (p, view) => [SIDE.cx + SIDE.s * (view === 'left' ? YC - p[1] : p[1] - YC), SIDE.cy - SIDE.s * (p[2] - ZC)]
const onSide = (p, view) => (view === 'left' ? p[0] <= 12 : p[0] >= -12)

function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const p of pts) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper = []
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}
// Closed Catmull-Rom curve through points, as a path.
function smooth(pts) {
  const n = pts.length
  const f = (p) => `${r1(p[0])},${r1(p[1])}`
  let d = `M${f(pts[0])}`
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]]
    d += ` C${f([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${f([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${f(p2)}`
  }
  return `${d}Z`
}
// Open Catmull-Rom curve through "x,y" points (a polyline string).
function smoothOpen(points) {
  const pts = points.split(' ').filter(Boolean).map((p) => p.split(',').map(Number))
  if (pts.length < 3) return pts.length ? `M${points.split(' ').join(' L')}` : ''
  const f = (p) => `${r1(p[0])},${r1(p[1])}`
  let d = `M${f(pts[0])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const [p1, p2] = [pts[i], pts[i + 1]]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    d += ` C${f([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${f([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${f(p2)}`
  }
  return d
}
function silhouette(view) {
  const h = hull(all.map((p) => sideXY(p, view)))
  const cx = h.reduce((s, p) => s + p[0], 0) / h.length
  const cy = h.reduce((s, p) => s + p[1], 0) / h.length
  return smooth(h.map(([x, y]) => {
    const l = Math.hypot(x - cx, y - cy)
    return [x + ((x - cx) / l) * 10, y + ((y - cy) / l) * 10]
  }))
}
const SIL = { left: silhouette('left'), right: silhouette('right') }

// ---------------------------------------------------------------- drawing
const box = computed(() => (props.view === 'top' ? TOP : SIDE))
const xy = (p) => (props.view === 'top' ? topXY(p) : sideXY(p, props.view))
const visible = (p) => props.view === 'top' || onSide(p, props.view)
const at = (name) => {
  const [x, y] = xy(SITES[name])
  return { name, x, y }
}

// Name sites without overlapping labels: midline first, then outward (in the
// side views the sites near the midline crowd together).
const grid = computed(() => {
  const pts = Object.keys(SITES).filter((n) => TEN_TEN.test(n) && visible(SITES[n])).map((n) => ({ ...at(n), named: false }))
  const order = [...pts].sort((a, b) => b.name.endsWith('z') - a.name.endsWith('z') || Math.abs(SITES[b.name][0]) - Math.abs(SITES[a.name][0]))
  const kept = []
  for (const p of order) {
    if (kept.some((q) => Math.abs(q.x - p.x) < (props.selectable ? 22 : 17) && Math.abs(q.y - p.y) < (props.selectable ? 14 : 12))) continue
    p.named = true
    kept.push(p)
  }
  return pts
})
const line = (names) => names.filter((n) => visible(SITES[n])).map((n) => xy(SITES[n]).map(r1).join(',')).join(' ')
const guides = computed(() => {
  if (props.view === 'top') {
    const [lx] = topXY(SITES.T9)
    const [rx] = topXY(SITES.T10)
    return { earL: Math.min(lx, TOP.cx - R - 8), earR: Math.max(rx, TOP.cx + R + 8) }
  }
  const side = props.view === 'left' ? 'left' : 'right'
  const ring = side === 'left' ? BAND.slice(0, 11) : ['Fpz', ...BAND.slice(10).reverse()]
  const coronal = side === 'left' ? ['T9', 'T7', 'C5', 'C3', 'C1', 'Cz'] : ['T10', 'T8', 'C6', 'C4', 'C2', 'Cz']
  // The ear point of the tape rules is T9/T10 (front root of the tragus): the ear sits just behind it.
  const ear = xy(SITES[side === 'left' ? 'T9' : 'T10'])
  const nz = xy(SITES.Nz)
  const iz = xy(SITES.Iz)
  const dir = side === 'left' ? -1 : 1
  return {
    band: smoothOpen(line(ring)),
    midline: smoothOpen(line(MIDLINE)),
    coronal: smoothOpen(line(coronal)),
    ear: { x: ear[0] - dir * 10, y: ear[1] - 8 },
    earLabel: { x: ear[0] - dir * 10, y: ear[1] + 34 },
    nose: `M${r1(nz[0] + dir * 6)},${r1(nz[1] - 8)} Q${r1(nz[0] + dir * 2)},${r1(nz[1] + 4)} ${r1(nz[0] + dir * 14)},${r1(nz[1] + 24)} L${r1(nz[0] + dir * 4)},${r1(nz[1] + 28)}`,
    nz: { x: nz[0] - dir * 8, y: nz[1] + 42 },
    iz: { x: iz[0], y: iz[1] + 30 },
    badges: [['Fz', 1], [side === 'left' ? 'C3' : 'C4', 2], [side === 'left' ? 'TP7' : 'TP8', 3]].map(([n, k]) => {
      const [x, y] = xy(SITES[n])
      return { k, x, y }
    }),
  }
})

// Rotation arrow over the front of the head, seen from above.
const arrow = computed(() => {
  if (props.view !== 'top' || !['ccw', 'cw'].includes(props.direction)) return null
  const r = 62
  const ccw = props.direction === 'ccw'
  const [a0, a1] = ccw ? [35, 145] : [145, 35]
  const pt = (deg) => [TOP.cx + r * Math.cos((deg * Math.PI) / 180), TOP.cy - r * Math.sin((deg * Math.PI) / 180)]
  const [x0, y0] = pt(a0)
  const [x1, y1] = pt(a1)
  const t = (a1 * Math.PI) / 180
  const dir = ccw ? [-Math.sin(t), -Math.cos(t)] : [Math.sin(t), Math.cos(t)]
  const tip = [x1 + dir[0] * 7, y1 + dir[1] * 7]
  const head = [tip, [x1 - dir[1] * 5, y1 + dir[0] * 5], [x1 + dir[1] * 5, y1 - dir[0] * 5]]
  return {
    d: `M${r1(x0)} ${r1(y0)} A${r} ${r} 0 0 ${ccw ? 0 : 1} ${r1(x1)} ${r1(y1)}`,
    head: head.map((p) => p.map(r1).join(',')).join(' '),
    label: ccw ? 'counter-clockwise' : 'clockwise',
  }
})

const coils = computed(() =>
  props.sites.map((s, i) => {
    const name = siteName(s)
    if (!name || !visible(SITES[name])) return null
    const live = props.levels ? Math.min(1, Math.abs(props.levels[i] ?? 0)) : null
    const weight = props.used ? props.used[i] ?? 0 : 1
    return { ch: i + 1, i, ...at(name), live, weight, done: Boolean(props.checked?.[i]) }
  }).filter(Boolean),
)
const coilNames = computed(() => new Set(coils.value.map((c) => c.name)))
const outlined = computed(() => [...new Set(props.highlight.map(siteName))].filter((n) => n && visible(SITES[n])).map(at))
const sel = computed(() => {
  const n = siteName(props.selected)
  return n && visible(SITES[n]) ? at(n) : null
})
// Ringed sites get their label in a layer above the rings.
const ringed = computed(() => {
  const out = new Map(outlined.value.map((o) => [o.name, o]))
  if (sel.value) out.set(sel.value.name, sel.value)
  return [...out.values()].filter((o) => !coilNames.value.has(o.name))
})
const ringedNames = computed(() => new Set(ringed.value.map((o) => o.name)))
// Landmark text is hidden where a coil label would sit on it.
const clear = (x, y) => !coils.value.some((c) => Math.abs(c.x - x) < 26 && Math.abs(c.y + coilR.value + 10 - y) < 12)

// Selectable map: a tap picks the nearest site (small dots are hard to hit),
// one Tab stop, arrow keys move to the nearest site in that direction.
const svgEl = ref(null)
function tap(e) {
  if (!props.selectable) return
  const svg = svgEl.value
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const m = svg.getScreenCTM()
  if (!m) return
  const p = pt.matrixTransform(m.inverse())
  let best = null
  for (const g of grid.value) {
    const d = Math.hypot(g.x - p.x, g.y - p.y)
    if (d < 16 && (!best || d < best.d)) best = { g, d }
  }
  if (best) emit('site', best.g.name)
}
const tabStop = computed(() => (sel.value && grid.value.some((g) => g.name === sel.value.name) ? sel.value.name : grid.value[0]?.name))
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
function siteKey(e, s) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('site', s.name)
    return
  }
  const d = ARROWS[e.key]
  if (!d) return
  e.preventDefault()
  let best = null
  for (const g of grid.value) {
    const dx = g.x - s.x
    const dy = g.y - s.y
    const along = dx * d[0] + dy * d[1]
    if (along <= 2) continue
    const score = along + 2.5 * Math.abs(dx * d[1] - dy * d[0])
    if (!best || score < best.score) best = { g, score }
  }
  if (!best) return
  emit('site', best.g.name)
  nextTick(() => svgEl.value?.querySelector(`[data-site="${best.g.name}"]`)?.focus())
}
const opacity = (c) => (c.live !== null ? 0.12 + 0.88 * c.live : c.weight > 0 ? 0.3 + 0.5 * c.weight : 0.06)
const coilR = computed(() => (props.compact ? 22 : 10))
const interactive = computed(() => props.selectable || props.coilButtons)

const describe = computed(() => {
  const where = (props.view === 'top' ? 'seen from above' : `seen from the ${props.view}`) + (arrow.value ? `, field steps ${arrow.value.label}` : '')
  const list = coils.value.map((c) => `CH${c.ch} ${c.name}`).join(', ')
  return `Head map ${where}${list ? `, coils at ${list}` : ''}`
})
const CAPTIONS = {
  top: 'Seen from above, nose up, your left on the left. The circle is the band line (Fpz – T7 – Oz – T8); sites outside it sit below the band.',
  left: 'Left side, nose to the left. Dashed: the band line. Coils on the right side are in the right view.',
  right: 'Right side, nose to the right. Dashed: the band line. Coils on the left side are in the left view.',
}
const captionText = computed(() => (props.selectable && props.view !== 'top'
  ? `${props.view === 'left' ? 'Left side, nose to the left' : 'Right side, nose to the right'}. Dashed: the band line. Sites on the other side are in the ${props.view === 'left' ? 'right' : 'left'} view.`
  : CAPTIONS[props.view]))
const press = (e, fn) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}
</script>

<template>
  <figure class="sitemap-fig" :class="{ compact }">
    <svg ref="svgEl" :viewBox="`0 0 ${box.w} ${box.h}`" class="sitemap" :class="{ selectable }" :role="interactive ? 'group' : 'img'" :aria-label="describe" @click="tap">
      <template v-if="view === 'top'">
        <path :d="`M${TOP.cx - 13} ${TOP.cy - R + 1} L${TOP.cx} ${TOP.cy - R - 17} L${TOP.cx + 13} ${TOP.cy - R + 1}`" class="outline" />
        <ellipse :cx="guides.earL" :cy="TOP.cy" rx="7" ry="18" class="outline" />
        <ellipse :cx="guides.earR" :cy="TOP.cy" rx="7" ry="18" class="outline" />
        <circle :cx="TOP.cx" :cy="TOP.cy" :r="R" class="outline head" />
        <line :x1="TOP.cx" :y1="TOP.cy - R" :x2="TOP.cx" :y2="TOP.cy + R" class="guide" />
        <line :x1="TOP.cx - R" :y1="TOP.cy" :x2="TOP.cx + R" :y2="TOP.cy" class="guide" />
        <g v-if="arrow">
          <path :d="arrow.d" class="dir" />
          <polygon :points="arrow.head" class="dir-head" />
          <text :x="TOP.cx" :y="TOP.cy - 70" class="landmark">{{ arrow.label }}</text>
        </g>
      </template>
      <template v-else>
        <path :d="SIL[view]" class="outline head" />
        <path :d="guides.nose" class="outline" />
        <ellipse :cx="guides.ear.x" :cy="guides.ear.y" rx="9" ry="20" class="outline ear" />
        <path :d="guides.midline" :class="measure ? 'tape m1' : 'guide'" />
        <path :d="guides.coronal" :class="measure ? 'tape m2' : 'guide'" />
        <path :d="guides.band" :class="measure ? 'tape m3' : 'band'" />
        <g v-for="b in measure ? guides.badges : []" :key="b.k">
          <circle :cx="b.x" :cy="b.y" r="9" :class="`badge m${b.k}`" />
          <text :x="b.x" :y="b.y + 3.6" class="badge-num">{{ b.k }}</text>
        </g>
        <template v-if="!compact">
          <text v-if="clear(guides.nz.x, guides.nz.y)" :x="guides.nz.x" :y="guides.nz.y" class="landmark">nasion</text>
          <text v-if="clear(guides.iz.x, guides.iz.y)" :x="guides.iz.x" :y="guides.iz.y" class="landmark">inion</text>
          <text v-if="clear(guides.earLabel.x, guides.earLabel.y)" :x="guides.earLabel.x" :y="guides.earLabel.y" class="landmark">ear point</text>
        </template>
      </template>

      <circle v-for="o in outlined" :key="'o' + o.name" :cx="o.x" :cy="o.y" r="9" class="zone" />
      <circle v-if="sel" :cx="sel.x" :cy="sel.y" r="8" class="selected" />
      <g v-for="s in grid" :key="s.name" class="site-g" :class="{ pick: selectable }" :data-site="selectable ? s.name : undefined"
        :tabindex="selectable ? (s.name === tabStop ? 0 : -1) : undefined" :role="selectable ? 'button' : undefined"
        :aria-label="selectable ? `Site ${s.name}` : undefined" :aria-pressed="selectable ? s.name === selected : undefined"
        @keydown="selectable && siteKey($event, s)">
        <circle v-if="selectable" :cx="s.x" :cy="s.y" r="8" class="hit" />
        <circle :cx="s.x" :cy="s.y" :r="compact ? 2.6 : 1.9" class="site" />
        <text v-if="!compact && (gridLabels || selectable) && s.named && !coilNames.has(s.name) && !ringedNames.has(s.name)" :x="s.x" :y="s.y - 4" class="site-label">{{ s.name }}</text>
      </g>
      <text v-for="o in ringed" :key="'rl' + o.name" :x="o.x" :y="o.y - 12" class="site-label ringed">{{ o.name }}</text>

      <g v-for="c in coils" :key="c.ch" class="coil-g" :class="{ done: c.done, btn: coilButtons }"
        :tabindex="coilButtons ? 0 : undefined" :role="coilButtons ? 'button' : undefined"
        :aria-label="coilButtons ? `Coil ${c.ch} at ${c.name}${c.done ? ', placed' : ''}` : undefined"
        @click="coilButtons && emit('coil', c.i)" @keydown="coilButtons && press($event, () => emit('coil', c.i))">
        <circle v-if="focus === c.i" :cx="c.x" :cy="c.y" :r="coilR + 6" class="focus-ring" />
        <circle :cx="c.x" :cy="c.y" :r="coilR" class="coil" :style="{ fillOpacity: c.done ? 1 : opacity(c) }" />
        <text :x="c.x" :y="c.y + (compact ? 7.5 : 3.7)" class="coil-num" :class="{ big: compact }">{{ c.ch }}</text>
        <text v-if="labels && !compact" :x="c.x" :y="c.y + coilR + 10" class="coil-site">{{ c.name }}</text>
      </g>
    </svg>
    <figcaption v-if="caption && !compact" class="small muted">{{ captionText }}</figcaption>
  </figure>
</template>

<style scoped>
.sitemap-fig { margin: 0; display: grid; gap: 6px; min-width: 0; }
.sitemap { width: 100%; height: auto; display: block; overflow: visible; }
.outline { fill: none; stroke: var(--muted); stroke-width: 1.4; stroke-linejoin: round; }
.outline.head { fill: var(--surface-2); }
.ear { fill: var(--surface); }
.guide { fill: none; stroke: var(--line); stroke-width: 1; stroke-dasharray: 2 3; }
.band { fill: none; stroke: var(--blue); stroke-width: 1.6; stroke-dasharray: 5 4; opacity: .8; }
.site { fill: var(--muted); opacity: .8; }
.site-label { font: 6.5px var(--font-mono); fill: var(--muted); text-anchor: middle; pointer-events: none; }
.selectable .site-label { font-size: 8px; }
.site-label.ringed { fill: var(--text); font-weight: 700; paint-order: stroke; stroke: var(--surface-2); stroke-width: 3px; }
.tape { fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.tape.m1, .badge.m1 { stroke: var(--accent); }
.tape.m2, .badge.m2 { stroke: var(--ok); }
.tape.m3, .badge.m3 { stroke: var(--blue); }
.badge { fill: var(--surface); stroke-width: 2; }
.badge-num { font: 700 10px var(--font-body); fill: var(--text); text-anchor: middle; }
.dir { fill: none; stroke: var(--blue); stroke-width: 2; }
.dir-head { fill: var(--blue); }
.landmark { font: italic 8.5px var(--font-body); fill: var(--muted); text-anchor: middle; }
.pick { cursor: pointer; outline: none; }
.pick .hit { fill: transparent; }
.pick:hover .site, .pick:focus-visible .site { fill: var(--accent); opacity: 1; }
.pick:hover .site-label, .pick:focus-visible .site-label { fill: var(--text); font-weight: 700; }
.pick:focus-visible .hit { stroke: var(--accent); stroke-width: 1.5; }
.zone { fill: none; stroke: var(--blue); stroke-width: 1.5; stroke-dasharray: 3 2; pointer-events: none; }
.selected { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; pointer-events: none; }
.coil { fill: var(--accent); stroke: var(--accent); stroke-width: 1.4; transition: fill-opacity .08s; }
.coil-g.done .coil { stroke: var(--ok); stroke-width: 2.6; }
.coil-g.btn { cursor: pointer; outline: none; }
.coil-g.btn:focus-visible .coil { stroke: var(--text); stroke-width: 2.4; }
.focus-ring { fill: none; stroke: var(--accent); stroke-width: 2; animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .25; } }
.coil-num { font: 700 10px var(--font-body); fill: var(--text); text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: var(--surface-2); stroke-width: 2.5px; stroke-linejoin: round; }
.coil-g.done .coil-num { fill: var(--accent-ink); stroke: none; }
.coil-num.big { font-size: 21px; stroke-width: 4px; }
.compact .site { opacity: .45; }
.compact .outline { stroke-width: 2.4; }
.compact .guide, .compact .band { display: none; }
.coil-site { font: 600 8.5px var(--font-body); fill: var(--text); text-anchor: middle; paint-order: stroke; stroke: var(--surface); stroke-width: 3px; pointer-events: none; }
figcaption { line-height: 1.4; }
</style>
