import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { phoneAddress } from './src/lib/coilcheck.js'

// Dev server only: /phyphox/<phone address>/get?... and /phyphox/<phone address>/control?... are forwarded to the
// phone's phyphox remote access (http://<phone>/...), for the coil check on the Helmet page
// (src/components/CoilCheck.vue). A page loaded over https cannot fetch from a phone over http, so the coil check
// runs from `npm run dev`. Only private IPv4 addresses and those two paths are forwarded.
function phyphoxProxy() {
  return {
    name: 'phyphox-proxy',
    configureServer(server) {
      server.middlewares.use('/phyphox', async (req, res) => {
        const m = /^\/([^/?]+)\/(get|control)(\?[^#]*)?$/.exec(req.url ?? '')
        const host = m && phoneAddress(decodeURIComponent(m[1]))
        if (!host || req.method !== 'GET') {
          res.statusCode = 400
          res.end('Use /phyphox/<private IPv4 address:port>/get or /control')
          return
        }
        try {
          const r = await fetch(`http://${host}/${m[2]}${m[3] ?? ''}`, { signal: AbortSignal.timeout(4000) })
          res.statusCode = r.status
          res.setHeader('content-type', r.headers.get('content-type') ?? 'application/json')
          res.setHeader('cache-control', 'no-store')
          res.end(Buffer.from(await r.arrayBuffer()))
        } catch (e) {
          res.statusCode = 502
          res.end(`The phone does not answer at ${host} (${e.name === 'TimeoutError' ? 'timeout' : e.message}). Is phyphox open with remote access on?`)
        }
      })
    },
  }
}

// base './' keeps every URL relative, so the build works on any GitHub Pages
// path (https://<user>.github.io/<repo>/) without knowing the repo name.
export default defineConfig({
  base: './',
  plugins: [vue(), phyphoxProxy()],
  server: { fs: { allow: ['..'] } },  // presets live in ../presets
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
})
