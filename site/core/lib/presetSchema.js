// What a program file says about its source, beyond what the engine plays
// (docs/PRESET_FORMAT.md). The firmware ignores these fields.
// No imports: the public pages, the checker and the tests all read this.

// How well this helmet reproduces the cited exposure. Separate from the
// evidence level, which rates the source protocol.
export const FIDELITY = {
  exact: { label: 'As published', info: 'The source publishes the waveform and timing and the helmet plays them. The field strength lies between the readings the source’s figures allow', tone: 'ok' },
  approximation: { label: 'Approximation', info: 'Rebuilt from a description: the original values were never published', tone: 'blue' },
  timing: { label: 'Timing only', info: 'The timing is the source’s. Its field strength or kind of field is not: ten times or more away, or a uniform, static or TMS field', tone: 'warn' },
  construct: { label: 'Own construct', info: 'This project’s own design: no source describes this protocol', tone: '' },
}
export const FIDELITY_KEYS = Object.keys(FIDELITY)

/** Every key a program file may have at its top level and in `placement`. A key that is not listed is a typing error. */
export const TOP_KEYS = ['id', 'name', 'category', 'evidence', 'fidelity', 'dose', 'origin', 'uT', 'summary', 'notes', 'setting', 'schedule', 'targets', 'source', 'layout', 'placement', 'fadeInS', 'fadeOutS', 'tableData', 'phases']
export const PLACEMENT_KEYS = ['sites', 'order']
export const fidelityLabel = (key) => FIDELITY[key]?.label ?? key ?? ''
export const fidelityInfo = (key) => FIDELITY[key]?.info ?? ''
// Every active program must carry a fidelity (the checker reports a missing one as an error).
export const FIDELITY_REQUIRED = true
// With these, nobody has tested the exposure this helmet delivers.
export const FIDELITY_UNTESTED = ['timing', 'construct']

// What the source states about field strength, and where it was measured.
// Factors convert to µT.
export const DOSE_UNITS = { nT: 0.001, mG: 0.1, uT: 1, mT: 1000 }
export const DOSE_PLANES = {
  scalp: 'at the scalp',
  coil: 'at the coil',
  intracranial: 'inside the head',
  centre: 'at the centre of the array',
  unstated: 'place not stated',
}

// A program's own intensity: peak field 20 mm in front of each coil, µT.
export const UT_MAX = 5
// The firmware's default calibration, µT per mA at 20 mm (firmware/src/settings.h).
export const DEFAULT_UT_PER_MA = 1.8
// Code steps each side of zero on the 12-bit DAC (firmware/lib/engine/src/drive.h).
export const DAC_SWING = 2047
// Below this swing an 8-bit source table loses levels.
export const MIN_SWING = 64

/** "1–5 µT at the scalp (Healey 1996 p.2)", or '' without a dose. */
export function doseText(dose) {
  if (!dose) return ''
  const v = Array.isArray(dose.value) ? `${dose.value[0]}–${dose.value[1]}` : `${dose.value}`
  const unit = dose.unit === 'uT' ? 'µT' : dose.unit
  return `${v} ${unit} ${DOSE_PLANES[dose.plane] ?? dose.plane} (${dose.cite})`
}
