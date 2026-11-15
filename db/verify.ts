import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { auditoriums, auditoriumModelVersions, cinemas } from './schema'
import { createSeats } from '../src/features/auditoriums/geometry'
import { loadAuditorium } from '../src/features/auditoriums/schema'

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
      version: auditoriumModelVersions.version,
      model: auditoriumModelVersions.model,
      confidence: auditoriumModelVersions.confidence,
    })
    .from(auditoriums)
    .innerJoin(cinemas, eq(cinemas.id, auditoriums.cinemaId))
    .innerJoin(auditoriumModelVersions, eq(auditoriumModelVersions.auditoriumId, auditoriums.id))
    .where(eq(auditoriumModelVersions.isCurrent, true))
    .limit(50)
  if (rows.length !== 1) throw new Error('Expected exactly 1 source-verified seeded auditorium')
  const row = rows[0]!
  const model = loadAuditorium(row.model)
  const generatedSeats = createSeats(model)
  if (generatedSeats.length !== row.seatCount || !generatedSeats.some((s) => s.id === 'E07')) {
    throw new Error('Stored model or seat count is inconsistent with the 2D/3D engine')
  }
  console.info(
    'VERIFY_OK',
    JSON.stringify({
      cinema: row.cinema,
      auditorium: row.auditorium,
      slug: row.auditoriumSlug,
      seats: generatedSeats.length,
      version: row.version,
      confidence: row.confidence,
    }),
  )
} finally {
  await pool.end()
}
