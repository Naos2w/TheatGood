import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import http from 'node:http'
import test from 'node:test'

process.env.THEATGOOD_TAILNET_HOST = 'msi-win.tailcca2df.ts.net'
process.env.THEATGOOD_TAILNET_LOGIN = 'preview-owner@example.test'
process.env.THEATGOOD_TAILNET_PORT = '10000'

const { determinePreviewAccess, handlePrivatePreview } =
  await import('./theatgood-tailnet-preview.mjs')
const HOST = 'msi-win.tailcca2df.ts.net:10000'
const ORIGIN = 'https://' + HOST

test('Tailscale-identity-gated preview denies other tailnet users and spoofing', () => {
  const req = (headers, remoteAddress = '127.0.0.1') => ({
    socket: { remoteAddress },
    headers,
  })
  assert.equal(
    determinePreviewAccess(
      req({ host: HOST, 'tailscale-user-login': 'preview-owner@example.test' }),
    ),
    'tailnet-owner',
  )
  assert.equal(
    determinePreviewAccess(req({ host: HOST, 'tailscale-user-login': 'other@example.test' })),
    null,
  )
  assert.equal(determinePreviewAccess(req({ host: HOST })), null)
  assert.equal(
    determinePreviewAccess(
      req({
        host: HOST,
        'tailscale-user-login': 'preview-owner@example.test',
        origin: 'https://untrusted.example',
      }),
    ),
    null,
  )
  assert.equal(
    determinePreviewAccess(
      req({ host: HOST, 'tailscale-user-login': 'preview-owner@example.test' }, '192.168.1.22'),
    ),
    null,
  )
  assert.equal(
    determinePreviewAccess(
      req({
        host: HOST,
        'tailscale-user-login': 'preview-owner@example.test',
        'sec-fetch-site': 'cross-site',
      }),
    ),
    null,
  )
  assert.equal(
    determinePreviewAccess(req({ host: '127.0.0.1:4187', 'x-forwarded-proto': 'https' })),
    null,
  )
  assert.equal(
    determinePreviewAccess(req({ host: '127.0.0.1:4187', origin: 'http://127.0.0.1:4187' })),
    'local-msi',
  )
})

test('server serves built UI and private grids only behind valid identity', async () => {
  const server = http.createServer(handlePrivatePreview)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const request = async (url, headers = {}, method = 'GET') =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: url,
          method,
          headers: { Host: HOST, ...headers },
        },
        (res) => {
          const chunks = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', () =>
            resolve({
              status: res.statusCode,
              body: Buffer.concat(chunks).toString('utf8'),
              contentType: res.headers['content-type'],
            }),
          )
        },
      )
      req.on('error', reject)
      req.end()
    })
  try {
    const wrong = await request('/__theatgood_private/showtime/index', {
      'Tailscale-User-Login': 'another@example.test',
    })
    assert.equal(wrong.status, 403)
    assert(!wrong.body.includes('seatPositions'))
    const source = await request('/__theatgood_private/showtime/index', {
      'Tailscale-User-Login': 'preview-owner@example.test',
      Origin: ORIGIN,
    })
    assert.equal(source.status, 200)
    const index = JSON.parse(source.body)
    assert.equal(index.verifiedHallLabels, 158)
    assert.equal(index.approvedForPublicUI, false)
    const html = await request('/cinemas/miranew-taimall', {
      'Tailscale-User-Login': 'preview-owner@example.test',
      Origin: ORIGIN,
      Accept: 'text/html',
    })
    assert.equal(html.status, 200)
    assert.match(html.body, /<html/)
    const absent = await request(
      '/__theatgood_private/showtime/hall/showtime-tainan-rende/3%E5%BB%B3',
      { 'Tailscale-User-Login': 'preview-owner@example.test' },
    )
    assert.equal(absent.status, 404)
    const denied = await request('/__theatgood_private/showtime/index')
    assert.equal(denied.status, 403)
    const post = await request(
      '/__theatgood_private/showtime/index',
      { 'Tailscale-User-Login': 'preview-owner@example.test' },
      'POST',
    )
    assert.equal(post.status, 405)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
