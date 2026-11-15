import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { auditoriums, auditoriumModelVersions, cinemas } from '../db/schema'

/**
 * Public, read-only catalogue endpoint. No authentication, write routes,
 * screenings, watch logs or database credentials are exposed to the browser.
 */
export async function GET() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    return Response.json({ error: 'catalog_not_configured' }, { status: 503 })
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 6000,
    idleTimeoutMillis: 1000,
  })
  try {
    const db = drizzle({ client: pool })
    const rows = await db
      .select({
        slug: auditoriums.slug,
        name: auditoriums.name,
        cinemaName: cinemas.name,
        seatCount: auditoriums.seatCount,
        format: auditoriums.format,
        version: auditoriumModelVersions.version,
        confidence: auditoriumModelVersions.confidence,
        sourceUrls: auditoriumModelVersions.sourceUrls,
      })
      .from(auditoriums)
      .innerJoin(cinemas, eq(cinemas.id, auditoriums.cinemaId))
      .innerJoin(
        auditoriumModelVersions,
        and(
          eq(auditoriumModelVersions.auditoriumId, auditoriums.id),
          eq(auditoriumModelVersions.isCurrent, true),
        ),
      )
      .where(eq(auditoriums.published, true))
      .limit(30)

    return Response.json(
      { auditoriums: rows },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } },
    )
  } catch (error) {
    console.error(
      'Public cinema catalogue query failed:',
      error instanceof Error ? error.name : 'unknown',
    )
    return Response.json({ error: 'catalog_unavailable' }, { status: 503 })
  } finally {
    await pool.end()
  }
}
