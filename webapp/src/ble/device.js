// Shared connection state for all views.
import { reactive } from 'vue'
import { openBluetooth, bluetoothAvailable } from './bluetooth.js'
import { openDemo } from './demo.js'
import { fetchKp } from '../lib/noaa.js'

export const device = reactive({
  kind: null,          // 'ble' | 'demo' | null
  name: '',
  connecting: false,
  info: null,          // "hello" data
  settings: null,
  status: null,        // live status (2 Hz while running)
  error: '',
  bluetooth: bluetoothAvailable(),
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
        reset()
      },
    }
    await afterConnect(kind === 'demo' ? openDemo(handlers) : await openBluetooth(handlers))
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
export const running = () => !!device.status && device.status.state !== 'idle'
