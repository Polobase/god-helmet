// The helmet connection (webapp/src/ble, plain JavaScript) with types on it.
// Kept apart from lib/programs.ts: the site header shows a running session on
// every page and must not load the program library to do so.
import * as deviceJs from '#core/ble/device.js'

/** Live status, pushed by the helmet (or polled over USB). */
export interface DeviceStatus {
  state: 'idle' | 'running' | 'stopping' | (string & {})
  blind?: boolean
  test?: boolean
  logId?: number
  sessionId: string
  sessionName: string
  phase: number
  phaseCount: number
  phaseName: string
  elapsedMs: number
  programMs: number
  totalMs: number
  phaseMs: number
  phaseDurationMs: number
  envelope?: number
  fieldUT?: number
  testMA?: number
  /** Drive per coil, 0..1; left out in blind sessions. */
  levels?: number[]
  /** Why the last session ended. */
  lastStopReason?: string
  // Newer firmware: which session this is. They stay after it ends, until the next start.
  bootId?: number
  /** The token the app that started it chose. */
  token?: string
  presetId?: string
  startEpoch?: number
  trialId?: number
  // Set by estimateStatus(): moved on by the clock since it arrived; its planned end has passed.
  estimated?: boolean
  over?: boolean
}
/** The reply to "hello": what this helmet is and allows. */
export interface DeviceInfo {
  safetyAccepted?: boolean
  maxFieldUT?: number
  maxReachableUT?: number
  minIntervalS?: number
  // Newer firmware: which helmet (12 hex digits, fixed), which start of it, and why it started.
  helmetId?: string
  bootId?: number
  uptimeS?: number
  resetReason?: string
  /** The log entry it closed at this start, because it restarted during that session. */
  recoveredLogId?: number
  [key: string]: unknown
}
export type DeviceKind = 'ble' | 'usb' | 'demo'
export type LinkState = 'none' | 'connecting' | 'connected' | 'lost' | 'reconnecting'
/** One line about the connection. `lost`: it is down now. */
export interface LinkNote { tone: 'success' | 'warning' | 'info', text: string, at: number, lost?: boolean }
/** What a reconnect found. */
export interface LinkEvent {
  type: 'back' | 'running' | 'ended' | 'restarted' | 'other'
  kind: DeviceKind
  name: string
  session?: DeviceStatus | null
  logId?: number
  /** The helmet's word for why the session ended. */
  reason?: string
  resetReason?: string
  /** When it ended (ms), 0 when the helmet cannot say. */
  endedAt?: number
  elapsedMs?: number
  /** The link stayed up (the helmet's start-up line arrived over USB). */
  linkKept?: boolean
}
export interface DeviceState {
  /** The helmet in use, also while its link is down; null when there is none. */
  kind: DeviceKind | null
  name: string
  connecting: boolean
  info: DeviceInfo | null
  settings: Record<string, unknown> | null
  /** The live status; while the link is down the last one known (see `stale`). */
  status: DeviceStatus | null
  error: string
  /** Web Bluetooth, and Web Serial (USB), in this browser. */
  bluetooth: boolean
  serial: boolean
  kp: { kp: number, ap: number, time?: string } | null
  kpAt: number
  testLayout: 'ring' | 'temporal'
  link: LinkState
  /** When `status` arrived (ms). */
  statusAt: number
  /** `status` is not live: the link is down, or the helmet has gone quiet. */
  stale: boolean
  /** The first status after connecting is in: only now is it known whether a session runs. */
  ready: boolean
  lostAt: number
  lostWhy: '' | 'drop' | 'silent' | 'reload'
  /** The app stopped trying to reconnect by itself. */
  gaveUp: boolean
  /** Only the browser's chooser brings the helmet back. */
  needsChooser: boolean
  event: LinkEvent | null
  notice: LinkNote | null
}

export const device = deviceJs.device as DeviceState
export const connect = deviceJs.connect as (kind: DeviceKind) => Promise<void>
export const disconnect = deviceJs.disconnect as () => void
/** The Reconnect button: tries at once; opens the browser's chooser where only that helps. */
export const reconnect = deviceJs.reconnect as () => Promise<void>
/** One request to the helmet; rejects with the helmet's error message, or at once when the link is down. */
export const call = deviceJs.call as <T = Record<string, unknown>>(op: string, params?: Record<string, unknown>, timeoutMs?: number) => Promise<T>
/**
 * Starts a session, a test or a trial with a fresh token. When the reply does
 * not arrive, the app finds out what the helmet did with it once the link is
 * back: nothing is started twice, nothing runs unknown. `already`: found, not
 * started now.
 */
export const start = deviceJs.start as <T = { logId?: number, already?: boolean, ended?: boolean }>(
  op: 'session.start' | 'test' | 'trial.new', params?: Record<string, unknown>,
  /** `wanted`: asked before the request is sent a second time; false calls it off (the error then has the code 'unwanted'). */
  options?: { token?: string, onWaiting?: (e: unknown) => void, wanted?: () => boolean },
) => Promise<T>
export const newToken = deviceJs.newToken as () => string
export const refresh = deviceJs.refresh as () => Promise<void>
/** Asks for the status now instead of waiting for the next one. */
export const readStatus = deviceJs.readStatus as () => Promise<DeviceStatus>
/** The link is up. */
export const connected = deviceJs.connected as () => boolean
/** The link dropped and the helmet cannot be reached now (the app may be reconnecting). */
export const linkLost = deviceJs.linkLost as () => boolean
export const maxFieldUT = deviceJs.maxFieldUT as () => number
/** A session is on the helmet, as far as the app knows (also from the last status before the link dropped). */
export const running = deviceJs.running as () => boolean
/** Which helmet: its fixed id, or for older firmware how it is reached and its name. */
export const helmetKey = deviceJs.helmetKey as (info?: DeviceInfo | null, kind?: DeviceKind | null, name?: string) => string
/** The line about the connection: while it is down what is known, afterwards what was found. */
export const linkNote = deviceJs.linkNote as (now?: number) => LinkNote | null
export const dismissNotice = deviceJs.dismissNotice as () => void
/** The status as it probably is `ageMs` after it arrived. */
export const estimateStatus = deviceJs.estimateStatus as <S extends DeviceStatus | null>(status: S, ageMs: number) => S
export const stopReasonText = deviceJs.stopReasonText as (reason: string | undefined, keepaliveS?: number) => string
/** NOAA's Kp, fetched again when older than three hours (`force`: now); never an old one as fresh. */
export const freshKp = deviceJs.freshKp as unknown as (force?: boolean) => Promise<{ kp: number, ap: number, time?: string }>

/** Why Stop, Skip and the intensity are switched off while the link is down. */
export const NEEDS_LINK = 'No connection: only the STOP button on the helmet works now.'
/** Stop is given this long (ms) for its answer, not the usual 20 s: a Stop that got lost must be said soon. */
export const STOP_ANSWER_MS = 8000

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * After a page reload: the helmet that was connected, and its session, are
 * shown again and the app reconnects. Does nothing while a helmet is in use.
 */
export const restore = deviceJs.restore as (options?: { sessionOnly?: boolean }) => boolean

// Once per page load. On the public pages (their header loads this for the
// session pill) only when a session is on the helmet: reading the docs must
// not reach for an idle helmet. The app's header asks again without that limit.
if (import.meta.client) restore({ sessionOnly: !location.pathname.startsWith('/app') })
