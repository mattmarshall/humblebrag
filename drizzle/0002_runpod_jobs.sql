ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "runpod_job_id" text;
--> statement-breakpoint
DROP TABLE IF EXISTS "image_generation_lock";
