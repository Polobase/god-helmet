// "Ready to start?" rows for the Start panel. Advice only: the helmet itself
// refuses what is unsafe (safety page not accepted). status: ok | warn | bad;
// action names the button that fixes it (connect, safety, measure, place, calibrate).
import { HEAD_LABELS } from './tape.js'

export const MIN_GAP_H = 72 // the helmet's own figure (hello: minIntervalS) wins

// Hours since the helmet's last session, or null when it cannot tell.
export function hoursSinceLast(info, nowS) {
  return info?.lastSessionEpoch && info.env?.timeValid ? (nowS - info.lastSessionEpoch) / 3600 : null
}

export const minGapHours = (info) => (info?.minIntervalS > 0 ? Math.round(info.minIntervalS / 3600) : MIN_GAP_H)

const ago = (h) => (h < 48 ? `${Math.max(0, Math.round(h))} h` : `${Math.round(h / 24)} days`)
const TRANSPORT = { ble: 'Bluetooth', usb: 'USB' }

// device: { kind, name, info, link }; head: headInUse(); placed/used: coil counts.
// (`link` other than 'connected': the helmet is known but cannot be reached now.)
export function readiness({ device = {}, head = null, placed = 0, used = 0, nowS = Date.now() / 1000 } = {}) {
  const rows = []
  const info = device.kind ? device.info : null
  if (!device.kind) rows.push({ key: 'connect', status: 'bad', text: 'Not connected', action: 'connect' })
  else if (device.link && device.link !== 'connected') rows.push({ key: 'connect', status: 'bad', text: `Connection to ${device.kind === 'demo' ? 'the demo helmet' : device.name || 'the helmet'} lost` })
  else if (device.kind === 'demo') rows.push({ key: 'connect', status: 'ok', text: 'Demo: no helmet, nothing is switched on' })
  else rows.push({ key: 'connect', status: 'ok', text: `Connected: ${device.name} (${TRANSPORT[device.kind] ?? device.kind})` })
  if (device.kind === 'usb') rows.push({ key: 'usb', status: 'warn', text: 'USB cable: wear the helmet only with a laptop on battery, charger unplugged' })

  if (info) {
    if (info.safetyAccepted) rows.push({ key: 'safety', status: 'ok', text: 'Safety page accepted' })
    else rows.push({ key: 'safety', status: 'bad', text: 'Safety page not accepted: the helmet will not start', action: 'safety' })
  }

  if (head) {
    const missing = head.defaulted ?? []
    if (missing.length === Object.keys(HEAD_LABELS).length) rows.push({ key: 'head', status: 'warn', text: 'Head not measured: the distances are for a typical head', action: 'measure' })
    else if (missing.length) {
      const names = Object.keys(HEAD_LABELS).filter((k) => missing.includes(k)).map((k) => HEAD_LABELS[k])
      rows.push({ key: 'head', status: 'warn', text: `Head partly measured: ${names.join(' and ')} ${names.length === 1 ? 'is a typical value' : 'are typical values'}`, action: 'measure' })
    }
    else rows.push({ key: 'head', status: 'ok', text: `Head measured: ${head.nasionInion} / ${head.earEar} / ${head.circumference} cm` })
  }

  if (used > 0) {
    if (placed >= used) rows.push({ key: 'coils', status: 'ok', text: used === 1 ? 'The coil is placed' : `All ${used} coils placed` })
    else rows.push({ key: 'coils', status: 'warn', text: `Coils placed: ${placed} of ${used}`, action: 'place' })
  }

  if (info) {
    if (info.calibrated) rows.push({ key: 'calibrated', status: 'ok', text: 'Coils calibrated' })
    else rows.push({ key: 'calibrated', status: 'warn', text: 'Not calibrated: field values are estimates', action: 'calibrate' })
    const h = hoursSinceLast(info, nowS)
    const gap = minGapHours(info)
    if (h !== null) {
      if (h < gap) rows.push({ key: 'recent', status: 'warn', text: `Last session ${ago(h)} ago; ${gap} h between sessions is recommended` })
      else rows.push({ key: 'recent', status: 'ok', text: `Last session ${ago(h)} ago` })
    }
  }
  return rows
}
