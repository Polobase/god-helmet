// Hash routes (lib/routes.js): parsing, building, tab memory, the safety detour.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRoute, routeHash, isAppHash, tabTarget, backRoute, tabOf, TABS, DEFAULT_TAB } from '../src/lib/routes.js'
import { DEFAULT_PROGRAM } from '../src/lib/lastProgram.js'

test('parses tab, arg and sub', () => {
  assert.deepEqual(resolveRoute('#programs'), { tab: 'programs', arg: '', sub: '' })
  assert.deepEqual(resolveRoute('#programs/obe'), { tab: 'programs', arg: 'obe', sub: '' })
  assert.deepEqual(resolveRoute('#programs/obe/brain'), { tab: 'programs', arg: 'obe', sub: 'brain' })
  assert.deepEqual(resolveRoute('#guides/crv-session'), { tab: 'guides', arg: 'crv-session', sub: '' })
})

test('unknown or empty routes open the default tab', () => {
  for (const h of ['', '#', '#nope', '#nope/x', undefined]) assert.deepEqual(resolveRoute(h), { tab: DEFAULT_TAB, arg: '', sub: '' })
})

test('parts are decoded once; a bad escape is kept as it is', () => {
  assert.equal(resolveRoute('#safety/programs%2Fobe').arg, 'programs/obe')
  assert.equal(resolveRoute('#safety/guides%2Fcrv-session').arg, 'guides/crv-session')
  assert.equal(resolveRoute('#docs/a%20b').arg, 'a b')
  assert.equal(resolveRoute('#docs/50%').arg, '50%')
})

test('routeHash encodes each part and drops a sub without an arg', () => {
  assert.equal(routeHash('programs'), '#programs')
  assert.equal(routeHash('programs', 'obe'), '#programs/obe')
  assert.equal(routeHash('programs', 'obe', 'brain'), '#programs/obe/brain')
  assert.equal(routeHash('programs', '', 'brain'), '#programs')
  assert.equal(routeHash('safety', 'programs/obe/placement'), '#safety/programs%2Fobe%2Fplacement')
  for (const [tab, arg, sub] of [['programs', 'a b', 'brain'], ['safety', 'guides/x', ''], ['docs', 'readme', '']]) {
    assert.deepEqual(resolveRoute(routeHash(tab, arg, sub)), { tab, arg, sub })
  }
})

test('the safety detour returns to the same program and sub-tab', () => {
  const back = 'programs/god-helmet-classic/placement'
  const r = resolveRoute(routeHash('safety', back))
  assert.equal(r.tab, 'safety')
  assert.equal(backRoute(r.arg), back)
  assert.deepEqual(resolveRoute(`#${backRoute(r.arg)}`), { tab: 'programs', arg: 'god-helmet-classic', sub: 'placement' })
  assert.equal(backRoute('experiment'), 'experiment')
  assert.equal(backRoute(''), DEFAULT_TAB)
  assert.equal(backRoute('javascript:alert(1)'), DEFAULT_TAB)
  assert.equal(backRoute('nope/x'), DEFAULT_TAB)
})

test('app links are told apart from in-page anchors', () => {
  for (const t of TABS) assert.ok(isAppHash(`#${t.key}`), t.key)
  assert.ok(isAppHash('#programs/obe'))
  assert.ok(isAppHash('#docs/safety'))
  assert.ok(!isAppHash('#coil-preparation'))
  assert.ok(!isAppHash('#programs-and-placement'))
  assert.ok(!isAppHash('https://example.org/#programs'))
  assert.ok(!isAppHash(''))
})

test('a tab button returns to the tab, or to its start when already open', () => {
  const memory = { programs: '#programs/obe/brain', guides: '#guides/crv-session' }
  assert.equal(tabTarget('programs', 'log', memory), '#programs/obe/brain')
  assert.equal(tabTarget('programs', 'programs', memory), '#programs')
  assert.equal(tabTarget('guides', 'programs', memory), '#guides/crv-session')
  assert.equal(tabTarget('log', 'programs', memory), '#log')
  assert.equal(tabOf('programs'), 'programs')
})

test('old Brain links open the program page on its Brain tab', () => {
  assert.deepEqual(resolveRoute('#brain/obe', { lastProgram: () => 'x' }), { redirect: '#programs/obe/brain' })
  assert.deepEqual(resolveRoute('#brain', { lastProgram: () => 'obe' }), { redirect: '#programs/obe/brain' })
  assert.ok(isAppHash('#brain/god-helmet-classic'))
  assert.ok(!TABS.some((t) => t.key === 'brain'))
})

test('old Placement links open the program page on its Placement tab', () => {
  const ctx = { lastProgram: () => 'obe' }
  assert.deepEqual(resolveRoute('#placement/god-helmet-classic', ctx), { redirect: '#programs/god-helmet-classic/placement' })
  assert.deepEqual(resolveRoute('#placement', ctx), { redirect: '#programs/obe/placement' })
  assert.deepEqual(resolveRoute('#placement', { lastProgram: () => '' }), { redirect: `#programs/${DEFAULT_PROGRAM}/placement` })
  assert.deepEqual(resolveRoute('#placement'), { redirect: `#programs/${DEFAULT_PROGRAM}/placement` })
  assert.ok(isAppHash('#placement'), 'docs links to #placement stay app links')
  assert.equal(backRoute('placement/obe'), 'placement/obe')
  assert.ok(!TABS.some((t) => t.key === 'placement'))
})
