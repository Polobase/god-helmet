import { DEFAULT_PROGRAM } from './lastProgram.js'

// Hash routes without the DOM (lib/nav.js applies them to the page):
//   #tab, #tab/arg, #tab/arg/sub   each part URI-encoded on its own
//   #programs                      program library
//   #programs/<id>[/<sub>]         one program (sub: placement, brain, sources)
//   #trials[/pictures]             blinded trials, and the picture pool they draw from
//   #helmet                        connection, safety, calibration, settings, firmware
//   #safety/<route>                safety page; <route> (one encoded part) is where Continue returns

export const TABS = [
  { key: 'programs', label: 'Programs' },
  { key: 'guides', label: 'Guides' },
  { key: 'trials', label: 'Trials' },
  { key: 'log', label: 'Log' },
  { key: 'helmet', label: 'Helmet' },
  { key: 'docs', label: 'Docs' },
]

// Routes without a tab button of their own: route -> the tab that lights up.
export const HIDDEN = { safety: 'helmet' }

// Old routes, rewritten in place: route -> (arg, sub, ctx) -> new hash.
// ctx.lastProgram(): the program an old link without an id opens.
const programOf = (arg, ctx) => arg || ctx.lastProgram?.() || DEFAULT_PROGRAM
export const LEGACY = {
  placement: (arg, sub, ctx) => routeHash('programs', programOf(arg, ctx), 'placement'),
  brain: (arg, sub, ctx) => routeHash('programs', programOf(arg, ctx), 'brain'),
  experiment: () => '#trials',
  targets: () => routeHash('trials', 'pictures'),
  setup: () => '#helmet',
}

export const DEFAULT_TAB = 'programs'

const isRoute = (key) => TABS.some((t) => t.key === key) || key in HIDDEN
const decode = (s) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

// "#a/b/c" -> { tab, arg, sub } (decoded); old routes -> { redirect: '#new' }.
// ctx.lastProgram() names the program an old route without an id opens.
export function resolveRoute(hash, ctx = {}) {
  const [tab = '', arg = '', sub = ''] = String(hash ?? '').replace(/^#/, '').split('/')
  if (LEGACY[tab]) return { redirect: LEGACY[tab](decode(arg), decode(sub), ctx) }
  if (!isRoute(tab)) return { tab: DEFAULT_TAB, arg: '', sub: '' }
  return { tab, arg: decode(arg), sub: arg ? decode(sub) : '' }
}

export function routeHash(tab, arg = '', sub = '') {
  return `#${tab}${arg ? `/${encodeURIComponent(arg)}${sub ? `/${encodeURIComponent(sub)}` : ''}` : ''}`
}

// Is this href an app route (#programs, #brain/x, ...) rather than an in-page anchor?
export function isAppHash(href) {
  const m = /^#([a-z]+)(\/|$)/.exec(href ?? '')
  return !!m && (isRoute(m[1]) || m[1] in LEGACY)
}

// The tab button that is lit for a route.
export const tabOf = (route) => HIDDEN[route] ?? route

// Where a tab button leads: back to the tab's last route, or to its start
// when it is already open (Programs -> the library).
export function tabTarget(key, currentTab, memory = {}) {
  return key === currentTab || !memory[key] ? `#${key}` : memory[key]
}

// The safety page's way back: a known route, else the program library.
export function backRoute(route) {
  const tab = String(route ?? '').split('/')[0]
  return isRoute(tab) || tab in LEGACY ? route : DEFAULT_TAB
}
