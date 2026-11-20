ALTER TABLE "watch_logs" ADD COLUMN "watched_on" date;--> statement-breakpoint
ALTER TABLE "watch_logs" ADD COLUMN "cinema_slug" varchar(120);--> statement-breakpoint
ALTER TABLE "watch_logs" ADD COLUMN "local_model_id" varchar(120);--> statement-breakpoint
ALTER TABLE "watch_logs" ADD COLUMN "local_model_version" integer;--> statement-breakpoint
ALTER TABLE "watch_logs" ADD COLUMN "updated_at" timestamp with time zone;