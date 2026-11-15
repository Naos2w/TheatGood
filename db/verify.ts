import 'dotenv/config'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { cinemaDirectory } from '../src/features/auditoriums/directory'
import { createSeats } from '../src/features/auditoriums/geometry'
import { loadAuditorium } from '../src/features/auditoriums/schema'
import { auditoriums, auditoriumModelVersions, cinemas } from './schema'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
const db = drizzle({ client: pool })

try {
  const rows = await db
    .select({
      cinema: cinemas.name,
      auditorium: auditoriums.name,
      auditoriumSlug: auditoriums.slug,
      seatCount: auditoriums.seatCount,
      countBasis: auditoriums.seatCountBasis,
      sourceUrls: auditoriums.sourceUrls,
      checkedAt: auditoriums.checkedAt,
      version: auditoriumModelVersions.version,
      model: auditoriumModelVersions.model,
      confidence: auditoriumModelVersions.confidence,
    })
    .from(auditoriums)
    .innerJoin(cinemas, eq(cinemas.id, auditoriums.cinemaId))
    .leftJoin(
      auditoriumModelVersions,
      and(
        eq(auditoriumModelVersions.auditoriumId, auditoriums.id),
        eq(auditoriumModelVersions.isCurrent, true),
      ),
    )
    .where(eq(auditoriums.published, true))
    .limit(50)

  if (rows.length !== cinemaDirectory.length) {
    throw new Error(
      'Expected ' + cinemaDirectory.length + ' verified auditoriums, got ' + rows.length,
    )
  }
  let modelled = 0
  for (const record of rows) {
    const source = cinemaDirectory.find((item) => item.slug === record.auditoriumSlug)
    if (
      !source ||
      record.seatCount !== source.seatCount ||
      record.countBasis !== source.seatCountBasis ||
      record.checkedAt !== source.checkedAt ||
      !record.sourceUrls.length
    ) {
      throw new Error(
        'Sourced auditorium data differs from reviewed source: ' + record.auditoriumSlug,
      )
    }

    if (!source.modelId) {
      if (record.model !== null) throw new Error('Directory-only hall unexpectedly has a 3D model')
      continue
    }

    if (!record.model || !record.version)
      throw new Error('Expected a real 3D model for ' + source.slug)
    const model = loadAuditorium(record.model)
    const seats = createSeats(model)
    if (
      model.id !== source.modelId ||
      seats.length !== source.seatCount ||
      !seats.every((seat) => seat.z > model.screen.z)
    ) {
      throw new Error('Stored geometry invalid: ' + source.slug)
    }
    modelled++
  }

  console.info(
    'VERIFY_OK',
    JSON.stringify({
      cinemas: new Set(cinemaDirectory.map((entry) => entry.cinemaSlug)).size,
      auditoriums: rows.length,
      with3D: modelled,
      directoryOnly: rows.length - modelled,
      seatModelIds: rows
        .filter((row) => row.model !== null)
        .map((row) => row.auditoriumSlug)
        .sort(),
    }),
  )
} finally {
  await pool.end()
}
