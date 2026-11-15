CREATE TABLE "auditorium_model_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auditorium_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"model" jsonb NOT NULL,
	"confidence" varchar(16) NOT NULL,
	"source_urls" text[] NOT NULL,
	"checked_at" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoriums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cinema_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"format" varchar(200),
	"seat_count" integer NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cinemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"brand" varchar(120),
	"city" varchar(100),
	"address" text,
	"website_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cinemas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "movies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(250) NOT NULL,
	"original_title" varchar(250),
	"tmdb_id" integer,
	"release_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screening_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screening_id" uuid NOT NULL,
	"provider" varchar(100) NOT NULL,
	"source_key" varchar(240) NOT NULL,
	"source_url" text,
	"published_hall_label" varchar(120),
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "screenings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" uuid NOT NULL,
	"cinema_id" uuid NOT NULL,
	"auditorium_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"language" varchar(100),
	"format" varchar(100),
	"status" varchar(24) DEFAULT 'unverified' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"screening_id" uuid,
	"model_version_id" uuid,
	"watched_at" timestamp with time zone NOT NULL,
	"seat_label" varchar(20),
	"movie_title" varchar(250) NOT NULL,
	"cinema_name" varchar(200),
	"auditorium_name" varchar(160),
	"manual_entry" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auditorium_model_versions" ADD CONSTRAINT "auditorium_model_versions_auditorium_id_auditoriums_id_fk" FOREIGN KEY ("auditorium_id") REFERENCES "public"."auditoriums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoriums" ADD CONSTRAINT "auditoriums_cinema_id_cinemas_id_fk" FOREIGN KEY ("cinema_id") REFERENCES "public"."cinemas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_sources" ADD CONSTRAINT "screening_sources_screening_id_screenings_id_fk" FOREIGN KEY ("screening_id") REFERENCES "public"."screenings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_cinema_id_cinemas_id_fk" FOREIGN KEY ("cinema_id") REFERENCES "public"."cinemas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_auditorium_id_auditoriums_id_fk" FOREIGN KEY ("auditorium_id") REFERENCES "public"."auditoriums"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_logs" ADD CONSTRAINT "watch_logs_screening_id_screenings_id_fk" FOREIGN KEY ("screening_id") REFERENCES "public"."screenings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_logs" ADD CONSTRAINT "watch_logs_model_version_id_auditorium_model_versions_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."auditorium_model_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auditorium_models_version_unique" ON "auditorium_model_versions" USING btree ("auditorium_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "auditorium_models_one_current_unique" ON "auditorium_model_versions" USING btree ("auditorium_id") WHERE "is_current" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "auditoriums_cinema_slug_unique" ON "auditoriums" USING btree ("cinema_id","slug");--> statement-breakpoint
CREATE INDEX "auditoriums_cinema_idx" ON "auditoriums" USING btree ("cinema_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movies_tmdb_id_unique" ON "movies" USING btree ("tmdb_id");--> statement-breakpoint
CREATE UNIQUE INDEX "screening_sources_provider_key_unique" ON "screening_sources" USING btree ("provider","source_key");--> statement-breakpoint
CREATE INDEX "screening_sources_screening_idx" ON "screening_sources" USING btree ("screening_id");--> statement-breakpoint
CREATE INDEX "screenings_cinema_start_idx" ON "screenings" USING btree ("cinema_id","starts_at");--> statement-breakpoint
CREATE INDEX "screenings_movie_start_idx" ON "screenings" USING btree ("movie_id","starts_at");--> statement-breakpoint
CREATE INDEX "screenings_auditorium_start_idx" ON "screenings" USING btree ("auditorium_id","starts_at");--> statement-breakpoint
CREATE INDEX "watch_logs_user_watched_idx" ON "watch_logs" USING btree ("user_id","watched_at");