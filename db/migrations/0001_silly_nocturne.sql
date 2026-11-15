ALTER TABLE "auditoriums" ADD COLUMN "name_en" varchar(160);--> statement-breakpoint
ALTER TABLE "auditoriums" ADD COLUMN "aliases" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "auditoriums" ADD COLUMN "wheelchair_seats" integer;--> statement-breakpoint
ALTER TABLE "auditoriums" ADD COLUMN "seat_count_basis" varchar(32) DEFAULT 'unspecified' NOT NULL;--> statement-breakpoint
ALTER TABLE "auditoriums" ADD COLUMN "screen_width_m" double precision;--> statement-breakpoint
ALTER TABLE "auditoriums" ADD COLUMN "screen_height_m" double precision;--> statement-breakpoint
ALTER TABLE "auditoriums" ADD COLUMN "source_urls" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "auditoriums" ADD COLUMN "checked_at" date;--> statement-breakpoint
ALTER TABLE "cinemas" ADD COLUMN "name_en" varchar(200);--> statement-breakpoint
ALTER TABLE "cinemas" ADD COLUMN "aliases" text[] DEFAULT '{}'::text[] NOT NULL;