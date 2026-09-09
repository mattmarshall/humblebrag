ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "owner_user_id" text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "owner_handle" text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "posts_owner_user_id_idx"
  ON "posts" USING btree ("owner_user_id", "created_at");

CREATE TABLE IF NOT EXISTS "share_events" (
  "id" text PRIMARY KEY NOT NULL,
  "post_id" text NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "user_id" text,
  "bucket" text,
  "referrer" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "share_events_post_created_at_idx"
  ON "share_events" USING btree ("post_id", "created_at");

CREATE INDEX IF NOT EXISTS "share_events_kind_created_at_idx"
  ON "share_events" USING btree ("kind", "created_at");
