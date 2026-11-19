// Local app only (`npm run dev`): /phyphox/<phone address>/get?... and
// /phyphox/<phone address>/control?... are forwarded to the phone's phyphox
// remote access (http://<phone>/...), for the coil check on the Helmet page
// (components/helmet/CoilCheck.vue). A page loaded over https cannot fetch from
// a phone over http, and the published site has no server: the build leaves
// this route out. Only private IPv4 addresses and those two paths are forwarded.
import { phoneAddress } from '../../../core/lib/coilcheck.js'

const USAGE = 'Use /phyphox/<private IPv4 address:port>/get or /control'

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const m = /^([^/]+)\/(get|control)$/.exec(getRouterParam(event, 'path') ?? '')
  const host = m ? (phoneAddress(decodeURIComponent(m[1]!)) as string | null) : null
  setResponseHeader(event, 'cache-control', 'no-store')
  if (!m || !host || event.method !== 'GET') {
    setResponseStatus(event, 400)
    return USAGE
  }
  try {
    const r = await fetch(`http://${host}/${m[2]}${getRequestURL(event).search}`, { signal: AbortSignal.timeout(4000) })
    setResponseStatus(event, r.status)
    setResponseHeader(event, 'content-type', r.headers.get('content-type') ?? 'application/json')
    return Buffer.from(await r.arrayBuffer())
  } catch (e) {
    const why = e instanceof Error ? (e.name === 'TimeoutError' ? 'timeout' : e.message) : String(e)
    setResponseStatus(event, 502)
    return `The phone does not answer at ${host} (${why}). Is phyphox open with remote access on?`
  }
})
