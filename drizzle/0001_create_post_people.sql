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
);

CREATE INDEX IF NOT EXISTS "post_people_post_position_idx"
  ON "post_people" USING btree ("post_id", "position");
