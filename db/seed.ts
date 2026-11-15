import 'dotenv/config'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { loadAuditorium } from '../src/features/auditoriums/schema'
import { auditoriums, auditoriumModelVersions, cinemas } from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required for db:seed')

const modelFile = new URL('../src/features/auditoriums/tfai-small.json', import.meta.url)
const definition = loadAuditorium(JSON.parse(await readFile(modelFile, 'utf8')))
const sourceHash = createHash('sha256').update(JSON.stringify(definition)).digest('hex')
const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10000 })
const db = drizzle({ client: pool })

try {
  const summary = await db.transaction(async (tx) => {
    const [cinema] = await tx
      .insert(cinemas)
      .values({
        slug: 'tfai',
        name: definition.cinemaName,
        websiteUrl: 'https://www.tfai.org.tw/',
      })
      .onConflictDoUpdate({
        target: cinemas.slug,
        set: { name: definition.cinemaName },
      })
      .returning({ id: cinemas.id })

    if (!cinema) throw new Error('Cinema seed failed')

    const [auditorium] = await tx
      .insert(auditoriums)
      .values({
        cinemaId: cinema.id,
        slug: definition.id,
        name: definition.name,
        format: definition.format,
        seatCount: definition.publishedSeatCount,
        published: true,
      })
      .onConflictDoUpdate({
        target: [auditoriums.cinemaId, auditoriums.slug],
        set: {
          name: definition.name,
          format: definition.format,
          seatCount: definition.publishedSeatCount,
        },
      })
      .returning({ id: auditoriums.id })

    if (!auditorium) throw new Error('Auditorium seed failed')

    const existing = await tx
      .select({
        id: auditoriumModelVersions.id,
        sourceHash: auditoriumModelVersions.sourceHash,
      })
      .from(auditoriumModelVersions)
      .where(
        and(
          eq(auditoriumModelVersions.auditoriumId, auditorium.id),
          eq(auditoriumModelVersions.version, definition.modelVersion),
        ),
      )
      .limit(1)

    if (existing[0] && existing[0].sourceHash !== sourceHash) {
      throw new Error(
        'A different geometry already exists as model v1. Publish a NEW model version; never overwrite viewing history.',
      )
    }
    if (!existing.length) {
      await tx.insert(auditoriumModelVersions).values({
        auditoriumId: auditorium.id,
        version: definition.modelVersion,
        sourceHash,
        model: definition,
        confidence: definition.confidence,
        sourceUrls: definition.sources,
        checkedAt: definition.provenance.checkedAt,
        isCurrent: true,
      })
    }
    return {
      cinema: definition.cinemaName,
      auditorium: definition.name,
      seats: definition.publishedSeatCount,
      modelVersion: definition.modelVersion,
      modelReused: Boolean(existing.length),
    }
  })
  console.info('SEED_OK', JSON.stringify(summary))
} finally {
  await pool.end()
}
