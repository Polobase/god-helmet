export function fmtDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export const fmtMinutes = (ms) => `${Math.round(ms / 60000)} min`

export function fmtDate(epoch) {
  if (!epoch) return '–'
  return new Date(epoch * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

const round = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? Math.round(x) : Number(x.toFixed(2)))

export function describePattern(p) {
  switch (p.type) {
    case 'sine': return `${round(p.f0)} Hz sine${p.pointMs ? `, ${round(p.pointMs)} ms points` : ''}`
    case 'chirp': return `Sweep ${round(p.f0)} → ${round(p.f1)} Hz over ${round(p.sweepMs / 1000)} s${p.gapMs ? `, ${round(p.gapMs / 1000)} s pause` : ''}`
    case 'burst': return `Accelerating burst ${round(p.f0)} → ${round(p.f1)} Hz, ${round(p.sweepMs / 1000)} s on, ${round(p.gapMs / 1000)} s off, ${round(p.pointMs)} ms points`
    case 'thomas': return `Decelerating ${round(p.f0)} → ${round(p.f1)} Hz, ${round(p.sweepMs / 1000)} s, ${round(p.pointMs)} ms points`
    case 'pulse': return `${round(p.pulseMs)} ms pulses${p.gapMs ? `, ${round(p.gapMs)} ms gaps` : ''}${p.alternate ? ', alternating polarity' : ''}`
    case 'semirandom': return `Random value every ${round(p.pointMs)} ms`
    case 'table': return `Point table, ${round(p.pointMs)} ms per point`
    case 'dc': return 'Constant current'
    default: return 'No output'
  }
}

export function describeSpatial(s) {
  const dir = s.ccw ? 'counter-clockwise' : 'clockwise'
  const dwell = s.dwellStepMs ? `${round(s.dwellStartMs)} → ${round(s.dwellEndMs)} ms per coil (${s.dwellStepMs > 0 ? '+' : ''}${round(s.dwellStepMs)} ms steps)` : `${round(s.dwellStartMs)} ms per coil`
  const weighted = s.weights.some((w) => w !== 1 && w !== 0) ? ', weighted' : ''
  switch (s.mode) {
    case 'bilateral': return `All coils together${weighted}`
    case 'left': return `Left side only${weighted}`
    case 'right': return `Right side only${weighted}`
    case 'rotate': return `Rotating ${dir} around all coils, ${dwell}`
    case 'cycle': return `Stepping ${dir} around the ${s.side} side, ${dwell}${weighted}`
    case 'alternate': return `Left ↔ right every ${round(s.alternateMs / 1000)} s`
    case 'single': return `Coil CH${s.channel + 1} only`
  }
  return s.mode
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
