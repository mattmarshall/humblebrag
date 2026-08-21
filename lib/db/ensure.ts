import { sql } from "drizzle-orm";
import { getDb } from ".";

let ready: Promise<void> | undefined;

export function ensureDatabase() {
  ready ??= (async () => {
    await getDb().execute(sql`
      CREATE TABLE IF NOT EXISTS "posts" (
        "id" text PRIMARY KEY NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "network" text NOT NULL,
        "premise" text NOT NULL,
        "persona" text NOT NULL,
        "intensity" text NOT NULL,
        "agent_model" text DEFAULT 'amazon.nova-pro-v1:0' NOT NULL,
        "image_model" text DEFAULT 'stability.stable-image-ultra-v1:1' NOT NULL,
        "payload" jsonb NOT NULL,
        "avatar_url" text,
        "post_image_url" text,
        "error" text,
        "image_attempts" integer DEFAULT 0 NOT NULL,
        "image_next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "completed_at" timestamp with time zone
      )
    `);
    await getDb().execute(sql`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "image_attempts" integer DEFAULT 0 NOT NULL`);
    await getDb().execute(sql`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "image_next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL`);
    await getDb().execute(sql`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "runpod_job_id" text`);
    await getDb().execute(sql`
      CREATE INDEX IF NOT EXISTS "posts_status_created_at_idx"
      ON "posts" USING btree ("status", "created_at")
    `);
    await getDb().execute(sql`
      CREATE TABLE IF NOT EXISTS "post_people" (
        "post_id" text NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
        "id" text NOT NULL,
        "role" text NOT NULL,
        "position" integer NOT NULL,
        "name" text NOT NULL,
        "handle" text NOT NULL,
        "title" text NOT NULL,
        "company" text NOT NULL,
        "appearance" text NOT NULL,
        "avatar_prompt" text NOT NULL,
        "avatar_url" text,
        CONSTRAINT "post_people_post_id_id_pk" PRIMARY KEY("post_id", "id")
      )
    `);
    await getDb().execute(sql`
      CREATE INDEX IF NOT EXISTS "post_people_post_position_idx"
      ON "post_people" USING btree ("post_id", "position")
    `);
    // The Bedrock path serialized image jobs behind a global Postgres lease.
    // RunPod Serverless is the queue now, so the lease is dead weight.
    await getDb().execute(sql`DROP TABLE IF EXISTS "image_generation_lock"`);
  })();
  return ready;
}
