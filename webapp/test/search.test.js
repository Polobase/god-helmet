// Word search of the program library and switcher (lib/search.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { norm, tokens, queryWords, wordScore, score } from '../src/lib/search.js'

test('normalises case and accents and splits words', () => {
  assert.equal(norm('Über Kopf'), 'uber kopf')
  assert.deepEqual(tokens('Right TPJ (T8, FT8)'), ['right', 'tpj', 't8', 'ft8'])
  assert.deepEqual(queryWords('  OBE  t7 - '), ['obe', 't7'])
})

test('whole word > word start > substring of 4+ letters', () => {
  assert.equal(wordScore('t7', 'FT7 T7 TP7'), 3)
  assert.equal(wordScore('amyg', 'left amygdala'), 2)
  assert.equal(wordScore('gdala', 'left amygdala'), 1)
  assert.equal(wordScore('gda', 'left amygdala'), 0)
  assert.equal(wordScore('10-10', 'standard 10-10 sites'), 1)
})

test('every word must match some field; fields are weighted', () => {
  const fields = [['God Helmet classic', 3], ['Persinger and Koren two-phase procedure', 1]]
  assert.equal(score(queryWords('god persinger'), fields), 9 + 3)
  assert.equal(score(queryWords('god shakti'), fields), 0)
  assert.equal(score([], fields), 0)
  // a name match outranks the same word in the description
  const inName = score(['chirp'], [['Chirp sweep', 3], ['', 1]])
  const inText = score(['chirp'], [['Sweep', 3], ['modulated 40 Hz chirp', 1]])
  assert.ok(inName > inText)
})

test('an exact id wins', () => {
  assert.equal(score(['obe'], [['Out-of-body (right TPJ)', 3]], 'obe'), 1000)
  assert.ok(score(['obe'], [['Out-of-body', 3], ['OBE facilitation', 1]], 'obe-chirp') < 1000)
})
