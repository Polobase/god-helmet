// "Ready to start?" rows of the Start panel (lib/readiness.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readiness, hoursSinceLast, minGapHours } from '../src/lib/readiness.js'
import { cleanHead } from '../src/lib/tape.js'

const NOW = 1_800_000_000
const info = (o = {}) => ({ safetyAccepted: true, calibrated: true, lastSessionEpoch: 0, minIntervalS: 72 * 3600, env: { timeValid: true }, ...o })
const byKey = (rows) => Object.fromEntries(rows.map((r) => [r.key, r]))

test('not connected: only what the app knows', () => {
  const r = byKey(readiness({ device: {}, head: cleanHead({}), placed: 0, used: 8, nowS: NOW }))
  assert.equal(r.connect.status, 'bad')
  assert.equal(r.connect.action, 'connect')
  assert.equal(r.head.status, 'warn')
  assert.match(r.head.text, /typical head/)
  assert.equal(r.coils.text, 'Coils placed: 0 of 8')
  assert.equal(r.safety, undefined)
  assert.equal(r.calibrated, undefined)
  assert.equal(r.recent, undefined)
})

test('a ready helmet: every row ok', () => {
  const rows = readiness({
    device: { kind: 'ble', name: 'GodHelmet-B084', info: info({ lastSessionEpoch: NOW - 96 * 3600 }) },
    head: cleanHead({ nasionInion: 36, earEar: 35, circumference: 56 }), placed: 8, used: 8, nowS: NOW,
  })
  assert.ok(rows.every((x) => x.status === 'ok'), JSON.stringify(rows))
  const r = byKey(rows)
  assert.equal(r.connect.text, 'Connected: GodHelmet-B084 (Bluetooth)')
  assert.equal(r.head.text, 'Head measured: 36 / 35 / 56 cm')
  assert.equal(r.coils.text, 'All 8 coils placed')
  assert.equal(r.recent.text, 'Last session 4 days ago')
})

test('warnings: USB, safety, calibration, partly measured head, recent session', () => {
  const r = byKey(readiness({
    device: { kind: 'usb', name: 'Helmet (USB)', info: info({ safetyAccepted: false, calibrated: false, lastSessionEpoch: NOW - 20 * 3600 }) },
    head: cleanHead({ nasionInion: 36 }), placed: 1, used: 1, nowS: NOW,
  }))
  assert.equal(r.usb.status, 'warn')
  assert.equal(r.safety.status, 'bad')
  assert.equal(r.safety.action, 'safety')
  assert.equal(r.calibrated.action, 'calibrate')
  assert.equal(r.head.text, 'Head partly measured: ear to ear and round the band line are typical values')
  assert.equal(r.coils.text, 'The coil is placed')
  assert.equal(r.recent.status, 'warn')
  assert.equal(r.recent.text, 'Last session 20 h ago; 72 h between sessions is recommended')
})

test('the demo says that nothing is switched on', () => {
  const r = byKey(readiness({ device: { kind: 'demo', name: 'Demo', info: info() }, nowS: NOW }))
  assert.match(r.connect.text, /^Demo/)
  assert.equal(r.head, undefined)
  assert.equal(r.coils, undefined)
})

test('last-session time needs a valid helmet clock; the gap comes from the helmet', () => {
  assert.equal(hoursSinceLast(info({ lastSessionEpoch: 0 }), NOW), null)
  assert.equal(hoursSinceLast(info({ lastSessionEpoch: NOW - 3600, env: { timeValid: false } }), NOW), null)
  assert.equal(hoursSinceLast(info({ lastSessionEpoch: NOW - 7200 }), NOW), 2)
  assert.equal(minGapHours(info({ minIntervalS: 48 * 3600 })), 48)
  assert.equal(minGapHours({}), 72)
})
