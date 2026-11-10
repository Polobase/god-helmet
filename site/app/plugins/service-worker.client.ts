// Registers the service worker (server/routes/sw.js.ts) in the built site, so the app
// can be installed and opened offline. Not in development: it would serve
// stale modules.
export default defineNuxtPlugin(() => {
  if (import.meta.dev || !('serviceWorker' in navigator)) return
  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => { /* private mode, or blocked: the site works without it */ })
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
})
