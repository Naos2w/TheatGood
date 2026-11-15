import { Pool } from 'pg'

/**
 * A source-verified venue isn't automatically a 3D model.
 * Only rows with a matching current model version may offer seat previews.
 */
type PublishedHall = {
  slug: string
  name: string
  nameEn: string | null
  cinemaSlug: string
  cinemaName: string
  cinemaNameEn: string | null
  city: string | null
  brand: string | null
  seatCount: number
  wheelchairSeats: number | null
  seatCountBasis: string
  format: string | null
  screenWidthM: number | null
  screenHeightM: number | null
  checkedAt: string | null
  sourceUrls: string[]
  version: number | null
  confidence: string | null
  hasModel: boolean
}

/** Self-contained, read-only Vercel Node function; no imported local TS modules. */
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
      '  a.slug, a.name, a.name_en AS "nameEn",',
      '  c.slug AS "cinemaSlug", c.name AS "cinemaName",',
      '  c.name_en AS "cinemaNameEn", c.city, c.brand,',
      '  a.seat_count AS "seatCount", a.wheelchair_seats AS "wheelchairSeats",',
      '  a.seat_count_basis AS "seatCountBasis", a.format,',
      '  a.screen_width_m AS "screenWidthM", a.screen_height_m AS "screenHeightM",',
      '  a.checked_at AS "checkedAt", a.source_urls AS "sourceUrls",',
      '  v.version, v.confidence, (v.id IS NOT NULL) AS "hasModel"',
      'FROM auditoriums AS a',
      'INNER JOIN cinemas AS c ON c.id = a.cinema_id',
      'LEFT JOIN auditorium_model_versions AS v',
      '  ON v.auditorium_id = a.id AND v.is_current = TRUE',
      'WHERE a.published = TRUE',
      'ORDER BY (v.id IS NULL), c.name, a.name',
      'LIMIT 50',
    ].join('\n')
    const { rows } = await pool.query<PublishedHall>(query)

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
