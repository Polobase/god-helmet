// Point-table generators for published pulse protocols.
//
// Each generator returns a "table" pattern ready for a preset:
//   { type: 'table', data: [0..255, 128 = zero field], pointMs, gapMs }
// plus `meta` (period, pulse counts, source, approximations). The sequencer
// ticks at 2 kHz, so 0.5 ms is the finest point duration; protocols with
// sub-millisecond pulses are rounded to whole ticks and say so in `meta.notes`.
//
// Field strength is set by the preset's level and calibration, never here:
// these tables only fix the timing and the waveform shape (A = full scale).

export const TICK_MS = 0.5
const ZERO = 128
const POS = 255
const NEG = 1 // -127 after the engine's 0..255 -> -127..127 mapping

const pattern = (data, pointMs, gapMs, meta) => ({ pattern: { type: 'table', pointMs, gapMs: +gapMs.toFixed(3), data }, meta })

// Theta-burst stimulation (Huang 2005): bursts of 3 pulses at 50 Hz (20 ms
// apart) repeated at 5 Hz (every 200 ms). Each pulse is one biphasic cycle,
// +A then -A for one tick each (1 ms, close to a TMS biphasic pulse).
function tbsBurst() {
  const n = 200 / TICK_MS
  const data = new Array(n).fill(ZERO)
  for (const ms of [0, 20, 40]) {
    data[ms / TICK_MS] = POS
    data[ms / TICK_MS + 1] = NEG
  }
  return data
}

// iTBS: 2-s trains (10 bursts) every 10 s. 20 trains = 600 pulses, 192 s
// (the literature rounds to 190 s). One table pass is one 10-s cycle.
export function itbs({ trainS = 2, cycleS = 10 } = {}) {
  const burst = tbsBurst()
  const bursts = Math.round((trainS * 1000) / 200)
  const data = Array.from({ length: bursts }, () => burst).flat()
  return pattern(data, TICK_MS, cycleS * 1000 - bursts * 200, {
    name: 'iTBS', periodMs: cycleS * 1000, pulsesPerPass: bursts * 3,
    suggestedPhaseS: (20 - 1) * cycleS + trainS,
    source: 'Huang et al. 2005 Neuron; Suppa et al. 2008',
    notes: 'TMS protocol timing at ~1/10000 of TMS field strength; the biphasic pulse is 2 × 0.5 ms ticks.',
  })
}

// cTBS: the same bursts without pauses; one 40-s phase = 200 bursts, 600 pulses.
export function ctbs() {
  return pattern(tbsBurst(), TICK_MS, 0, {
    name: 'cTBS', periodMs: 200, pulsesPerPass: 3, suggestedPhaseS: 40,
    source: 'Huang et al. 2005 Neuron; Suppa et al. 2008',
    notes: 'TMS protocol timing at ~1/10000 of TMS field strength.',
  })
}

// Low-field magnetic stimulation (Rohan 2014, Fava 2018): 500 Hz alternating
// pulses (+A,+A,-A,-A at 0.5 ms = 2-ms period of 1-ms half-waves), 0.5-s trains
// every 2 s, all coils in phase, 20 min.
export function lfms({ trainMs = 500, periodMs = 2000 } = {}) {
  const n = trainMs / TICK_MS
  const data = Array.from({ length: n }, (_, i) => (i % 4 < 2 ? POS : NEG))
  return pattern(data, TICK_MS, periodMs - trainMs, {
    name: 'LFMS', periodMs, pulsesPerPass: n / 2, suggestedPhaseS: 20 * 60,
    source: 'Rohan et al. 2014 Am J Psychiatry; Fava et al. 2018',
    notes: 'The original uses 1-ms trapezoids with 256-µs ramps; here square half-waves of two ticks.',
  })
}

// Transcranial PEMF as in the Danish Re5 headband trials (Martiny 2010,
// Larsen 2020): bipolar square pulse +A 3 ms, -A 3 ms, then 12 ms pause
// (18 ms, 55.6 Hz). `variant: 'tang'` uses 2.5 + 2.5 ms with a 15-ms pause
// (Tang 2026 describe ~4.5 ms biphasic pulses at 50 Hz).
export function tpemf({ variant = 'larsen' } = {}) {
  const [halfMs, pauseMs] = variant === 'tang' ? [2.5, 15] : [3, 12]
  const half = halfMs / TICK_MS
  const data = [...new Array(half).fill(POS), ...new Array(half).fill(NEG)]
  return pattern(data, TICK_MS, pauseMs, {
    name: `T-PEMF (${variant})`, periodMs: 2 * halfMs + pauseMs, pulsesPerPass: 1, suggestedPhaseS: 30 * 60,
    source: variant === 'tang' ? 'Tang et al. 2026 (BEM-FMM model of the Re5 device)' : 'Larsen et al. 2020; Martiny et al. 2010',
    notes: 'Clinical devices reach ~0.3 mT; this helmet is ~50-100× weaker.',
  })
}

// Lawson "Cnp" analgesia pulse, US 6,234,953 B1 Table 1 (Thomas, Prato,
// Kavaliers, Persinger): 18 identical 27-ms pulses with growing gaps, 1 ms per
// point, signed 8-bit values. Read column-major from the patent's table.
export const CNP_PULSE = [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 127, 127, -128, -116, -104, -50, 0, 127, 72, 72, -53, -53, -128, -116, -92, -56, 0]
export const CNP_ONSETS_MS = [1, 29, 57, 85, 113, 153, 193, 233, 273, 326, 380, 434, 488, 554, 621, 688, 755, 822]

// The patent's 900-point table (pulse k starts one point before its onset).
export function cnpTable() {
  const t = new Array(900).fill(0)
  for (const onset of CNP_ONSETS_MS) CNP_PULSE.forEach((v, j) => (t[onset - 1 + j] = v))
  return t
}

// One Cnp cycle (Camera 2015 / Thomas 2007): four bursts separated by 110,
// 220, 330 and 1200 ms refractory periods. `burstMs` is the length of each
// burst: 849 keeps the patent's last pulse whole (cycle 5256 ms); Camera 2015
// state 838 ms (cycle 5212 ms), which truncates the final pulse.
export function cnpThomas({ burstMs = 849, refractoryMs = [110, 220, 330, 1200] } = {}) {
  const burst = cnpTable().slice(0, burstMs).map((v) => v + 128)
  const data = []
  refractoryMs.slice(0, -1).forEach((gap) => data.push(...burst, ...new Array(gap).fill(ZERO)))
  data.push(...burst)
  const lastGap = refractoryMs[refractoryMs.length - 1]
  return pattern(data, 1, lastGap, {
    name: 'Cnp (Thomas pulse, patent table)', periodMs: data.length + lastGap, pulsesPerPass: 18 * refractoryMs.length,
    suggestedPhaseS: 40 * 60,
    source: 'US 6,234,953 B1 Table 1; Thomas et al. 2007 Pain Res Manag; Camera 2015',
    notes: 'Exact patent waveform. Clinical Cnp used 100-400 µT at the headset, about 30-100× this helmet.',
  })
}

// The same table as replayed in Persinger's Laurentian lab: 849 points at 3 ms
// (one 2.55-s decelerating burst, 25 -> 6 Hz; Buckner et al. 2015, PLoS ONE;
// Murugan 2013 thesis). `gapMs` adds silence between bursts (none in Buckner).
export function thomasLaurentian({ pointMs = 3, gapMs = 0 } = {}) {
  const data = cnpTable().slice(0, 849).map((v) => v + 128)
  return pattern(data, pointMs, gapMs, {
    name: 'Thomas pulse (Laurentian, 3 ms points)', periodMs: data.length * pointMs + gapMs, pulsesPerPass: 18,
    suggestedPhaseS: 30 * 60,
    source: 'US 6,234,953 B1 Table 1; Buckner et al. 2015 PLoS ONE 10:e0125434 (849 points at 3 ms); Murugan 2013 thesis',
    notes: 'Exact point values. The Persinger lab used about 1-5 µT, the same decade as this helmet.',
  })
}

// Primed burst (Rose & Dunwiddie 1988) as described for the Persinger-lab
// "LTP" file (Corradini 2014 thesis figure): positive-only 1-ms pulses, a
// primer, then 4 pulses at 100 Hz starting 150 ms later. `trains` primed
// bursts per second form one "1-s pulse of 5 trains" (Delparte & Persinger
// 2007), followed by `isiMs` of silence (0, 5000 or 10000 in that study).
export function primedBurst({ trains = 5, isiMs = 0 } = {}) {
  const train = new Array(200).fill(ZERO)
  train[0] = POS
  for (let k = 0; k < 4; k++) train[150 + 10 * k] = POS
  const data = Array.from({ length: trains }, () => train).flat()
  return pattern(data, 1, isiMs, {
    name: `Primed burst (${trains} trains${isiMs ? `, ${isiMs / 1000} s apart` : ''})`, periodMs: data.length + isiMs, pulsesPerPass: trains * 5,
    source: 'Rose & Dunwiddie 1988 Neurosci Lett; Corradini 2014 MA thesis (Laurentian); Delparte & Persinger 2007',
    notes: 'Pulse timing from the published descriptions; the lab file\'s exact point values are unpublished.',
  })
}

// Biomimetic high-frequency stimulation, BHFS (Grehl et al. 2016, Front Neural
// Circuits; Dufor 2019): 20 monophasic pulses in 62.6 ms,
// trains repeated at 6.55 Hz (1 min), 9.75 Hz (8 min), 6.15 Hz (1 min).
// The 300-µs pulses become one 0.5-ms tick; pulse k lands on the nearest tick.
export const BHFS_STAGES = [{ hz: 6.55, ms: 60000 }, { hz: 9.75, ms: 8 * 60000 }, { hz: 6.15, ms: 60000 }]

export function bhfs({ hz = 9.75, pulses = 20, trainMs = 62.6 } = {}) {
  const n = Math.round(trainMs / TICK_MS)
  const data = new Array(n).fill(ZERO)
  for (let k = 0; k < pulses; k++) data[Math.round((k * trainMs) / pulses / TICK_MS)] = POS
  return pattern(data, TICK_MS, 1000 / hz - n * TICK_MS, {
    name: `BHFS train at ${hz} Hz`, periodMs: 1000 / hz, pulsesPerPass: pulses,
    source: 'Grehl et al. 2016 Front Neural Circuits; Makowiecki et al. 2014 used a similar pattern',
    notes: 'Rodent LI-rTMS used ~10 mT; pulses rounded to 0.5-ms ticks (±0.25 ms jitter).',
  })
}

// Fibonacci-amplitude theta burst: Murphy lists "LTP / theta-burst ... Fibonacci
// amplitude" among the Shakti signals without publishing the waveform. This is
// a project construct: 4-pulse 100 Hz bursts at 5 Hz (hippocampal LTP
// induction, Larson & Lynch 1986) whose amplitudes follow 1,1,2,3,5,8,... over
// a pass, normalised to full scale and then reversed.
export function fibonacciThetaBurst({ steps = 8 } = {}) {
  const fib = [1, 1]
  while (fib.length < steps) fib.push(fib[fib.length - 1] + fib[fib.length - 2])
  const amps = [...fib, ...fib.slice(0, -1).reverse()].map((f) => f / fib[fib.length - 1])
  const data = []
  for (const a of amps) data.push(...ltpBurst(a))
  return pattern(data, TICK_MS, 0, {
    name: 'Fibonacci-amplitude theta burst', periodMs: data.length * TICK_MS, pulsesPerPass: amps.length * 4,
    source: 'Project construct after Murphy (signal list) and Larson & Lynch 1986 (theta-burst LTP)',
    notes: 'Not a published waveform: Murphy names the signal but the file is proprietary.',
  })
}

// One hippocampal theta burst (Larson & Lynch 1986): 4 pulses at 100 Hz, then
// silence to 200 ms. Biphasic one-tick pulses scaled by `a`.
function ltpBurst(a = 1) {
  const data = new Array(200 / TICK_MS).fill(ZERO)
  const hi = Math.round(ZERO + 127 * a)
  const lo = Math.round(ZERO - 127 * a)
  for (let k = 0; k < 4; k++) {
    data[(k * 10) / TICK_MS] = hi
    data[(k * 10) / TICK_MS + 1] = lo
  }
  return data
}

// Plain hippocampal theta burst at a chosen burst rate (5 Hz = Larson & Lynch).
export function ltpThetaBurst({ burstHz = 5 } = {}) {
  const burst = ltpBurst(1).slice(0, 40 / TICK_MS)
  return pattern(burst, TICK_MS, 1000 / burstHz - 40, {
    name: `Theta burst (4 × 100 Hz at ${burstHz} Hz)`, periodMs: 1000 / burstHz, pulsesPerPass: 4,
    source: 'Larson & Lynch 1986 Science; Larson, Wong & Lynch 1986',
    notes: 'Slice-physiology LTP timing; no evidence it does anything at µT fields.',
  })
}

// 40 Hz square wave (GENUS uses 12.5 ms on / 12.5 ms off light flicker).
export function square40({ hz = 40, duty = 0.5 } = {}) {
  const n = Math.round(1000 / hz / TICK_MS)
  const on = Math.round(n * duty)
  const data = Array.from({ length: n }, (_, i) => (i < on ? POS : NEG))
  return pattern(data, TICK_MS, 0, {
    name: `${hz} Hz square`, periodMs: n * TICK_MS, pulsesPerPass: 1,
    source: 'Iaccarino et al. 2016 Nature; Martorell et al. 2019 Cell (sensory GENUS timing)',
    notes: 'GENUS is light/sound flicker; a magnetic 40 Hz square is a project construct.',
  })
}

// Event-related-potential shape: a textbook auditory ERP (P50, N100, P200,
// N200, P300 as Gaussians) as a point table. Murphy lists an "ERP" signal
// without publishing it; this is a project construct with the classic
// latencies (Luck 2014), repeated every `periodMs`.
export function erp({ periodMs = 1500 } = {}) {
  const comps = [[50, 0.25, 12], [100, -0.8, 18], [200, 0.6, 30], [250, -0.35, 25], [350, 1, 60]]
  const n = 600
  const data = Array.from({ length: n }, (_, i) => {
    const v = comps.reduce((a, [t, amp, w]) => a + amp * Math.exp(-(((i - t) / w) ** 2)), 0)
    return Math.max(0, Math.min(255, Math.round(ZERO + 127 * v)))
  })
  return pattern(data, 1, periodMs - n, {
    name: 'ERP-shaped pulse', periodMs, pulsesPerPass: 1,
    source: 'Project construct after Murphy (signal list); component latencies from Luck 2014, An Introduction to the ERP Technique',
    notes: 'Not a published waveform: Murphy names an ERP signal but the file is proprietary.',
  })
}

export const GENERATORS = {
  itbs, ctbs, lfms, tpemf, cnp: cnpThomas, thomas: thomasLaurentian, bhfs, fibonacci: fibonacciThetaBurst, ltp: ltpThetaBurst,
  primed: primedBurst, square40, erp,
}
