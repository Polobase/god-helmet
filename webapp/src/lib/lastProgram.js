// The program the Programs tab showed last, kept on this device. Older
// versions kept the Placement tab's own choice under 'placement-program'.
const KEY = 'program'
const OLD_KEY = 'placement-program'

export function lastProgramId() {
  try {
    return localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || ''
  } catch {
    return ''
  }
}

export function rememberProgram(id) {
  try {
    localStorage.setItem(KEY, id)
  } catch { /* private mode: kept for this visit only */ }
}
