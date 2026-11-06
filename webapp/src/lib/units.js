// Unit for showing field strengths: tesla (µT) or gauss (mG); 1 µT = 10 mG.
// Only the display changes: programs, settings, the log and the helmet itself
// all keep µT.
import { reactive, watch } from 'vue'

const KEY = 'field-unit'
const load = () => {
  try {
    return localStorage.getItem(KEY) === 'G' ? 'G' : 'T'
  } catch {
    return 'T'
  }
}

export const units = reactive({ field: load() }) // 'T' (µT) or 'G' (mG)
watch(() => units.field, (u) => {
  try {
    localStorage.setItem(KEY, u)
  } catch { /* private mode: kept for this visit */ }
})

export const UNIT_LABEL = { T: 'µT', G: 'mG' }
export const UNIT_NAME = { T: 'tesla', G: 'gauss' }
export const MG_PER_UT = 10
export const unitLabel = () => UNIT_LABEL[units.field]
export const setFieldUnit = (u) => (units.field = u === 'G' ? 'G' : 'T')
export const toggleFieldUnit = () => setFieldUnit(units.field === 'G' ? 'T' : 'G')

// µT -> the shown unit, and back (for inputs).
export const toDisplay = (uT) => (units.field === 'G' ? uT * MG_PER_UT : uT)
export const fromDisplay = (v) => (units.field === 'G' ? v / MG_PER_UT : v)

// Estimated fields, from tiny to large: 0.046 / 0.31 / 1.6 / 48 µT, or 0.46 / 3.1 / 16 / 480 mG.
export function fmtAdaptive(v) {
  if (!(v >= 0.01)) return '<0.01'
  return v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v.toFixed(3)
}
export const fmtField = (uT, unit = true) => `${fmtAdaptive(toDisplay(uT))}${unit ? ` ${unitLabel()}` : ''}`

// Intensity settings (steps of 0.1 µT = 1 mG): 1.0 µT or 10 mG.
export const fmtSetting = (uT, unit = true) =>
  `${units.field === 'G' ? Math.round(Number(uT) * MG_PER_UT) : Number(uT).toFixed(1)}${unit ? ` ${unitLabel()}` : ''}`

// Round reference values (Earth's field, limits): 48 µT or 480 mG; 1–5 µT or 10–50 mG.
const round = (uT) => Number(toDisplay(uT).toPrecision(6))
export const fmtRef = (uT) => `${round(uT)} ${unitLabel()}`
export const fmtRange = (a, b) => `${round(a)}–${round(b)} ${unitLabel()}`
