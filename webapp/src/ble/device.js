// Shared connection state for all views.
import { reactive } from 'vue'
import { openBluetooth, bluetoothAvailable } from './bluetooth.js'
import { openSerial, serialAvailable } from './serial.js'
import { openDemo } from './demo.js'
import { fetchKp } from '../lib/noaa.js'

export const device = reactive({
  kind: null,          // 'ble' | 'usb' | 'demo' | null
  name: '',
  connecting: false,
  info: null,          // "hello" data
  settings: null,
  status: null,        // live status (2 Hz while running)
  error: '',
  bluetooth: bluetoothAvailable(),
  serial: serialAvailable(),  // Web Serial: USB
  kp: null,            // { kp, ap, time } from NOAA
  testLayout: 'temporal', // layout to draw while a rotation test runs
})

let transport = null

function reset() {
  transport = null
  Object.assign(device, { kind: null, name: '', info: null, settings: null, status: null })
}

async function afterConnect(t) {
  transport = t
  device.kind = t.kind
  device.name = t.name
  await call('time.set', { epochMs: Date.now() })
  await refresh()
  try {
    device.kp = device.kp ?? (await fetchKp())
    await call('env.set', { kp: device.kp.kp, ap: device.kp.ap, source: 'noaa' })
  } catch {
    /* offline: Kp can be entered by hand in Setup */
  }
}

export async function connect(kind) {
  if (device.connecting) return
  device.error = ''
  device.connecting = true
  try {
    const handlers = {
      onStatus: (s) => (device.status = s),
      onDisconnect: () => {
        if (device.kind === 'ble') device.error = 'Helmet disconnected. A running session continues on the helmet; reconnect to control it.'
        if (device.kind === 'usb') device.error = 'USB disconnected. A running session continues on the helmet; plug it in and connect again to control it.'
        reset()
      },
      // The board printed its start-up line: it restarted, and any session on it has ended.
      onRestart: () => {
        if (device.kind) device.error = 'The helmet restarted (any running session has ended). Reconnect if it does not answer.'
      },
    }
    const open = { demo: () => openDemo(handlers), usb: () => openSerial(handlers), ble: () => openBluetooth(handlers) }
    await afterConnect(await (open[kind] ?? open.ble)())
  } catch (e) {
    if (e.name !== 'NotFoundError') device.error = e.message // NotFoundError = chooser cancelled
    transport?.close()
    reset()
  } finally {
    device.connecting = false
  }
}

export function disconnect() {
  transport?.close()
  reset()
}

export async function call(op, params) {
  if (!transport) throw new Error('Connect the helmet first (or use the demo).')
  return transport.call(op, params)
}

export async function refresh() {
  device.info = await call('hello')
  device.settings = await call('settings.get')
}

export const connected = () => !!device.kind
// The highest intensity (µT at 20 mm) this helmet allows: its setting, and what its coils can reach.
export const maxFieldUT = () => Math.min(device.info?.maxFieldUT ?? 5, device.info?.maxReachableUT ?? 5)
export const running = () => !!device.status && device.status.state !== 'idle'
