// JavaScript port of firmware/lib/engine/src/spatial.cpp (keep in sync).
// Channel index 0..7 = CH1..CH8 = DAC A..H.
//   ring:     0 Fpz 1 F7 2 T7 3 P7 4 Oz 5 P8 6 T8 7 F8  (counter-clockwise from above)
//   temporal: left 0 FT7 1 T7 2 CP5 3 TP7, right 4 FT8 5 T8 6 CP6 7 TP8

export const SPATIAL_MODES = ['bilateral', 'left', 'right', 'rotate', 'cycle', 'alternate', 'single']

const RING_CCW = [0, 1, 2, 3, 4, 5, 6, 7]
const TEMPORAL_CCW = [0, 1, 2, 3, 7, 6, 5, 4]
const SIDES = {
  ring: { left: [1, 2, 3], right: [5, 6, 7] },
  temporal: { left: [0, 1, 2, 3], right: [7, 6, 5, 4] },
}

function orient(src, ccw) {
  if (ccw) return [...src]
  return [src[0], ...src.slice(1).reverse()]
}

export const rotationOrder = (layout, ccw) => orient(layout === 'ring' ? RING_CCW : TEMPORAL_CCW, ccw)
export const sideOrder = (layout, side, ccw) => orient(SIDES[layout === 'ring' ? 'ring' : 'temporal'][side], ccw)
export const isLeft = (layout, ch) => (layout === 'ring' ? ch >= 1 && ch <= 3 : ch >= 0 && ch <= 3)
export const isRight = (layout, ch) => (layout === 'ring' ? ch >= 5 && ch <= 7 : ch >= 4 && ch <= 7)

export function spatialDefaults() {
  return { mode: 'bilateral', ccw: true, dwellStartMs: 20, dwellStepMs: 0, dwellEndMs: 20, crossfade: false,
    side: 'right', alternateMs: 2000, channel: 0, weights: [1, 1, 1, 1, 1, 1, 1, 1] }
}

function scheduleLength(s) {
  if (s.dwellStepMs === 0) return 1
  const span = s.dwellEndMs - s.dwellStartMs
  if (span === 0 || (span > 0) !== (s.dwellStepMs > 0)) return 1
  return Math.floor(span / s.dwellStepMs + 1e-4) + 1
}

function dwellAt(s, k) {
  const d = s.dwellStartMs + s.dwellStepMs * k
  return d < 0.5 ? 0.5 : d
}

export function dwellPosition(s, tMs) {
  if (tMs < 0) return { step: 0, frac: 0 }
  const n = scheduleLength(s)
  let cycle = 0
  for (let k = 0; k < n; k++) cycle += dwellAt(s, k)
  const cycles = Math.floor(tMs / cycle)
  let tau = tMs - cycles * cycle
  let k = 0
  let frac = 0
  for (; k < n; k++) {
    const d = dwellAt(s, k)
    if (tau < d || k === n - 1) {
      frac = Math.min(1, tau / d)
      break
    }
    tau -= d
  }
  return { step: cycles * n + k, frac }
}

export function spatialGains(s, layout, tMs) {
  const out = new Array(8).fill(0)
  switch (s.mode) {
    case 'bilateral':
      out.fill(1)
      break
    case 'left':
    case 'right':
      for (let ch = 0; ch < 8; ch++) out[ch] = (s.mode === 'left' ? isLeft(layout, ch) : isRight(layout, ch)) ? 1 : 0
      break
    case 'rotate':
    case 'cycle': {
      const order = s.mode === 'rotate' ? rotationOrder(layout, s.ccw) : sideOrder(layout, s.side, s.ccw)
      const n = order.length
      const pos = dwellPosition(s, tMs)
      const current = order[pos.step % n]
      if (s.crossfade) {
        out[current] += 1 - pos.frac
        out[order[(pos.step + 1) % n]] += pos.frac
      } else {
        out[current] = 1
      }
      break
    }
    case 'alternate': {
      const half = s.alternateMs > 1 ? s.alternateMs : 1
      const left = Math.floor(tMs / half) % 2 === 0
      for (let ch = 0; ch < 8; ch++) out[ch] = (left ? isLeft(layout, ch) : isRight(layout, ch)) ? 1 : 0
      break
    }
    case 'single':
      if (s.channel < 8) out[s.channel] = 1
      break
  }
  for (let ch = 0; ch < 8; ch++) out[ch] *= s.weights[ch]
  return out
}

// Which coils a phase can ever drive (for static placement highlights).
export function coilsUsed(s, layout) {
  const used = new Array(8).fill(0)
  if (s.mode === 'rotate') for (const ch of rotationOrder(layout, s.ccw)) used[ch] = 1
  else if (s.mode === 'cycle') for (const ch of sideOrder(layout, s.side, s.ccw)) used[ch] = 1
  else if (s.mode === 'alternate') for (let ch = 0; ch < 8; ch++) used[ch] = isLeft(layout, ch) || isRight(layout, ch) ? 1 : 0
  else return spatialGains(s, layout, 0)
  return used.map((u, ch) => u * s.weights[ch])
}
