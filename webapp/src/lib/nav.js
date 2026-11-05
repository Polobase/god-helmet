// Tab navigation synced with location.hash (#programs, #programs/obe/brain, ...).
// The routes themselves are in lib/routes.js.
import { reactive } from 'vue'
import { TABS, resolveRoute, routeHash, tabOf, tabTarget, backRoute, HIDDEN } from './routes.js'
import { lastProgramId } from './lastProgram.js'

export { TABS, tabOf }

const ctx = { lastProgram: lastProgramId }

// The current route; an old route is rewritten in place (no extra history entry).
function current() {
  const r = resolveRoute(location.hash, ctx)
  if (!r.redirect) return r
  history.replaceState(null, '', r.redirect)
  return resolveRoute(r.redirect, ctx)
}

export const nav = reactive(current())

// Each tab's last route, so a tab button brings you back to where you were.
const memory = {}
function remember() {
  if (!(nav.tab in HIDDEN)) memory[nav.tab] = location.hash || `#${nav.tab}`
}
remember()

window.addEventListener('hashchange', () => {
  Object.assign(nav, current())
  remember()
})

export function go(tab, arg = '', sub = '') {
  location.hash = routeHash(tab, arg, sub)
}

// A tab button: the tab's last route, or its start when it is already open.
export function openTab(key) {
  location.hash = tabTarget(key, tabOf(nav.tab), memory)
}

// Detour to the safety page when the helmet refuses to start. `back` is the
// route to return to after accepting, e.g. 'experiment' or 'programs/<id>'.
export const goSafety = (back) => go('safety', back)
export function returnFromSafety() {
  location.hash = `#${backRoute(nav.arg)}`
}
