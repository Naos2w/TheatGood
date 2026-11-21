/**
 * Vite development-only private Showtime research preview.
 * Never enabled for vite preview, production builds or public hostnames.
 * If the dev server is bound to a LAN/Tailscale address, requests from any
 * non-loopback client receive 403 before private files are touched.
 */
import { URL } from 'node:url'
import { readPrivateShowtimeCatalogue } from './showtime-local-catalogue.mjs'

const PREFIX = '/__theatgood_private/showtime/'
const LOCAL_CLIENTS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

export function isLocalResearchRequest(req) {
  if (!LOCAL_CLIENTS.has(req.socket?.remoteAddress)) return false
  const hostHeader = req.headers?.host
  if (typeof hostHeader !== 'string' || hostHeader.length > 100) return false
  let address
  try {
    address = new URL('http://' + hostHeader)
  } catch {
    return false
  }
  if (!LOCAL_HOSTS.has(address.hostname) || address.username || address.password) return false
  const origin = req.headers?.origin
  if (origin !== undefined && origin !== address.origin) return false
  const fetchSite = req.headers?.['sec-fetch-site']
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false
  return true
}

export function privateShowtimeDevPlugin(root) {
  let cached
  let loadedAt = 0
  return {
    name: 'theatgood-loopback-private-showtime-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(PREFIX)) return next()
        res.setHeader('Cache-Control', 'no-store, max-age=0')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Referrer-Policy', 'no-referrer')
        res.setHeader('Content-Security-Policy', "default-src 'none'")
        res.setHeader('X-Robots-Tag', 'noindex, nofollow')
        const finish = (code, object) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(object))
        }
        if (!isLocalResearchRequest(req)) {
          return finish(403, { error: 'local-only-research-preview' })
        }
        if (req.method !== 'GET') return finish(405, { error: 'read-only' })
        const segment = req.url.split('?', 1)[0].slice(PREFIX.length)
        if (segment !== 'index' && !/^hall\/showtime-[a-z0-9-]+\/[^/]+$/.test(segment)) {
          return finish(404, { error: 'unknown-hall' })
        }
        try {
          if (!cached || Date.now() - loadedAt > 3000) {
            cached = readPrivateShowtimeCatalogue(root)
            loadedAt = Date.now()
          }
          if (segment === 'index') return finish(200, cached.index)
          const [, slug, encodedHall] = /^hall\/(showtime-[a-z0-9-]+)\/([^/]+)$/.exec(segment)
          const hallLabel = decodeURIComponent(encodedHall)
          if (
            hallLabel.length > 48 ||
            hallLabel.includes('/') ||
            hallLabel.includes('\\') ||
            [...hallLabel].some((char) => char.charCodeAt(0) < 32)
          ) {
            return finish(404, { error: 'unknown-hall' })
          }
          const hall = cached.getHall(slug, hallLabel)
          return hall ? finish(200, hall) : finish(404, { error: 'unverified-hall' })
        } catch {
          cached = undefined
          return finish(503, { error: 'private-research-source-not-ready' })
        }
      })
    },
  }
}
