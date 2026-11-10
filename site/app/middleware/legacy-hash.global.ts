// Links to the old hash-routed app (/#programs/<id>/brain, /#docs/wiring, …)
// arrive at the site's root with their hash; send them to the page that
// replaced it. Only on arrival and only at the root: on other pages a hash is
// a heading (#safety, #programs), and must stay one.
import { lastProgramId } from '#core/lib/lastProgram.js'
import { appPathFromHash } from '~~/shared/links'

let arrived = false

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server || arrived) return
  arrived = true
  if (to.path !== '/') return
  // The address bar, not the router's copy: the router has already decoded
  // the hash, and "#safety/programs%2Fobe" must be split before decoding.
  const path = appPathFromHash(window.location.hash, { lastProgram: lastProgramId })
  // A fresh page load, not a route change: the start page's delivered HTML
  // must not be taken over as if it were the app's.
  if (path) return navigateTo(path, { replace: true, external: true })
})
