// The service worker, written out at build time so that every build has its
// own cache: a new version starts clean, and the old cache is dropped.
// It lets the app be installed and opened without a network.
//   pages       network first; offline, the page as last seen, and for the
//               app the client-only shell
//   /_nuxt/*    cache first (the file names carry a content hash)
//   /firmware/* never cached: images and manifests are replaced under the
//               same names, and a stale installer is worse than none
//   the rest    cache, refreshed in the background
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

export default defineEventHandler(async (event) => {
  setHeader(event, 'content-type', 'text/javascript; charset=utf-8')
  const config = useRuntimeConfig(event)
  const build = config.app.buildId
  // The built files of the app (modules/app-assets.ts says where they are).
  // Not the in-browser database of the documents: the app does not use it.
  const built = await readdir(resolve(String(config.clientDir), '_nuxt')).catch(() => [] as string[])
  const assets = built.filter((f) => /\.(js|css|woff2|json)$/.test(f) && !f.startsWith('sqlite3')).map((f) => `/_nuxt/${f}`)
  return `const CACHE = 'godhelmet-site-${build}'
const SHELL = '/200'
const ASSETS = ${JSON.stringify(assets)}
const isApp = (path) => path === '/app' || path.startsWith('/app/')

// The first time the app is opened, the rest of it is fetched in the
// background, so that every screen opens later without a network (in a dark
// room with the phone in flight mode, say). Readers of the articles are not
// charged for it.
let warming = null
function warm() {
  warming ??= caches.open(CACHE).then(async (cache) => {
    if (await cache.match('/__app-ready')) return
    for (const url of ASSETS) {
      if (await cache.match(url)) continue
      const response = await fetch(url).catch(() => null)
      if (response && response.ok) await cache.put(url, response)
      else return void (warming = null) // offline or interrupted: try again next time
    }
    await cache.put('/__app-ready', new Response('ok'))
  })
  return warming
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

// Keeps a copy. The copy is taken now, before the page starts reading the response.
function keep(key, response) {
  if (response.ok && response.type === 'basic') {
    const copy = response.clone()
    caches.open(CACHE).then((c) => c.put(key, copy))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/firmware/')) return

  if (request.mode === 'navigate') {
    // Every app address is the same shell: one copy serves them all offline.
    const key = isApp(url.pathname) ? SHELL : request
    if (isApp(url.pathname)) event.waitUntil(warm())
    event.respondWith(
      fetch(request).then((r) => keep(key, r)).catch(async () => (await caches.match(key)) ?? Response.error()),
    )
    return
  }

  if (url.pathname.startsWith('/_nuxt/')) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((r) => keep(request, r))))
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request).then((r) => keep(request, r))
      if (!cached) return fresh
      fresh.catch(() => {})
      return cached
    }),
  )
})
`
})
