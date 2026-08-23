import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { Humblebrag } from "../../components/HumblebragCard";

export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("pending"),
  network: text("network").notNull(),
  premise: text("premise").notNull(),
  persona: text("persona").notNull(),
  intensity: text("intensity").notNull(),
  agentModel: text("agent_model").notNull().default("amazon.nova-pro-v1:0"),
  imageModel: text("image_model").notNull().default("stability.stable-image-ultra-v1:1"),
  payload: jsonb("payload").$type<Humblebrag>().notNull(),
  avatarUrl: text("avatar_url"),
  postImageUrl: text("post_image_url"),
  error: text("error"),
  runpodJobId: text("runpod_job_id"),
  allowSensitive: boolean("allow_sensitive").notNull().default(false),
  sensitive: boolean("sensitive").notNull().default(false),
  imageAttempts: integer("image_attempts").notNull().default(0),
  imageNextAttemptAt: timestamp("image_next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("posts_status_created_at_idx").on(table.status, table.createdAt),
]);

export const postPeople = pgTable("post_people", {
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  id: text("id").notNull(),
  role: text("role").notNull(),
  position: integer("position").notNull(),
  name: text("name").notNull(),
  handle: text("handle").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  appearance: text("appearance").notNull(),
  avatarPrompt: text("avatar_prompt").notNull(),
  avatarUrl: text("avatar_url"),
}, (table) => [
  primaryKey({ columns: [table.postId, table.id] }),
  index("post_people_post_position_idx").on(table.postId, table.position),
]);

export type StoredPost = typeof posts.$inferSelect;
export type StoredPerson = typeof postPeople.$inferSelect;
