// Coil check with a phone magnetometer. phyphox's remote access feeds the phone's readings to the app (through the
// dev server's /phyphox proxy, vite.config.js: a page loaded over https cannot fetch from a phone over http), while
// the helmet drives one coil with the firmware's LED test pattern: +, pause, −, pause (`test` mode `led`,
// firmware/lib/engine/src/bench.cpp). Fitting that known pattern to the readings gives the coil's field at the test
// current, its direction and its sign, far below the phone's noise of about ±1 µT per reading; Earth's field and slow
// drift fall out as an offset and a slope.

/** One +, pause, −, pause cycle every 5 s: 1.25 s per step, long against the phone's 10 ms readings and the
 *  timing uncertainty between phone and app. */
export const BLINK_HZ = 0.2
/** Seconds of one test: 0.5 s fade-in, about four cycles, 0.5 s fade-out. */
export const TEST_SECONDS = 22
/** The firmware fades a test session in and out over 0.5 s (bench.cpp: fadeInMs, fadeOutMs). */
export const FADE_S = 0.5
/** Readings this close to a step of the pattern are left out: the phone's and the app's clocks agree only to about
 *  0.1 s, and a reading may straddle the step. */
export const EDGE_S = 0.25
/** A field this many standard errors above zero counts as found. */
export const MIN_SNR = 8
/** The magnetometer chip sits inside the phone, about 1 cm from a coil lying on it: working coils gave 17–41 µT at
 *  4.5 mA there (Galaxy Z Flip6, 2026-11-15), 4–9 µT/mA. Below this the coil is off the spot (or barely works). */
export const MIN_ON_SENSOR_UT = 5

/** The phone's address as "a.b.c.d:port" when it is a private IPv4 address (the proxy forwards nowhere else), or
 *  null. Accepts "192.168.1.5", "192.168.1.5:8080" and "http://192.168.1.5:8080/". */
export function phoneAddress(input) {
  const s = String(input ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::(\d{1,5}))?$/.exec(s)
  if (!m) return null
  const o = m.slice(1, 5).map(Number)
  if (o.some((v) => v > 255)) return null
  const isPrivate = o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168)
  const port = m[5] === undefined ? 8080 : Number(m[5])
  if (!isPrivate || !(port >= 1 && port <= 65535)) return null
  return `${o.join('.')}:${port}`
}

/** The query of a phyphox /get request for the magnetometer experiment: the latest values, or every reading after
 *  phone time `after` (phyphox's threshold syntax, "|" encoded as %7C). */
export function getQuery(after = null) {
  if (after === null || after === undefined) return 'mag_time&magX&magY&magZ&mag&magAccuracy'
  const t = Number(after)
  return `mag_time=${t}&magX=${t}%7Cmag_time&magY=${t}%7Cmag_time&magZ=${t}%7Cmag_time&magAccuracy`
}

/** Readings from a phyphox /get reply: phone times (s) and x, y, z (µT), plus the last accuracy flag (3 = calibrated
 *  and reliable; 0 = unreliable, also shown for the raw sensor) and whether phyphox is measuring. */
export function parseGet(json) {
  const b = json?.buffer ?? {}
  // null (a value phyphox could not give) would become 0 with Number(): NaN, so it is left out.
  const arr = (k) => (Array.isArray(b[k]?.buffer) ? b[k].buffer.map((v) => (v === null || v === '' ? NaN : Number(v))) : [])
  const t = arr('mag_time'), x = arr('magX'), y = arr('magY'), z = arr('magZ')
  const out = { t: [], x: [], y: [], z: [] }
  for (let i = 0; i < Math.min(t.length, x.length, y.length, z.length); i++) {
    if (![t[i], x[i], y[i], z[i]].every(Number.isFinite)) continue
    out.t.push(t[i]); out.x.push(x[i]); out.y.push(y[i]); out.z.push(z[i])
  }
  const acc = arr('magAccuracy').filter(Number.isFinite)
  return { ...out, accuracy: acc.length ? acc[acc.length - 1] : null, measuring: !!json?.status?.measuring }
}

/** The pattern's level `dt` seconds after the test starts: +1, 0, −1, 0, each a quarter of the period. */
export function ledLevel(dt, periodS = 1 / BLINK_HZ) {
  if (dt < 0) return 0
  const q = Math.floor((dt % periodS) / (periodS / 4))
  return q === 0 ? 1 : q === 2 ? -1 : 0
}

// Least-squares fit of offset, slope and pattern to the readings, with the test starting at phone time t0.
function fitAt(s, t0, periodS, seconds, fadeS, edgeS) {
  const quarter = periodS / 4
  const lo = fadeS + edgeS, hi = seconds - fadeS - edgeS, mid = (lo + hi) / 2
  const rows = []
  for (let i = 0; i < s.t.length; i++) {
    const dt = s.t[i] - t0
    if (dt < lo || dt > hi) continue
    const r = dt % quarter
    if (r < edgeS || quarter - r < edgeS) continue
    rows.push([i, (dt - mid) / (hi - lo), ledLevel(dt, periodS)])
  }
  if (rows.length < 30 || !rows.some((r) => r[2] > 0) || !rows.some((r) => r[2] < 0)) return null
  // Normal equations for the regressors 1, slope, pattern.
  const xtx = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (const [, u, p] of rows) {
    const v = [1, u, p]
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) xtx[a][b] += v[a] * v[b]
  }
  const inv = invert3(xtx)
  if (!inv) return null
  const fit = { n: rows.length, a: [], se: [] }
  for (const axis of ['x', 'y', 'z']) {
    const xty = [0, 0, 0]
    for (const [i, u, p] of rows) {
      const y = s[axis][i]
      xty[0] += y; xty[1] += u * y; xty[2] += p * y
    }
    const beta = [0, 1, 2].map((a) => inv[a][0] * xty[0] + inv[a][1] * xty[1] + inv[a][2] * xty[2])
    let ssr = 0
    for (const [i, u, p] of rows) {
      const e = s[axis][i] - (beta[0] + beta[1] * u + beta[2] * p)
      ssr += e * e
    }
    fit.a.push(beta[2])
    fit.se.push(Math.sqrt((ssr / (rows.length - 3)) * inv[2][2]))
  }
  fit.score = fit.a.reduce((sum, a, k) => sum + (a / (fit.se[k] || Infinity)) ** 2, 0)
  return fit
}

function invert3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g
  const det = a * A + b * B + c * C
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null
  const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g)
  const G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d
  return [[A / det, D / det, G / det], [B / det, E / det, H / det], [C / det, F / det, I / det]]
}

/**
 * The coil's field from readings `s` ({ t, x, y, z }, phone time) of one LED test of `mA` that started at phone time
 * `startS` (estimated from the clocks; the true start is searched for within ±`searchS`). Returns null without enough
 * readings, else:
 * - `vector`: the field at `mA` per axis (µT, phone axes), `amp` its size, `se` the standard error of `amp`, `snr`;
 * - `axis` ("x", "y" or "z", the largest component) and `sign` (+1/−1): the coil's direction as the phone sees it;
 * - `perMA` (µT/mA) and `perMASe`; `tau` (s), the start time correction found; `n`, readings used.
 */
export function fitCoil(s, { startS, mA, periodS = 1 / BLINK_HZ, seconds = TEST_SECONDS, fadeS = FADE_S, edgeS = EDGE_S, searchS = 0.4, stepS = 0.02 }) {
  const search = (center, half, edge) => {
    let found = null
    const steps = Math.round(half / stepS)
    for (let k = -steps; k <= steps; k++) {
      const tau = center + k * stepS
      const f = fitAt(s, startS + tau, periodS, seconds, fadeS, edge)
      if (f && (!found || f.score > found.score)) found = { ...f, tau }
    }
    return found
  }
  // Leaving out the readings near the steps, every start within ±edgeS of the true one fits alike: a coarse search
  // finds that plateau, a fine one with sharp steps its middle, and the field is fitted there with the steps left
  // out again.
  const coarse = search(0, searchS, edgeS)
  if (!coarse) return null
  const fine = search(coarse.tau, edgeS + stepS, stepS)
  const tau = fine ? fine.tau : coarse.tau
  const best = { ...(fitAt(s, startS + tau, periodS, seconds, fadeS, edgeS) ?? coarse), tau }
  const amp = Math.hypot(...best.a)
  const se = amp > 0 ? Math.sqrt(best.a.reduce((sum, a, k) => sum + (a * best.se[k]) ** 2, 0)) / amp : Math.sqrt(best.se.reduce((sum, e) => sum + e * e, 0) / 3)
  const k = [0, 1, 2].reduce((m, j) => (Math.abs(best.a[j]) > Math.abs(best.a[m]) ? j : m), 0)
  const current = Math.abs(Number(mA))
  return {
    vector: best.a, amp, se, snr: se > 0 ? amp / se : Infinity, axis: 'xyz'[k], sign: Math.sign(best.a[k]) || 1,
    perMA: current > 0 ? amp / current : null, perMASe: current > 0 ? se / current : null, tau: best.tau, n: best.n, mA: current,
  }
}

/**
 * What a fit means for the coil. `mode` "sensor": the coil lies on the phone's sensor spot (does it work?);
 * "spacer": 20 mm from the sensor on its axis (µT/mA for the calibration). Returns { ok, text } (ok null: a warning).
 */
export function verdict(fit, mode) {
  if (!fit) return { ok: false, text: 'No readings during the test. Is phyphox measuring?' }
  if (fit.snr < MIN_SNR) return { ok: false, text: 'No field: check this coil, its resistor and its wires.' }
  if (mode === 'sensor' && fit.amp < MIN_ON_SENSOR_UT) return { ok: null, text: 'Weak: is the coil on the sensor spot?' }
  if (mode === 'spacer' && fit.perMA !== null && (fit.perMA < 0.4 || fit.perMA > 3.5)) {
    return { ok: null, text: 'Unusual µT/mA (expected about 0.7 without a core, 1.4–2.2 with one): check the 20 mm spacing.' }
  }
  return { ok: true, text: 'Works.' }
}

/** How a coil's direction compares with a reference coil measured the same way (same placement on the phone): the
 *  angle between their field vectors. Within 60° "same", beyond 120° "reversed", else "placed differently" (a coil
 *  off the sensor spot sees its field more along the screen). */
export function polarity(fit, ref) {
  if (!fit || !ref || fit === ref) return ''
  const cos = fit.vector.reduce((s, a, k) => s + a * ref.vector[k], 0) / (fit.amp * ref.amp || Infinity)
  return cos > 0.5 ? 'same' : cos < -0.5 ? 'reversed' : 'placed differently'
}

/** Results as CSV for tools/calibrate.py (channel 1..8, mA, uT_on, uT_off): the fitted field as "on", 0 as "off". */
export function toCsv(results) {
  const lines = ['channel,mA,uT_on,uT_off']
  results.forEach((fit, ch) => {
    if (fit) lines.push(`${ch + 1},${fit.mA},${fit.amp.toFixed(3)},0`)
  })
  return lines.join('\n') + '\n'
}

// ---- Signal check: does the intensity the app sets arrive? ----
// A one-coil program plays a sine at the set intensity, as any program would (`session.start`); the app's intensity is
// the peak on the coil's axis 20 mm from its face (engine/patterns.js: a sine swings ±1, times the intensity). With
// the phone's sensor 20 mm from the coil, the fitted peak should match it if the helmet's µT/mA calibration is right.

/** Seconds of one signal check, and its fade-in and fade-out (the program's own, 1 s each). */
export const SIGNAL_SECONDS = 20
export const SIGNAL_FADE_S = 1
/** Frequencies the phone can follow: it reads 100 times a second. */
export const SIGNAL_HZ = [1, 2, 5, 7, 7.83, 10, 20]

/** The program of one signal check: a sine of `hz` on `channel` (0–7) at `uT` (peak at 20 mm). */
export function signalProgram({ channel, hz, uT, seconds = SIGNAL_SECONDS }) {
  return {
    id: 'coil-check-sine',
    name: `Coil check: ${hz} Hz sine on CH${channel + 1}`,
    layout: 'temporal',
    uT,
    fadeInS: SIGNAL_FADE_S,
    fadeOutS: SIGNAL_FADE_S,
    phases: [{
      name: `${hz} Hz sine, CH${channel + 1}`, seconds, level: 1,
      pattern: { type: 'sine', f0: hz, pointMs: 0 },
      spatial: { mode: 'single', channel },
    }],
  }
}

// Solves the n×n system m·x = v (Gaussian elimination with pivoting); null when singular.
function solve(m, v) {
  const n = v.length
  const a = m.map((row, i) => [...row, v[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r
    if (Math.abs(a[p][c]) < 1e-12) return null
    ;[a[c], a[p]] = [a[p], a[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = a[r][c] / a[c][c]
      for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k]
    }
  }
  return a.map((row, i) => row[n] / row[i])
}

/**
 * The peak of a sine of `hz` in readings `s` ({ t, x, y, z }, phone time) of a signal check that started at phone time
 * `startS`, leaving out the fades and `marginS` more at either end. Offset, slope (Earth's field, drift) and the sine's
 * cosine and sine parts are fitted per axis; the phase is free, so the phone's and the app's clocks need not agree.
 * Returns null without enough readings, else `amp` (µT, the peak of the field's size), `se`, `snr`, `n`, `hz`.
 */
export function fitSine(s, { startS, hz, seconds = SIGNAL_SECONDS, fadeS = SIGNAL_FADE_S, marginS = 0.5 }) {
  const lo = fadeS + marginS, hi = seconds - fadeS - marginS, mid = (lo + hi) / 2
  const w = 2 * Math.PI * hz
  const rows = []
  for (let i = 0; i < s.t.length; i++) {
    const dt = s.t[i] - startS
    if (dt < lo || dt > hi) continue
    rows.push([i, [1, (dt - mid) / (hi - lo), Math.cos(w * s.t[i]), Math.sin(w * s.t[i])]])
  }
  if (rows.length < 50) return null
  const xtx = [0, 1, 2, 3].map(() => [0, 0, 0, 0])
  for (const [, v] of rows) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) xtx[a][b] += v[a] * v[b]
  // The variances of the cosine and sine parts: the diagonal of (XᵀX)⁻¹.
  const unit = (k) => [0, 1, 2, 3].map((j) => (j === k ? 1 : 0))
  const inv2 = solve(xtx, unit(2)), inv3 = solve(xtx, unit(3))
  if (!inv2 || !inv3) return null
  let sum2 = 0, var2 = 0
  for (const axis of ['x', 'y', 'z']) {
    const xty = [0, 0, 0, 0]
    for (const [i, v] of rows) for (let a = 0; a < 4; a++) xty[a] += v[a] * s[axis][i]
    const beta = solve(xtx, xty)
    if (!beta) return null
    let ssr = 0
    for (const [i, v] of rows) {
      const e = s[axis][i] - v.reduce((acc, x, a) => acc + x * beta[a], 0)
      ssr += e * e
    }
    const sigma2 = ssr / (rows.length - 4)
    sum2 += beta[2] ** 2 + beta[3] ** 2
    var2 += beta[2] ** 2 * sigma2 * inv2[2] + beta[3] ** 2 * sigma2 * inv3[3]
  }
  const amp = Math.sqrt(sum2)
  const se = amp > 0 ? Math.sqrt(var2) / amp : 0
  return { amp, se, snr: se > 0 ? amp / se : Infinity, n: rows.length, hz }
}
