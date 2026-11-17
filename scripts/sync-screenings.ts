import 'dotenv/config'
import { Pool } from 'pg'
import { CULTURE_FILM_SOURCE, normaliseCultureScreenings } from '../api/screenings'
import {
  persistScreeningSnapshot,
  requireDevelopmentSyncConfig,
  validateScreeningSnapshot,
} from '../db/screenings-sync'

/**
 * Default: read-only source preview, with NO database connection.
 * Writing requires BOTH --write and an explicit develop-only env switch.
 * There is deliberately no schedule or public HTTP write endpoint.
 */
const args = process.argv.slice(2)
if (
  args.some((argument) => argument !== '--write') ||
  args.filter((arg) => arg === '--write').length > 1
) {
  throw new Error('Usage: npm run db:screenings:sync -- [--write]')
}

const write = args.includes('--write')
const connectionString = write ? requireDevelopmentSyncConfig(process.env) : undefined
const response = await fetch(CULTURE_FILM_SOURCE, {
  headers: { Accept: 'application/json' },
  signal: AbortSignal.timeout(12_000),
})
if (!response.ok) throw new Error('Official film feed unavailable (HTTP ' + response.status + ')')

const observations = normaliseCultureScreenings(await response.json())
validateScreeningSnapshot(observations)
const observedAt = new Date()
console.info(
  'SCREENING_SYNC_PREVIEW',
  JSON.stringify({
    provider: 'moc-film-open-data',
    count: observations.length,
    earliest: observations[0]?.startsAt,
    latest: observations.at(-1)?.startsAt,
    write,
  }),
)

if (write && connectionString) {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 1000,
  })
  try {
    const client = await pool.connect()
    try {
      const stats = await persistScreeningSnapshot(client, observations, observedAt)
      console.info('SCREENING_SYNC_SAVED', JSON.stringify(stats))
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}
