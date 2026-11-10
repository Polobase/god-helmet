// Tells the server routes where the built client files are, so that the
// service worker (server/routes/sw.js.ts) can list them at build time.
import { join } from 'node:path'
import { defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'app-assets' },
  setup(_options, nuxt) {
    nuxt.options.runtimeConfig.clientDir = join(nuxt.options.buildDir, 'dist/client')
  },
})
