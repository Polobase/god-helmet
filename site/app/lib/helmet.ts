// The Helmet and Log tabs' front door to the JavaScript core: the shapes the
// helmet sends, the forms of the Helmet tab (kept here so they survive a
// change of tab) and the result toast of its actions. Nothing here changes
// what is sent to the helmet.
import { reactive, ref } from 'vue'
import { navigateTo, useAppNav, useToast } from '#imports'
import { toDisplay, fromDisplay } from '#core/lib/units.js'
import { device, call, refresh, freshKp, errorMessage, type DeviceInfo, type DeviceStatus } from './device'

// ---------------------------------------------------------------- shapes
/** What a number field holds: a number, or '' while it is empty. */
export type NumberInput = number | string

/** The helmet's settings (docs/BLE_PROTOCOL.md). Fields are kept in µT. */
export interface HelmetSettings {
  /** Calibration per coil: µT at 20 mm per mA, CH1 to CH8. */
  uTperMA: NumberInput[]
  calibrated: boolean
  seriesOhm: NumberInput
  coilOhm: NumberInput
  vFullScale: NumberInput
  dacGain2x: boolean
  dacBufferedRef: boolean
  maxFieldUT: NumberInput
  defaultFieldUT: NumberInput
  longitudeDeg: NumberInput
  keepaliveS: NumberInput
  bleName: string
  // Read-only, or set elsewhere (the safety page).
  lastSessionEpoch?: number
  safetyAccepted?: boolean
  maxCurrentMA?: number
}
/** The settings the Helmet tab saves, in the order it sends them. */
export const SETTINGS_KEYS = ['uTperMA', 'calibrated', 'seriesOhm', 'coilOhm', 'vFullScale', 'dacGain2x', 'dacBufferedRef', 'maxFieldUT', 'defaultFieldUT', 'longitudeDeg', 'keepaliveS', 'bleName'] as const
export type SettingsKey = (typeof SETTINGS_KEYS)[number]
export const CALIBRATION_KEYS = ['uTperMA', 'calibrated'] as const satisfies readonly SettingsKey[]
export const OTHER_KEYS = SETTINGS_KEYS.filter((k) => !(CALIBRATION_KEYS as readonly string[]).includes(k))

/** Clock, sidereal time and geomagnetic activity, as the helmet records them. */
export interface HelmetEnv {
  timeValid: boolean
  epoch: number
  /** Local sidereal time in hours; negative when unknown. */
  lst: number
  longitude?: number
  kpValid: boolean
  kp: number
  /** Negative when unknown. */
  ap: number
  kpSource: string
}
export interface HelmetInfo extends DeviceInfo {
  firmware?: string
  board?: string
  chip?: string
  env?: HelmetEnv
}
export const helmetInfo = () => device.info as HelmetInfo | null

/** One session in the helmet's log. */
export interface LogEntry {
  id: number
  /** Start, seconds since 1970. */
  start: number
  presetId: string
  presetName: string
  blind: boolean
  /** 'hidden' for a blind session until it is rated, then 'active' or 'sham'. */
  condition: string
  fieldUT: number
  plannedMs: number
  elapsedMs: number
  finished: boolean
  completed: boolean
  /** Why it ended early; after a restart of the helmet "restart: <why>" or "power lost". */
  reason: string
  kpValid: boolean
  kp: number
  ap: number
  kpSource: string
  lst: number
  /** 0 to 10; negative while unrated. */
  rating: number
  notes: string
  /** The trial this session belongs to, 0 for none. */
  trialId: number
  // Newer firmware: the token of the app that started it, and what was changed while it ran.
  token?: string
  finalFieldUT?: number
  fieldChanges?: number
  skips?: number
}
export interface LogPage { total: number, items: LogEntry[] }
/** The helmet sends at most this many log entries per request. */
export const LOG_PAGE = 10

/** Kp from NOAA, asked now (the Helmet tab's "Update Kp from NOAA"). */
export const fetchKp = () => freshKp(true)

// ---------------------------------------------------------------- forms
// Test inputs live here, so they survive leaving the tab (e.g. the detour to
// the safety page) and the reading goes to the right coil.
export const cal = reactive<{
  ch: number
  mA: NumberInput
  sec: NumberInput
  /** Measured field, in the unit shown. */
  measured: NumberInput
  /** Coil and current of the last DC test. */
  last: { ch: number, mA: number } | null
}>({ ch: 0, mA: 2, sec: 30, measured: '', last: null })
export const rot = reactive<{ layout: 'ring' | 'temporal', dir: 'ccw' | 'cw', dwellMs: NumberInput, mA: NumberInput }>({ layout: 'temporal', dir: 'ccw', dwellMs: 1000, mA: 2 })
/** Full-load test: all 8 outputs at once. */
export const load = reactive<{ mA: NumberInput, sec: NumberInput }>({ mA: 4.5, sec: 60 })

/** Editable copy of the helmet's settings; Calibration and Settings share it. */
export const draft = ref<HelmetSettings | null>(null)
// What the draft was copied from: the draft differs from it where something was edited.
let copied = ''
/** A fresh copy: on every visit, and after Save. */
export function loadDraft() {
  copied = device.settings ? JSON.stringify(device.settings) : ''
  draft.value = copied ? JSON.parse(copied) as HelmetSettings : null
}
/**
 * The helmet sent its settings (it does after every reconnect): a fresh copy,
 * unless something is edited and not saved. Then the edits stay, and "Not
 * saved yet" compares them with what the helmet has now.
 */
export function settingsArrived() {
  const d = draft.value
  const edited = !!d && !!copied && SETTINGS_KEYS.some((k) => JSON.stringify(d[k]) !== JSON.stringify((JSON.parse(copied) as HelmetSettings)[k]))
  if (!edited || !device.settings) loadDraft()
}
/** Whether any of these settings differs from what the helmet has. */
export function unsaved(keys: readonly SettingsKey[]) {
  const d = draft.value
  const saved = device.settings
  return !!d && !!saved && keys.some((k) => JSON.stringify(d[k]) !== JSON.stringify(saved[k]))
}

// Field inputs show the chosen unit (µT or mG); the helmet stores µT.
export const disp = (uT: NumberInput | null | undefined) => (uT === '' || uT == null ? undefined : Number(toDisplay(Number(uT)).toPrecision(6)))
export const fromInput = (v: string): NumberInput => (v === '' ? '' : Number(Number(fromDisplay(Number(v))).toPrecision(6)))
export const fieldStep = (uTStep: number) => toDisplay(uTStep) as number

/** The test that runs now (DC, rotation or full load), or null. */
export const runningTest = (): DeviceStatus | null => (device.status?.test && device.status.state !== 'idle' ? device.status : null)

// ---------------------------------------------------------------- actions
// The result of the last action, as a toast so it is seen wherever the
// button is: 3.5 s, errors 6 s, one at a time (the Log uses it too).
let lastToast: string | number | null = null

/** Call in setup. `run` reports how an action went; a refusal for safety leads to the safety page. */
export function useHelmetActions() {
  const toast = useToast()
  const { safetyPath } = useAppNav()

  function clear() {
    if (lastToast !== null) toast.remove(lastToast)
    lastToast = null
  }
  /** `long`: good news that needs the time of an error to be read (a blind session's reveal). */
  function flash(text: string, bad = false, opts: { long?: boolean, icon?: string } = {}) {
    clear()
    lastToast = toast.add({
      title: text,
      color: bad ? 'error' : 'success',
      icon: opts.icon ?? (bad ? 'i-lucide-circle-x' : 'i-lucide-check'),
      duration: bad || opts.long ? 6000 : 3500,
      // Read out politely, as before; an error may interrupt.
      type: bad ? 'foreground' : 'background',
    }).id
  }
  async function run(fn: () => unknown, ok?: string) {
    clear()
    try {
      await fn()
      if (ok) flash(ok)
    } catch (e) {
      const msg = errorMessage(e)
      flash(msg, true)
      if (/safety/.test(msg)) navigateTo(safetyPath())
    }
  }

  const saveSettings = () => run(async () => {
    const s = draft.value
    if (!s) throw new Error('Connect the helmet first (or use the demo).')
    await call('settings.set', Object.fromEntries(SETTINGS_KEYS.map((k) => [k, s[k]])))
    await refresh()
    loadDraft() // what the helmet has now (it may have clamped a value)
  }, 'Saved.')
  const stopTest = () => run(() => call('session.stop'))

  return { flash, run, saveSettings, stopTest }
}
