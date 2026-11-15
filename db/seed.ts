import 'dotenv/config'
import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { findAuditorium } from '../src/features/auditoriums/catalog'
import { cinemaDirectory } from '../src/features/auditoriums/directory'
import { createSeats } from '../src/features/auditoriums/geometry'
import { auditoriums, auditoriumModelVersions, cinemas } from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required for db:seed')
const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10000 })
const db = drizzle({ client: pool })

try {
  const outcome = await db.transaction(async (tx) => {
    let modelsNew = 0
    let modelsReused = 0

    for (const entry of cinemaDirectory) {
      if (!entry.sourceUrls.length || !entry.checkedAt) {
        throw new Error('Unverified catalogue entries cannot be published: ' + entry.slug)
      }

      const [cinema] = await tx
        .insert(cinemas)
        .values({
          slug: entry.cinemaSlug,
          name: entry.cinemaName,
          nameEn: entry.cinemaNameEn,
          aliases: entry.cinemaAliases,
          brand: entry.brand,
          city: entry.city,
        })
        .onConflictDoUpdate({
          target: cinemas.slug,
          set: {
            name: entry.cinemaName,
            nameEn: entry.cinemaNameEn,
            aliases: entry.cinemaAliases,
            brand: entry.brand,
            city: entry.city,
          },
        })
        .returning({ id: cinemas.id })

      if (!cinema) throw new Error('Cinema seed failed: ' + entry.cinemaSlug)

      const [hall] = await tx
        .insert(auditoriums)
        .values({
          cinemaId: cinema.id,
          slug: entry.slug,
          name: entry.hallName,
          nameEn: entry.hallNameEn,
          aliases: entry.aliases,
          format: entry.format,
          seatCount: entry.seatCount,
          wheelchairSeats: entry.wheelchairSeats,
          seatCountBasis: entry.seatCountBasis,
          screenWidthM: entry.screenWidthM,
          screenHeightM: entry.screenHeightM,
          sourceUrls: entry.sourceUrls,
          checkedAt: entry.checkedAt,
          published: true,
        })
        .onConflictDoUpdate({
          target: [auditoriums.cinemaId, auditoriums.slug],
          set: {
            name: entry.hallName,
            nameEn: entry.hallNameEn,
            aliases: entry.aliases,
            format: entry.format,
            seatCount: entry.seatCount,
            wheelchairSeats: entry.wheelchairSeats ?? null,
            seatCountBasis: entry.seatCountBasis,
            screenWidthM: entry.screenWidthM ?? null,
            screenHeightM: entry.screenHeightM ?? null,
            sourceUrls: entry.sourceUrls,
            checkedAt: entry.checkedAt,
            published: true,
          },
        })
        .returning({ id: auditoriums.id })

      if (!hall) throw new Error('Auditorium seed failed: ' + entry.slug)
      if (!entry.modelId) continue

      const model = findAuditorium(entry.modelId)
      if (!model || model.id !== entry.slug || model.publishedSeatCount !== entry.seatCount) {
        throw new Error('A 3D model must match its officially sourced seat list: ' + entry.slug)
      }
      if (createSeats(model).length !== entry.seatCount) {
        throw new Error('Generated 3D seat count mismatch: ' + entry.slug)
      }

      const sourceHash = createHash('sha256').update(JSON.stringify(model)).digest('hex')
      const existing = await tx
        .select({
          id: auditoriumModelVersions.id,
          sourceHash: auditoriumModelVersions.sourceHash,
        })
        .from(auditoriumModelVersions)
        .where(
          and(
            eq(auditoriumModelVersions.auditoriumId, hall.id),
            eq(auditoriumModelVersions.version, model.modelVersion),
          ),
        )
        .limit(1)

      if (existing[0] && existing[0].sourceHash !== sourceHash) {
        throw new Error(
          'Model v' +
            model.modelVersion +
            ' already exists with different geometry: ' +
            entry.slug +
            '. Publish a NEW model version rather than overwriting history.',
        )
      }
      if (existing[0]) {
        modelsReused++
      } else {
        await tx.insert(auditoriumModelVersions).values({
          auditoriumId: hall.id,
          version: model.modelVersion,
          sourceHash,
          model,
          confidence: model.confidence,
          sourceUrls: model.sources,
          checkedAt: model.provenance.checkedAt,
          isCurrent: true,
        })
        modelsNew++
      }
    }

    return {
      cinemas: new Set(cinemaDirectory.map((entry) => entry.cinemaSlug)).size,
      auditoriums: cinemaDirectory.length,
      modelled: cinemaDirectory.filter((entry) => entry.modelId).length,
      modelsNew,
      modelsReused,
    }
  })
  console.info('SEED_OK', JSON.stringify(outcome))
} finally {
  await pool.end()
}
