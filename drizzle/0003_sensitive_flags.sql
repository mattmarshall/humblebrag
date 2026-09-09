ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "allow_sensitive" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "sensitive" boolean DEFAULT false NOT NULL;
