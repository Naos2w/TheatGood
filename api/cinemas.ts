import { Pool } from 'pg'

type PublishedAuditorium = {
  slug: string
  name: string
  cinemaName: string
  seatCount: number
  format: string | null
  version: number
  confidence: string
  sourceUrls: string[]
}

/**
 * Public read-only catalogue. Keep this Vercel function self-contained:
 * Vercel compiles api/*.ts to Node ESM without bundling ../db/schema.ts.
 * Drizzle remains the single owner of migrations and seeds, while this
 * endpoint queries the published columns directly with a bounded SELECT.
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
    const query = [
      'SELECT',
      '  a.slug, a.name, c.name AS "cinemaName",',
      '  a.seat_count AS "seatCount", a.format,',
      '  v.version, v.confidence, v.source_urls AS "sourceUrls"',
      'FROM auditoriums AS a',
      'INNER JOIN cinemas AS c ON c.id = a.cinema_id',
      'INNER JOIN auditorium_model_versions AS v ON v.auditorium_id = a.id',
      'WHERE a.published = TRUE AND v.is_current = TRUE',
      'ORDER BY c.name, a.name',
      'LIMIT 30',
    ].join('\n')
    const { rows } = await pool.query<PublishedAuditorium>(query)

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
