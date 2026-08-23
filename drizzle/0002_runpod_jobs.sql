ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "runpod_job_id" text;
--> statement-breakpoint
-- Destructive, and deliberately NOT in lib/db/ensure.ts: the retired Bedrock
-- queue still reads image_generation_lock, so dropping it at runtime would
-- break any instance of the old code still serving during a rollout or after a
-- rollback. Apply this by hand once the RunPod path is live and settled.
DROP TABLE IF EXISTS "image_generation_lock";
