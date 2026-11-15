import 'dotenv/config'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { cinemas, movies, screenings, screeningSources } from './schema'

// Intentional, explicitly gated non-real data. This fixture has no hall mapping:
// a source without a hall number must NOT be assigned to the TFAI 3D model.
if (process.env.THEATGOOD_ALLOW_FIXTURES !== 'yes') {
  throw new Error('Refusing synthetic screenings without THEATGOOD_ALLOW_FIXTURES=yes')
}
if (!process.env.DATABASE_URL || !process.env.NEON_DEV_BRANCH_ID) {
  throw new Error('Development branch connection and NEON_DEV_BRANCH_ID are required')
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
const db = drizzle({ client: pool })
const provider = 'theatgood-fixture'
const sourceKey = 'synthetic-tfai-unconfirmed-hall-2030-01-01T20'
const fixtureTitle = '[TEST ONLY] Synthetic screening — NOT A REAL SHOWTIME'

try {
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: screeningSources.id })
      .from(screeningSources)
      .where(
        and(eq(screeningSources.provider, provider), eq(screeningSources.sourceKey, sourceKey)),
      )
      .limit(1)
    if (existing) return { alreadyExists: true }

    const [cinema] = await tx
      .select({ id: cinemas.id })
      .from(cinemas)
      .where(eq(cinemas.slug, 'tfai'))
      .limit(1)
    if (!cinema) throw new Error('Seed the source-verified cinema before adding test fixtures')

    const [existingMovie] = await tx
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.title, fixtureTitle))
      .limit(1)

    const [movie] = existingMovie
      ? [existingMovie]
      : await tx
          .insert(movies)
          .values({
            title: fixtureTitle,
          })
          .returning({ id: movies.id })
    if (!movie) throw new Error('Fixture movie could not be created')

    const [screening] = await tx
      .insert(screenings)
      .values({
        movieId: movie.id,
        cinemaId: cinema.id,
        // Intentionally null: the fixture pretends the venue did not announce a hall number.
        auditoriumId: null,
        startsAt: new Date('2030-01-01T12:00:00Z'),
        language: 'zh-TW',
        format: '2D',
        status: 'fixture',
      })
      .returning({ id: screenings.id })
    if (!screening) throw new Error('Fixture screening could not be created')

    await tx.insert(screeningSources).values({
      screeningId: screening.id,
      provider,
      sourceKey,
      publishedHallLabel: null,
      sourceUrl: null,
      raw: { synthetic: true, warning: 'NOT_REAL — local development fixture only' },
    })
    return { alreadyExists: false }
  })
  console.info('FIXTURE_OK', JSON.stringify(result))
} finally {
  await pool.end()
}
