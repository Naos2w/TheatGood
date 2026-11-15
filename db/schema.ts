import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import type { AuditoriumDefinition } from '../src/features/auditoriums/schema'

// Each model version owns the complete geometry JSON. Seat coordinates are
// derived from it, not duplicated in a second table that could become stale.
export const cinemas = pgTable('cinemas', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  nameEn: varchar('name_en', { length: 200 }),
  aliases: text('aliases').array().notNull().default(sql.raw("'{}'::text[]")),
  brand: varchar('brand', { length: 120 }),
  city: varchar('city', { length: 100 }),
  address: text('address'),
  websiteUrl: text('website_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditoriums = pgTable(
  'auditoriums',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cinemaId: uuid('cinema_id')
      .notNull()
      .references(() => cinemas.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    nameEn: varchar('name_en', { length: 160 }),
    aliases: text('aliases').array().notNull().default(sql.raw("'{}'::text[]")),
    format: varchar('format', { length: 200 }),
    seatCount: integer('seat_count').notNull(),
    wheelchairSeats: integer('wheelchair_seats'),
    seatCountBasis: varchar('seat_count_basis', { length: 32 }).notNull().default('unspecified'),
    screenWidthM: doublePrecision('screen_width_m'),
    screenHeightM: doublePrecision('screen_height_m'),
    sourceUrls: text('source_urls').array().notNull().default(sql.raw("'{}'::text[]")),
    checkedAt: date('checked_at'),
    published: boolean('published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('auditoriums_cinema_slug_unique').on(table.cinemaId, table.slug),
    index('auditoriums_cinema_idx').on(table.cinemaId),
  ],
)

export const auditoriumModelVersions = pgTable(
  'auditorium_model_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    auditoriumId: uuid('auditorium_id')
      .notNull()
      .references(() => auditoriums.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    sourceHash: varchar('source_hash', { length: 64 }).notNull(),
    model: jsonb('model').$type<AuditoriumDefinition>().notNull(),
    confidence: varchar('confidence', { length: 16 }).notNull(),
    sourceUrls: text('source_urls').array().notNull(),
    checkedAt: date('checked_at').notNull(),
    isCurrent: boolean('is_current').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('auditorium_models_version_unique').on(table.auditoriumId, table.version),
    uniqueIndex('auditorium_models_one_current_unique')
      .on(table.auditoriumId)
      .where(sql.raw('"is_current" = true')),
  ],
)

export const movies = pgTable(
  'movies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 250 }).notNull(),
    originalTitle: varchar('original_title', { length: 250 }),
    tmdbId: integer('tmdb_id'),
    releaseDate: date('release_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('movies_tmdb_id_unique').on(table.tmdbId)],
)

export const screenings = pgTable(
  'screenings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'restrict' }),
    cinemaId: uuid('cinema_id')
      .notNull()
      .references(() => cinemas.id, { onDelete: 'restrict' }),
    // A screening without a verified auditorium remains unlinked.
    auditoriumId: uuid('auditorium_id').references(() => auditoriums.id, {
      onDelete: 'set null',
    }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    language: varchar('language', { length: 100 }),
    format: varchar('format', { length: 100 }),
    // Values used by adapters: unverified / scheduled / cancelled / fixture.
    status: varchar('status', { length: 24 }).notNull().default('unverified'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('screenings_cinema_start_idx').on(table.cinemaId, table.startsAt),
    index('screenings_movie_start_idx').on(table.movieId, table.startsAt),
    index('screenings_auditorium_start_idx').on(table.auditoriumId, table.startsAt),
  ],
)

export const screeningSources = pgTable(
  'screening_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    screeningId: uuid('screening_id')
      .notNull()
      .references(() => screenings.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 100 }).notNull(),
    sourceKey: varchar('source_key', { length: 240 }).notNull(),
    sourceUrl: text('source_url'),
    publishedHallLabel: varchar('published_hall_label', { length: 120 }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex('screening_sources_provider_key_unique').on(table.provider, table.sourceKey),
    index('screening_sources_screening_idx').on(table.screeningId),
  ],
)

// The future authenticated server layer must derive userId from a validated
// session. There is deliberately no public write endpoint for this table.
export const watchLogs = pgTable(
  'watch_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    screeningId: uuid('screening_id').references(() => screenings.id, {
      onDelete: 'set null',
    }),
    modelVersionId: uuid('model_version_id').references(() => auditoriumModelVersions.id, {
      onDelete: 'set null',
    }),
    watchedAt: timestamp('watched_at', { withTimezone: true }).notNull(),
    seatLabel: varchar('seat_label', { length: 20 }),
    movieTitle: varchar('movie_title', { length: 250 }).notNull(),
    cinemaName: varchar('cinema_name', { length: 200 }),
    auditoriumName: varchar('auditorium_name', { length: 160 }),
    manualEntry: boolean('manual_entry').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('watch_logs_user_watched_idx').on(table.userId, table.watchedAt)],
)
