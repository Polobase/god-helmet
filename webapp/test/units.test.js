// Field units shown in the app (lib/units.js): µT or mG, values stay in µT.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { units, setFieldUnit, toggleFieldUnit, unitLabel, toDisplay, fromDisplay, fmtField, fmtSetting, fmtRef, fmtAdaptive } from '../src/lib/units.js'

test('tesla by default; 1 µT = 10 mG', () => {
  setFieldUnit('T')
  assert.equal(units.field, 'T')
  assert.equal(unitLabel(), 'µT')
  assert.equal(toDisplay(1.6), 1.6)
  setFieldUnit('G')
  assert.equal(unitLabel(), 'mG')
  assert.equal(toDisplay(1.6), 16)
  assert.equal(fromDisplay(16), 1.6)
  toggleFieldUnit()
  assert.equal(units.field, 'T')
})

test('estimated fields keep their significant digits in both units', () => {
  setFieldUnit('T')
  assert.equal(fmtField(0.31), '0.31 µT')
  assert.equal(fmtField(1.6), '1.6 µT')
  assert.equal(fmtField(0.046), '0.046 µT')
  assert.equal(fmtField(0.004), '<0.01 µT')
  setFieldUnit('G')
  assert.equal(fmtField(0.31), '3.1 mG')
  assert.equal(fmtField(1.6), '16 mG')
  assert.equal(fmtField(0.046), '0.46 mG')
  assert.equal(fmtField(0.31, false), '3.1')
  assert.equal(fmtAdaptive(NaN), '<0.01')
})

test('intensity settings: 0.1 µT steps are whole mG', () => {
  setFieldUnit('T')
  assert.equal(fmtSetting(1), '1.0 µT')
  assert.equal(fmtSetting(4.5, false), '4.5')
  setFieldUnit('G')
  assert.equal(fmtSetting(1), '10 mG')
  assert.equal(fmtSetting(0.1), '1 mG')
  assert.equal(fmtSetting(4.5, false), '45')
  assert.equal(fmtSetting('0.3'), '3 mG')
})

test('reference values', () => {
  setFieldUnit('T')
  assert.equal(fmtRef(48), '48 µT')
  setFieldUnit('G')
  assert.equal(fmtRef(48), '480 mG')
  assert.equal(fmtRef(200), '2000 mG')
  assert.equal(fmtRef(0.1), '1 mG')
  setFieldUnit('T')
})
