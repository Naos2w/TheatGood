/**
 * Tailnet-only authenticated preview for TheatGood research.
 * Serve PRIVATE seat grids only behind the Tailscale Serve identity header.
 * Binds only 127.0.0.1; does not read credentials or open a web browser.
 *
 * Run with:
 *  THEATGOOD_TAILNET_HOST=<exact *.ts.net>
 *  THEATGOOD_TAILNET_LOGIN=<tailscale-owner-login>
 *  THEATGOOD_TAILNET_PORT=10000
 *  node scripts/theatgood-tailnet-preview.mjs
 *
 * Then: tailscale serve --https=10000 --bg http://127.0.0.1:4187
 * Never use Tailscale Funnel for private research.
 */
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import console from 'node:console'
import process from 'node:process'
import { timingSafeEqual } from 'node:crypto'
import { URL, fileURLToPath } from 'node:url'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { readPrivateShowtimeCatalogue } from './showtime-local-catalogue.mjs'

const DEFAULT_PORT = 4187
const dist = path.resolve('dist')
const host = process.env.THEATGOOD_TAILNET_HOST?.trim().toLowerCase()
const allowedLogin = process.env.THEATGOOD_TAILNET_LOGIN?.trim().toLowerCase()
const tailscalePort = Number(process.env.THEATGOOD_TAILNET_PORT ?? '10000')
const listenPort = Number(process.env.THEATGOOD_LOCAL_PREVIEW_PORT ?? DEFAULT_PORT)
assert(
  host && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+\.ts\.net$/.test(host),
  'Valid exact tailnet DNS hostname required',
)
assert(
  allowedLogin && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allowedLogin),
  'Exact Tailscale login required',
)
assert(Number.isInteger(tailscalePort) && tailscalePort >= 1024 && tailscalePort <= 65535)
assert(Number.isInteger(listenPort) && listenPort >= 1024 && listenPort <= 65535)
assert(fs.existsSync(path.join(dist, 'index.html')), 'Build the public-data-free app first')

const remoteOrigin = 'https://' + host + ':' + tailscalePort
const expectedTailnetHost = host + ':' + tailscalePort
const localOrigins = new Set(['http://127.0.0.1:' + listenPort, 'http://localhost:' + listenPort])
const localHosts = new Set(['127.0.0.1:' + listenPort, 'localhost:' + listenPort])
const safeRemote = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export function determinePreviewAccess(request, options = {}) {
  const testLogin = options.expectedLogin ?? allowedLogin
  const configuredRemoteHost = options.remoteHost ?? expectedTailnetHost
  const configuredRemoteOrigin = options.remoteOrigin ?? remoteOrigin
  const localPort = options.localPort ?? listenPort
  const peer = request.socket?.remoteAddress
  if (!safeRemote.has(peer)) return null
  const headers = request.headers ?? {}
  const providedHost = String(headers.host ?? '').toLowerCase()
  const actualOrigin = headers.origin
  const site = headers['sec-fetch-site']
  if (site && !['same-origin', 'none'].includes(site)) return null
  if (typeof actualOrigin === 'string' && actualOrigin.length > 200) return null
  const reqIdentity = headers['tailscale-user-login']
  const identityMatches =
    typeof reqIdentity === 'string' &&
    Buffer.from(reqIdentity.toLowerCase()).length === Buffer.from(testLogin).length &&
    timingSafeEqual(Buffer.from(reqIdentity.toLowerCase()), Buffer.from(testLogin))
  if (identityMatches && [configuredRemoteHost, '127.0.0.1:' + localPort].includes(providedHost)) {
    if (actualOrigin !== undefined && actualOrigin !== configuredRemoteOrigin) return null
    return 'tailnet-owner'
  }
  if (reqIdentity !== undefined) return null
  if (headers['x-forwarded-for'] || headers['x-forwarded-proto'] || headers['forwarded']) {
    return null
  }
  const localOrigin = 'http://' + providedHost
  if (
    !localHosts.has(providedHost) ||
    (actualOrigin !== undefined && actualOrigin !== localOrigin) ||
    !localOrigins.has(localOrigin)
  ) {
    return null
  }
  return 'local-msi'
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json; charset=utf-8',
}
let cached
let cachedAt = 0

export async function handlePrivatePreview(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Robots-Tag', 'noindex, nofollow')

  const reply = (status, object) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify(object))
  }
  if (!determinePreviewAccess(request))
    return reply(403, { error: 'not-an-authorised-tailnet-owner' })
  if (!['GET', 'HEAD'].includes(request.method)) return reply(405, { error: 'read-only' })

  let url
  try {
    url = new URL(request.url, 'http://localhost')
  } catch {
    return reply(400, { error: 'invalid-url' })
  }
  if (url.pathname === '/__theatgood_preview_health') {
    return reply(200, { online: true, tailnetOnly: true, researchApprovedForPublicRelease: false })
  }
  const apiPrefix = '/__theatgood_private/showtime/'
  if (url.pathname.startsWith(apiPrefix)) {
    if (request.method !== 'GET') return reply(405, { error: 'read-only' })
    const part = url.pathname.slice(apiPrefix.length)
    if (part !== 'index' && !/^hall\/showtime-[a-z0-9-]+\/[^/]+$/.test(part)) {
      return reply(404, { error: 'unknown-hall' })
    }
    try {
      if (!cached || Date.now() - cachedAt > 3000) {
        cached = readPrivateShowtimeCatalogue(process.cwd())
        cachedAt = Date.now()
      }
      if (part === 'index') return reply(200, cached.index)
      const [, slug, encoded] = /^hall\/(showtime-[a-z0-9-]+)\/([^/]+)$/.exec(part)
      const hallLabel = decodeURIComponent(encoded)
      if (hallLabel.length > 48 || hallLabel.includes('/') || hallLabel.includes('\\')) {
        return reply(404, { error: 'unknown-hall' })
      }
      const hall = cached.getHall(slug, hallLabel)
      return hall ? reply(200, hall) : reply(404, { error: 'unverified-hall' })
    } catch {
      cached = undefined
      return reply(503, { error: 'private-research-audit-not-ready' })
    }
  }
  if (url.pathname.startsWith('/__theatgood_private/')) {
    return reply(404, { error: 'unknown-private-resource' })
  }
  let filePath
  try {
    const decoded = decodeURIComponent(url.pathname)
    if (decoded.includes('\0') || decoded.includes('\\')) {
      return reply(404, { error: 'invalid-path' })
    }
    filePath = path.resolve(dist, '.' + decoded)
    if (filePath !== dist && !filePath.startsWith(dist + path.sep)) {
      return reply(403, { error: 'invalid-path' })
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html')
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      if (!String(request.headers.accept ?? '').includes('text/html') || path.extname(decoded)) {
        return reply(404, { error: 'asset-not-found' })
      }
      filePath = path.join(dist, 'index.html')
    }
    const ext = path.extname(filePath).toLowerCase()
    if (!Object.hasOwn(MIME, ext)) return reply(404, { error: 'unsupported-asset' })
    const size = fs.statSync(filePath).size
    response.setHeader('Content-Type', MIME[ext])
    response.setHeader('Accept-Ranges', 'bytes')
    let start = 0
    let end = size - 1
    const range = request.headers.range
    if (typeof range === 'string') {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range)
      if (!match) return reply(416, { error: 'unsupported-range' })
      start = Number(match[1])
      end = match[2] === '' ? end : Number(match[2])
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start >= size ||
        end < start ||
        end >= size
      ) {
        return reply(416, { error: 'range-out-of-bounds' })
      }
      response.statusCode = 206
      response.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + size)
    } else {
      response.statusCode = 200
    }
    response.setHeader('Content-Length', end - start + 1)
    if (request.method === 'HEAD') return response.end()
    const stream = fs.createReadStream(filePath, { start, end })
    stream.on('error', () => {
      if (!response.headersSent) reply(500, { error: 'read-failed' })
      else response.destroy()
    })
    stream.pipe(response)
  } catch {
    return reply(500, { error: 'preview-unavailable' })
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  const server = http.createServer(handlePrivatePreview)
  server.listen(listenPort, '127.0.0.1', () => {
    console.log(
      JSON.stringify({
        bind: '127.0.0.1:' + listenPort,
        publicInternet: false,
        requiresTailscaleIdentity: true,
        access: 'tailnet-owner-and-local-msi',
        staticRoot: 'dist',
      }),
    )
  })
}
