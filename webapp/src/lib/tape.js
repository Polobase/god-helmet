// Tape-measure recipes for 10-5 sites: where a site lies relative to the
// landmarks and the band line, with distances in cm for one head.
//
// Grid rules: UI 10/10 (Jurcak, Tsuzuki & Dan 2007). Rows sit at 10 % steps of
// nasion-inion. The 10 % line (the band) runs through Fpz, T7, Oz and T8;
// Fpz-T7 and T7-Oz are cut in fifths (Fp1, AF7, F7, FT7 / TP7, P7, PO7, O1),
// each about 5 % of the band. Between the band and the midline each row is cut
// in quarters (F7, F5, F3, F1, Fz). The 0 % line (nasion - ear point - inion)
// lies about 10 % of ear-to-ear / nasion-inion below the band (F9, T9 ...).
// 10-5 names (Oostenveld & Praamstra 2001): double-letter rows (FFT, TTP ...)
// and "h" columns lie halfway between their neighbours.

// Row -> percent of the nasion-inion arc, from the nasion.
export const ROW_PCT = { Fp: 10, AFp: 15, AF: 20, AFF: 25, F: 30, FFC: 35, FC: 40, FCC: 45, C: 50, CCP: 55, CP: 60, CPP: 65, P: 70, PPO: 75, PO: 80, POO: 85, O: 90, OI: 95, I: 100 }
// Lateral sites of some rows carry a temporal prefix (FT7 = the FC row at column 7).
const LATERAL = { FFC: 'FFT', FC: 'FT', FCC: 'FTT', C: 'T', CCP: 'TTP', CP: 'TP', CPP: 'TPP' }
const ROW_OF = { ...Object.fromEntries(Object.keys(ROW_PCT).map((r) => [r, r])), ...Object.fromEntries(Object.entries(LATERAL).map(([r, l]) => [l, r])) }
const SITE_RE = /^(AFp|AFF|FFC|FFT|FCC|FTT|CCP|TTP|CPP|TPP|PPO|POO|Fp|AF|FC|FT|CP|TP|PO|OI|F|C|T|P|O|I)(z|\d+)(h?)$/

// Typical adult head (cm); the app asks for the real values.
export const HEAD_DEFAULTS = { circumference: 56, nasionInion: 36, earEar: 35 }
export const HEAD_LIMITS = { circumference: [40, 70], nasionInion: [25, 45], earEar: [25, 45] }
export const HEAD_LABELS = { nasionInion: 'nasion–inion', earEar: 'ear to ear', circumference: 'round the band line' }

// Name of the site at a row and column (e.g. ('FC', 7) -> 'FT7', ('FC', 0) -> 'FCz').
const siteAt = (row, col) => (col === 0 ? `${row}z` : `${col >= 7 && LATERAL[row] ? LATERAL[row] : row}${col}`)

// Where a 10-5 name sits in the grid, or null for landmarks and unknown names.
//   kind 'ring' : on the band (k = steps of 5 % of its length from Fpz, 0..10)
//   kind 'mid'  : on the midline above the band
//   kind 'row'  : between the band (f = 1) and the midline (f = 0)
//   kind 'low'  : below the band (drop = 1 at the 0 % line)
//   kind 'back' : around the inion, below Oz
export function parseSite(name) {
  const m = SITE_RE.exec(name ?? '')
  if (!m) return null
  const row = ROW_OF[m[1]]
  const pct = ROW_PCT[row]
  const base = { name, row, pct }
  if (m[2] === 'z') {
    if (pct === 10) return { ...base, side: 'mid', kind: 'ring', k: 0 }
    if (pct === 90) return { ...base, side: 'mid', kind: 'ring', k: 10 }
    if (pct > 90) return { ...base, side: 'mid', kind: 'back', steps: 0 }
    return { ...base, side: 'mid', kind: 'mid' }
  }
  const n = Number(m[2])
  const half = m[3] === 'h'
  const side = n % 2 ? 'left' : 'right'
  const col = n % 2 ? n : n - 1 // 1, 3, 5 ... on both sides
  // The Fp and O rows are the band itself near the midline (Fp1 = one step from Fpz).
  if (row === 'Fp' || row === 'O') {
    const steps = half ? 0.5 : 1
    return { ...base, side, kind: 'ring', k: row === 'Fp' ? steps : 10 - steps }
  }
  if (row === 'I' || row === 'OI') return { ...base, side, kind: 'back', steps: half ? 0.5 : 1 }
  const f = (half ? col : col + 1) / 8
  if (f === 1) return { ...base, side, kind: 'ring', k: pct / 10 }
  if (f > 1) return { ...base, side, kind: 'low', k: pct / 10, drop: (f - 1) * 4 }
  return { ...base, side, kind: 'row', f, ring: siteAt(row, side === 'left' ? 7 : 8), mid: siteAt(row, 0) }
}

// Arc lengths of the template head, from chains of neighbouring 10-5 sites.
function chain(sites, names) {
  let sum = 0
  let prev = null
  for (const n of names) {
    const p = sites[n]
    if (!p) continue
    if (prev) sum += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2])
    prev = p
  }
  return sum
}
const RING_LEFT = ['Fpz', 'Fp1h', 'Fp1', 'AFp7', 'AF7', 'AFF7', 'F7', 'FFT7', 'FT7', 'FTT7', 'T7', 'TTP7', 'TP7', 'TPP7', 'P7', 'PPO7', 'PO7', 'POO7', 'O1', 'O1h', 'Oz']
const rightOf = (n) => n.replace(/(\d+)/, (d) => String(Number(d) + 1))

function templateArcs(sites) {
  const mids = Object.keys(ROW_PCT).filter((r) => r !== 'I' && r !== 'OI').map((r) => `${r}z`)
  const t = {
    circumference: chain(sites, RING_LEFT) + chain(sites, RING_LEFT.map(rightOf)),
    nasionInion: chain(sites, ['Nz', ...mids, 'OIz', 'Iz']),
    earEar: chain(sites, ['T9', 'T9h', 'T7', 'T7h', 'C5', 'C5h', 'C3', 'C3h', 'C1', 'C1h', 'Cz', 'C2h', 'C2', 'C4h', 'C4', 'C6h', 'C6', 'T8h', 'T8', 'T10h', 'T10']),
    rows: {},
  }
  for (const row of Object.keys(ROW_PCT)) {
    if (['Fp', 'O', 'OI', 'I'].includes(row)) continue
    const names = [siteAt(row, 0), `${row}1h`, `${row}1`, `${row}3h`, `${row}3`, `${row}5h`, `${row}5`, `${siteAt(row, 7)}h`, siteAt(row, 7)]
    t.rows[row] = chain(sites, names) / 10 // cm
  }
  for (const k of ['circumference', 'nasionInion', 'earEar']) t[k] /= 10
  return t
}

// Clean head measurements (cm): out-of-range or missing values fall back to
// the defaults; `defaulted` lists those fields.
export function cleanHead(head = {}) {
  const out = {}
  const defaulted = []
  for (const [k, [lo, hi]] of Object.entries(HEAD_LIMITS)) {
    const v = Number(head[k])
    if (head[k] !== '' && head[k] != null && v >= lo && v <= hi) out[k] = v
    else {
      out[k] = HEAD_DEFAULTS[k]
      defaulted.push(k)
    }
  }
  return { ...out, defaulted, typical: defaulted.length > 0 }
}

const FRACTIONS = { 1: '1/8', 2: '1/4', 3: '3/8', 4: 'halfway', 5: '5/8', 6: '3/4', 7: '7/8' }
const fmt = (cm) => `${cm.toFixed(1)} cm`
const way = (x) => (Math.round(x * 8) === 4 ? 'halfway' : `${FRACTIONS[Math.round(x * 8)]} of the way`)
const sideWord = (s) => (s === 'left' ? 'left' : 'right')

// Tape recipe for one site and one head: {kind, band: 'on'|'above'|'below',
// bandCm (distance from the band along the head), text, detail, estimate}.
// `tape` comes from makeTape(sites).
function recipe(tape, name, rawHead) {
  const s = parseSite(name)
  if (!s) return null
  const head = cleanHead(rawHead)
  const { circumference: C, nasionInion: NI, earEar: LR } = head
  const step = C / 20
  const t = tape.template
  const scale = (C / t.circumference + NI / t.nasionInion + LR / t.earEar) / 3
  const ear = `${sideWord(s.side)} ear`

  if (s.kind === 'ring') {
    const k = s.k
    const n = k <= 5 ? k : 10 - k
    const pctC = k > 0 && k < 10 && k !== 5
      ? `For accuracy, measure ${k <= 5 ? 'Fpz' : 'Oz'} → ${s.side === 'left' ? 'T7' : 'T8'} on the band and take ${n}/5 from ${k <= 5 ? 'Fpz' : 'Oz'}; each fifth is about 5 % of the band.`
      : ''
    if (k === 0) return { ...s, band: 'on', bandCm: 0, text: `Front centre of the band: on the midline, ${fmt(0.1 * NI)} above the nasion (10 % of nasion–inion).`, detail: 'Fpz is the 0 point of the band.', estimate: false }
    if (k === 10) return { ...s, band: 'on', bandCm: 0, text: `Back centre of the band: on the midline, ${fmt(0.1 * NI)} above the inion (10 % of nasion–inion).`, detail: 'Oz is halfway round the band from Fpz.', estimate: false }
    if (k === 5) return { ...s, band: 'on', bandCm: 0, text: `On the band right above the ${ear}: ${fmt(0.1 * LR)} above the ear point (10 % of ear-to-ear), a quarter of the way round from Fpz (${fmt(5 * step)}).`, detail: pctC, estimate: false }
    let text
    if (k > 2.5 && k < 7.5) {
      const t7 = s.side === 'left' ? 'T7' : 'T8'
      text = `On the band, ${fmt(Math.abs(k - 5) * step)} ${k < 5 ? 'in front of' : 'behind'} ${t7} (the band point above the ${ear}).`
    } else {
      text = `On the band, ${fmt((k < 5 ? k : 10 - k) * step)} from ${k < 5 ? 'Fpz' : 'Oz'} toward the ${ear}.`
    }
    return { ...s, band: 'on', bandCm: 0, text, detail: pctC, estimate: false }
  }

  if (s.kind === 'mid') {
    const fromNasion = s.pct <= 50
    const d = ((fromNasion ? s.pct : 100 - s.pct) / 100) * NI
    const above = (Math.min(s.pct, 100 - s.pct) - 10) / 100 * NI
    const text = s.name === 'Cz'
      ? `The crown: halfway from nasion to inion (${fmt(0.5 * NI)}) and halfway from ear to ear (${fmt(0.5 * LR)}).`
      : `On the midline, ${fmt(d)} from the ${fromNasion ? 'nasion' : 'inion'} (${fromNasion ? s.pct : 100 - s.pct} % of nasion–inion).`
    return { ...s, band: 'above', bandCm: above, text, detail: `${s.pct} % of nasion–inion from the nasion`, estimate: false }
  }

  if (s.kind === 'row') {
    const up = 1 - s.f
    if (s.row === 'C') {
      const fromEar = (0.5 - 0.4 * s.f) * LR
      const bandCm = up * 0.4 * LR
      const lead = s.f < 0.5 ? `${fmt(s.f * 0.4 * LR)} from Cz toward ${s.ring}` : `${fmt(bandCm)} above ${s.ring} toward Cz`
      return { ...s, band: 'above', bandCm, text: `On the ear-to-ear line, ${lead}: ${fmt(fromEar)} up from the ${ear} point (${Math.round((fromEar / LR) * 100)} % of ear-to-ear).`, detail: `${way(up)} from ${s.ring} to Cz`, estimate: false }
    }
    const arc = (tape.template.rows[s.row] ?? 0) * scale
    const bandCm = up * arc
    const text = s.f < 0.5
      ? `About ${fmt(s.f * arc)} from ${s.mid} (midline) toward ${s.ring}, on the line from ${s.mid} down to ${s.ring} (band): ${way(s.f)} from ${s.mid}.`
      : `About ${fmt(bandCm)} above ${s.ring}, on the line from ${s.ring} (band) up to ${s.mid} (midline): ${way(up)} from ${s.ring}.`
    const [from, to, x] = s.f < 0.5 ? [s.mid, s.ring, s.f] : [s.ring, s.mid, up]
    const part = Math.round(x * 8) === 4 ? 'half' : `${FRACTIONS[Math.round(x * 8)]} from ${from}`
    return { ...s, band: 'above', bandCm, text, detail: `For accuracy, measure ${from} → ${to} on the head and take ${part}; the cm value is scaled from the template head.`, estimate: true }
  }

  if (s.kind === 'low') {
    const ring = siteAt(s.row, s.side === 'left' ? 7 : 8)
    if (s.row === 'C') {
      const d = 0.1 * LR * s.drop
      const text = s.drop === 1
        ? `On the ${ear} point (front root of the tragus): ${fmt(d)} straight below ${ring}.`
        : `Halfway between ${ring} and the ${ear} point: ${fmt(d)} below ${ring}.`
      return { ...s, band: 'below', bandCm: d, text, detail: '0 % line: nasion – ear point – inion', estimate: false }
    }
    const d = 0.1 * ((NI + LR) / 2) * s.drop
    const text = s.drop === 1
      ? `About ${fmt(d)} straight below ${ring}, on the low line from the nasion past the ${ear} point to the inion.`
      : `About ${fmt(d)} below ${ring}, halfway down to the low line (nasion – ear point – inion).`
    const eye = s.k <= 2.5 ? ' This is next to the eye: keep the coil off the eyelid and the eye socket.' : ''
    return { ...s, band: 'below', bandCm: d, text, detail: `Below the band: use a second strap or a cap.${eye}`, estimate: true }
  }

  // Around the inion.
  if (s.row === 'I') {
    if (s.side === 'mid') return { ...s, band: 'below', bandCm: 0.1 * NI, text: `On the inion, the bump at the back of the skull: ${fmt(0.1 * NI)} below Oz.`, detail: '100 % of nasion–inion', estimate: false }
    return { ...s, band: 'below', bandCm: 0.1 * NI, text: `On the low line beside the inion, about ${fmt(s.steps * step)} to the ${sideWord(s.side)} of Iz (below ${s.steps === 1 ? (s.side === 'left' ? 'O1' : 'O2') : s.side === 'left' ? 'O1h' : 'O2h'}).`, detail: 'Below the band: use a second strap or a cap.', estimate: true }
  }
  if (s.side === 'mid') return { ...s, band: 'below', bandCm: 0.05 * NI, text: `On the midline halfway between Oz and the inion: ${fmt(0.05 * NI)} below Oz.`, detail: '95 % of nasion–inion', estimate: false }
  const o = s.side === 'left' ? 'O1' : 'O2'
  const i = s.side === 'left' ? 'I1' : 'I2'
  const h = s.steps === 1 ? '' : 'h'
  return { ...s, band: 'below', bandCm: 0.05 * NI, text: `Halfway between ${o}${h} on the band and ${i}${h} beside the inion.`, detail: 'Below the band: use a second strap or a cap.', estimate: true }
}

// Plain-language position: side and part of the head.
export function describeSite(name) {
  const s = parseSite(name)
  if (!s) return ''
  const side = s.side === 'mid' ? 'Midline' : s.side === 'left' ? 'Left' : 'Right'
  let part
  if (s.kind === 'ring' || s.kind === 'low') {
    const k = s.k
    const low = s.kind === 'low'
    const half = low && s.drop < 1
    if (k <= 1) part = low ? (half ? 'on the eyebrow' : 'over the eye (keep coils off)') : 'forehead'
    else if (k <= 2.5) {
      if (!low) part = 'forehead, above the outer eyebrow'
      else if (!half) part = k < 2 ? 'over the outer eye (keep coils off)' : k === 2 ? 'beside the eye, on the rim of the eye socket (keep coils off)' : 'low temple, just behind the outer corner of the eye'
      else part = k < 2 ? 'on the outer eyebrow' : k === 2 ? 'outer end of the eyebrow' : 'front of the temple, just behind the end of the eyebrow'
    } else if (k <= 3) part = low ? 'low temple, beside the eye' : 'front of the temple'
    else if (k < 5) part = low ? 'in front of the ear, low' : 'temple, in front of the ear top'
    else if (k === 5) part = !low ? 'just above the ear' : half ? 'front of the ear, where its top joins the head' : 'at the ear point, in front of the ear canal'
    else if (k < 6) part = !low ? 'just above the ear top' : half ? 'over the upper ear (the coil rests on the ear)' : 'on the ear, behind the tragus'
    else if (k === 6 && half) part = 'behind the upper ear, at its back edge'
    else if (k <= 6.5) part = low ? 'behind the ear, low' : 'behind the ear top'
    else if (k <= 7.5) part = low ? 'back of the head, low' : 'back of the head, side'
    else part = low ? 'back of the head, above the neck' : 'back of the head'
  } else if (s.kind === 'mid') {
    part = s.pct <= 25 ? 'upper forehead' : s.pct < 50 ? 'front of the top of the head' : s.pct === 50 ? 'crown' : s.pct <= 70 ? 'top, behind the crown' : 'back of the head, upper'
  } else if (s.kind === 'row') {
    if (s.f >= 0.625) {
      part = s.pct <= 25 ? 'forehead, outer part'
        : s.pct <= 35 ? 'side of the forehead, above the temple'
          : s.pct <= 45 ? 'side, above and in front of the ear'
            : s.pct <= 55 ? 'side, above the ear'
              : s.pct <= 70 ? 'side, above and behind the ear'
                : 'back of the head, side'
    } else {
      const zone = s.pct <= 25 ? 'forehead' : s.pct <= 45 ? 'front of the top of the head' : s.pct <= 55 ? 'top of the head' : s.pct <= 70 ? 'top, behind the crown' : 'back of the head'
      part = `${zone}, ${s.f < 0.5 ? 'beside the midline' : 'halfway from the midline to the band'}`
    }
  } else {
    part = s.side === 'mid' ? 'back of the head, at the bony ridge' : 'back of the head, beside the bony ridge'
  }
  return `${side} · ${part}`
}

export function makeTape(sites) {
  const tape = { template: templateArcs(sites) }
  tape.recipe = (name, head) => recipe(tape, name, head)
  return tape
}
