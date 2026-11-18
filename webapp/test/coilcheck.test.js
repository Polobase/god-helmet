// Coil check with a phone magnetometer (src/lib/coilcheck.js): the phone address the dev proxy accepts, phyphox
// replies, the LED test pattern, and the fit that finds a coil's field in noisy readings.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { BLINK_HZ, TEST_SECONDS, SIGNAL_SECONDS, SIGNAL_FADE_S, ledLevel, phoneAddress, getQuery, parseGet, fitCoil, verdict, polarity, toCsv, signalProgram, fitSine } from '../src/lib/coilcheck.js'

// Deterministic noise: mulberry32 and Box-Muller.
function gauss(seed) {
  let a = seed >>> 0
  const uni = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return () => Math.sqrt(-2 * Math.log(uni() + 1e-12)) * Math.cos(2 * Math.PI * uni())
}

// A phone recording at 100 Hz: Earth's field, a slow drift, noise, and the coil's field following the LED pattern
// from phone time `trueStart` (a 0.5 s fade in and out, as the firmware does).
function recording({ field = [3, -1, 6], trueStart = 5.15, noise = 1.2, seconds = 35, seed = 7 } = {}) {
  const n = gauss(seed)
  const s = { t: [], x: [], y: [], z: [] }
  const earth = [-17, -20, -34]
  for (let i = 0; i < seconds * 100; i++) {
    const t = i / 100
    const dt = t - trueStart
    const env = dt < 0 || dt > TEST_SECONDS ? 0 : Math.min(1, dt / 0.5, (TEST_SECONDS - dt) / 0.5)
    const p = ledLevel(dt) * env
    s.t.push(t)
    ;['x', 'y', 'z'].forEach((k, j) => s[k].push(earth[j] + 0.05 * t + field[j] * p + noise * n()))
  }
  return s
}

test('phoneAddress: private IPv4 addresses only, port 8080 by default', () => {
  assert.equal(phoneAddress('192.168.68.52:8080'), '192.168.68.52:8080')
  assert.equal(phoneAddress('192.168.68.52'), '192.168.68.52:8080')
  assert.equal(phoneAddress(' http://10.0.0.7:8081/ '), '10.0.0.7:8081')
  assert.equal(phoneAddress('172.20.1.2:80'), '172.20.1.2:80')
  for (const bad of ['8.8.8.8:80', '172.32.0.1', '192.168.1.300', 'example.com:8080', '192.168.1.5:99999', '', null]) {
    assert.equal(phoneAddress(bad), null, String(bad))
  }
})

test('getQuery: the latest values, or the readings after a phone time', () => {
  assert.equal(getQuery(), 'mag_time&magX&magY&magZ&mag&magAccuracy')
  assert.equal(getQuery(12.5), 'mag_time=12.5&magX=12.5%7Cmag_time&magY=12.5%7Cmag_time&magZ=12.5%7Cmag_time&magAccuracy')
})

test('parseGet: phyphox buffers to readings, skipping values that are not numbers', () => {
  const json = {
    buffer: {
      mag_time: { buffer: [1.0, 1.01, 1.02] },
      magX: { buffer: [-219.9, -220.1, null] },
      magY: { buffer: [-0.61, -0.62, -0.63] },
      magZ: { buffer: [-517.8, -517.9, -518] },
      magAccuracy: { buffer: [0] },
    },
    status: { measuring: true },
  }
  const r = parseGet(json)
  assert.deepEqual(r.t, [1.0, 1.01])
  assert.deepEqual(r.x, [-219.9, -220.1])
  assert.equal(r.accuracy, 0)
  assert.equal(r.measuring, true)
  assert.deepEqual(parseGet({}).t, [])
})

test('ledLevel: +, pause, −, pause, a quarter of the period each', () => {
  const T = 1 / BLINK_HZ
  assert.deepEqual([0.1, T / 4 + 0.1, T / 2 + 0.1, (3 * T) / 4 + 0.1, T + 0.1].map((t) => ledLevel(t)), [1, 0, -1, 0, 1])
  assert.equal(ledLevel(-1), 0)
})

test('fitCoil: finds a 7 µT field in ±1.2 µT noise, with Earth, drift and a clock error of 0.15 s', () => {
  const field = [3, -1, 6]
  const s = recording({ field, trueStart: 5.15 })
  const fit = fitCoil(s, { startS: 5.0, mA: 4 })
  assert.ok(fit)
  fit.vector.forEach((a, k) => assert.ok(Math.abs(a - field[k]) < 0.2, `axis ${k}: ${a}`))
  assert.ok(Math.abs(fit.amp - Math.hypot(...field)) < 0.2)
  assert.equal(fit.axis, 'z')
  assert.equal(fit.sign, 1)
  assert.ok(Math.abs(fit.tau - 0.15) <= 0.06, `tau ${fit.tau}`)
  assert.ok(Math.abs(fit.perMA - Math.hypot(...field) / 4) < 0.05)
  assert.ok(fit.snr > 50)
  assert.deepEqual(verdict(fit, 'spacer'), { ok: true, text: 'Works.' })
})

test('fitCoil: the sign of a coil wired the other way round', () => {
  const fit = fitCoil(recording({ field: [-3, 1, -6], seed: 11 }), { startS: 5.1, mA: 4 })
  assert.equal(fit.axis, 'z')
  assert.equal(fit.sign, -1)
  const ref = fitCoil(recording({ field: [3, -1, 6], seed: 12 }), { startS: 5.1, mA: 4 })
  assert.equal(polarity(fit, ref), 'reversed')
  assert.equal(polarity(ref, ref), '')
  // Off the sensor spot the field turns towards the screen's plane: neither same nor reversed.
  const off = fitCoil(recording({ field: [6, 2, -1], seed: 13 }), { startS: 5.1, mA: 4 })
  assert.equal(polarity(off, ref), 'placed differently')
  // A coil a little off centre still points the same way.
  const tilted = fitCoil(recording({ field: [5, -2, 6], seed: 14 }), { startS: 5.1, mA: 4 })
  assert.equal(polarity(tilted, ref), 'same')
})

test('fitCoil and verdict: a dead coil, readings missing, and a coil off the sensor spot', () => {
  const dead = fitCoil(recording({ field: [0, 0, 0], seed: 3 }), { startS: 5.1, mA: 4 })
  assert.ok(dead.snr < 8, `snr ${dead.snr}`)
  assert.equal(verdict(dead, 'sensor').ok, false)
  assert.equal(fitCoil({ t: [], x: [], y: [], z: [] }, { startS: 0, mA: 4 }), null)
  assert.equal(verdict(null, 'sensor').ok, false)
  const weak = fitCoil(recording({ field: [0, 0, 3], seed: 5 }), { startS: 5.1, mA: 4 })
  assert.equal(verdict(weak, 'sensor').ok, null)
  assert.equal(verdict(weak, 'spacer').ok, true)
})

test('toCsv: the format tools/calibrate.py reads', () => {
  const csv = toCsv([{ mA: 4, amp: 7.123456 }, null, { mA: 4, amp: 6.5 }])
  assert.equal(csv, 'channel,mA,uT_on,uT_off\n1,4,7.123,0\n3,4,6.500,0\n')
})

test('signalProgram: one coil, a sine at the set intensity, a program the engine accepts', async () => {
  const { parseSession } = await import('../src/engine/session.js')
  const { patternValue } = await import('../src/engine/patterns.js')
  const doc = signalProgram({ channel: 2, hz: 7, uT: 5 })
  const s = parseSession(doc)
  assert.equal(s.phases.length, 1)
  assert.equal(s.phases[0].spatial.mode, 'single')
  assert.equal(s.phases[0].spatial.channel, 2)
  assert.equal(s.totalMs, SIGNAL_SECONDS * 1000)
  // The intensity is the peak: a quarter period in, the sine is at +1.
  assert.ok(Math.abs(patternValue(s.phases[0].pattern, 1000 / 7 / 4) - 1) < 1e-6)
})

// A phone recording of a sine of `hz` with a peak `field` per axis (µT), starting at phone time 5 with 1 s fades.
function sineRecording({ field = [2, -1, 4], hz = 7, noise = 1.2, seed = 21 } = {}) {
  const n = gauss(seed)
  const s = { t: [], x: [], y: [], z: [] }
  const earth = [-17, -20, -34]
  for (let i = 0; i < 30 * 100; i++) {
    const t = i / 100
    const dt = t - 5
    const env = dt < 0 || dt > SIGNAL_SECONDS ? 0 : Math.min(1, dt / SIGNAL_FADE_S, (SIGNAL_SECONDS - dt) / SIGNAL_FADE_S)
    const p = Math.sin(2 * Math.PI * hz * dt + 0.7) * env
    s.t.push(t)
    ;['x', 'y', 'z'].forEach((k, j) => s[k].push(earth[j] + 0.05 * t + field[j] * p + noise * n()))
  }
  return s
}

test('fitSine: the peak of a 4.6 µT sine in ±1.2 µT noise, at 1, 7 and 20 Hz, whatever its phase', () => {
  const field = [2, -1, 4]
  for (const hz of [1, 7, 20]) {
    const fit = fitSine(sineRecording({ field, hz, seed: 30 + hz }), { startS: 5.2, hz })
    assert.ok(Math.abs(fit.amp - Math.hypot(...field)) < 0.1, `${hz} Hz: ${fit.amp}`)
    assert.ok(fit.snr > 50, `${hz} Hz snr ${fit.snr}`)
  }
  const none = fitSine(sineRecording({ field: [0, 0, 0], seed: 9 }), { startS: 5.2, hz: 7 })
  assert.ok(none.snr < 8, `snr ${none.snr}`)
  assert.equal(fitSine({ t: [], x: [], y: [], z: [] }, { startS: 0, hz: 7 }), null)
})
