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
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "posts_status_created_at_idx"
  ON "posts" USING btree ("status", "created_at");
