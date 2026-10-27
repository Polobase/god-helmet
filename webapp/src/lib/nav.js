// Tab navigation synced with location.hash (#programs, #programs/obe, #placement, ...).
import { reactive } from 'vue'

export const TABS = [
  { key: 'programs', label: 'Programs' },
  { key: 'placement', label: 'Placement' },
  { key: 'brain', label: 'Brain' },
  { key: 'guides', label: 'Guides' },
  { key: 'experiment', label: 'Experiment' },
  { key: 'targets', label: 'Targets' },
  { key: 'log', label: 'Log' },
  { key: 'setup', label: 'Setup' },
  { key: 'safety', label: 'Safety' },
  { key: 'docs', label: 'Docs' },
]

function parse() {
  const [tab, arg] = location.hash.replace(/^#/, '').split('/')
  return { tab: TABS.some((t) => t.key === tab) ? tab : 'programs', arg: arg ? decodeURIComponent(arg) : '' }
}

export const nav = reactive(parse())

window.addEventListener('hashchange', () => Object.assign(nav, parse()))

export function go(tab, arg = '') {
  location.hash = arg ? `${tab}/${encodeURIComponent(arg)}` : tab
}

// Detour to the safety page when the helmet refuses to start. `back` is the
// route to return to after accepting: 'experiment' or 'programs/<id>'.
export const goSafety = (back) => go('safety', back)
export function returnFromSafety() {
  const [tab, ...rest] = (nav.arg || 'programs').split('/')
  go(TABS.some((t) => t.key === tab) ? tab : 'programs', rest.join('/'))
}
