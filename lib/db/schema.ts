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
  /** WorkOS user id of whoever claimed this brag — the same id space as resumarsh. */
  ownerUserId: text("owner_user_id"),
  /** Their resumarsh handle, once they have one. Stamped by /api/link-handle,
   *  because humblebrag has no way to look a handle up on its own. */
  ownerHandle: text("owner_handle"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
}, (table) => [
  index("posts_status_created_at_idx").on(table.status, table.createdAt),
  index("posts_owner_user_id_idx").on(table.ownerUserId, table.createdAt),
]);

/**
 * Every outbound move a creator makes, and every time the gate is shown or
 * converted. This is the funnel: without it the gate is a guess, and the kill
 * criteria in docs/marketing-funnel.md have nothing to read.
 */
export const shareEvents = pgTable("share_events", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  /** link | png | x | linkedin | embed | gate_view | gate_signin | claim */
  kind: text("kind").notNull(),
  userId: text("user_id"),
  /** Which side of the 50/50 this event came from — the comparison is the point. */
  bucket: text("bucket"),
  referrer: text("referrer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("share_events_post_created_at_idx").on(table.postId, table.createdAt),
  index("share_events_kind_created_at_idx").on(table.kind, table.createdAt),
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
export type StoredShareEvent = typeof shareEvents.$inferSelect;
export type StoredPerson = typeof postPeople.$inferSelect;
