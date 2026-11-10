import { fileURLToPath } from 'node:url'

// The engine, audio, protocol and lib modules are shared with the old app in
// webapp/ until cut-over: one source of truth, guarded by webapp's tests.
const core = fileURLToPath(new URL('../webapp/src', import.meta.url))
const repo = fileURLToPath(new URL('..', import.meta.url))

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/content', '@nuxt/eslint'],

  devtools: { enabled: false },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
      ],
      meta: [
        { name: 'theme-color', content: '#070b0d', media: '(prefers-color-scheme: dark)' },
        { name: 'theme-color', content: '#f6f9f9', media: '(prefers-color-scheme: light)' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  // The public address of the site (NUXT_PUBLIC_SITE_URL), for canonical
  // links and the sitemap. Empty while it only runs locally.
  // firmwareBase: where the installer (Helmet tab) finds the firmware images.
  // Default: this site's own /firmware/ (CI puts them there). A build that
  // cannot make them (Cloudflare's own Git build) sets
  // NUXT_PUBLIC_FIRMWARE_BASE to a place that has them.
  runtimeConfig: { clientDir: '', public: { siteUrl: '', firmwareBase: '/firmware' } },

  // Fonts are self-hosted from @fontsource (assets/css/main.css): no font CDN.
  ui: { fonts: false },

  // 'night' is a fourth mode next to system, light and dark (composables/useTheme.ts).
  colorMode: { preference: 'system', fallback: 'dark', storageKey: 'gh-theme' },

  alias: { '#core': core },

  // The control app needs Bluetooth, USB, IndexedDB and WebGL: client-only.
  routeRules: {
    '/app/**': { ssr: false },
  },

  content: {
    // Node's own SQLite: no native module to compile.
    experimental: { sqliteConnector: 'native' },
    build: { markdown: { toc: { depth: 3, searchDepth: 3 } } },
  },

  compatibilityDate: '2026-11-01',

  nitro: {
    // Plain static files in .output/public, wherever the build runs. Without
    // this, Cloudflare's builder is detected and another preset writes to dist/.
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: ['/', '/200.html', '/404.html', '/search.json', '/library.json', '/program-index.json', '/sw.js', ...(process.env.NUXT_PUBLIC_SITE_URL ? ['/sitemap.xml'] : [])],
      // The app is one client-only shell (200.html, see public/_redirects),
      // not a page per program.
      ignore: ['/app'],
      // /articles.html, not /articles/index.html: Cloudflare Pages then serves
      // /articles as it is, without a redirect to a trailing slash.
      autoSubfolderIndex: false,
    },
  },

  vite: {
    // Shared modules import "vue" from webapp/src; without this they would get
    // webapp/node_modules/vue, a second copy whose reactivity the app cannot see.
    resolve: { dedupe: ['vue', 'three', 'marked'] },
    server: { fs: { allow: [repo] } },
  },

  experimental: {
    // Fetch a link's page when it is hovered or focused, not as soon as it is
    // on screen: a link into the app would pull the whole program library.
    defaults: { nuxtLink: { prefetchOn: { visibility: false, interaction: true } } },
    // Pages cross-fade where the browser supports view transitions.
    viewTransition: true,
  },

  hooks: {
    // No "prefetch" hints in the pages' HTML: they made every public page
    // fetch the app's program library (1.9 MB) in the background.
    'build:manifest': (manifest) => {
      for (const file of Object.values(manifest)) {
        file.prefetch = false
        file.dynamicImports = []
      }
    },
  },

  typescript: { strict: true },

  eslint: { config: { stylistic: false } },
})
