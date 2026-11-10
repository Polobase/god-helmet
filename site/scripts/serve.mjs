// Serves the built site (.output/public) the way Cloudflare Pages does, for
// `npm run preview` and the end-to-end tests: /articles finds articles.html,
// every /app route gets the client-only shell and the 3xx lines of
// public/_redirects are followed first, as Pages does; anything else unknown
// gets 404.html with status 404.
//   node scripts/serve.mjs [port]
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../.output/public', import.meta.url))
const port = Number(process.argv[2] ?? process.env.PORT ?? 43117)
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.bin': 'application/octet-stream',
}
const isFile = async (p) => (await stat(p).catch(() => null))?.isFile() ?? false

// "from to status" lines with a 3xx status; `from` may end in /* (anything below).
const redirects = (await readFile(join(root, '_redirects'), 'utf8').catch(() => ''))
  .split('\n').map((l) => l.trim().split(/\s+/)).filter((p) => p.length === 3 && /^30[12378]$/.test(p[2]))
  .map(([from, to, status]) => ({ from, to, status: Number(status) }))
const redirectFor = (pathname) => redirects.find((r) => (r.from.endsWith('/*') ? pathname.startsWith(r.from.slice(0, -1)) : pathname === r.from))

async function resolve(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^([/\\]?\.\.)+/, '')
  const base = join(root, clean)
  for (const candidate of [base, `${base}.html`, join(base, 'index.html')]) if (await isFile(candidate)) return { file: candidate, status: 200 }
  if (clean === '/app' || clean.startsWith('/app/')) return { file: join(root, '200.html'), status: 200 }
  return { file: join(root, '404.html'), status: 404 }
}

createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://x').pathname
    const moved = redirectFor(pathname)
    if (moved) {
      res.writeHead(moved.status, { location: moved.to })
      return res.end()
    }
    const { file, status } = await resolve(pathname)
    const body = await readFile(file)
    res.writeHead(status, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': file.includes('/_nuxt/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    res.end(body)
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' })
    res.end(String(e))
  }
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`))
