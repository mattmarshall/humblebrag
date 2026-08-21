import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("posts_status_created_at_idx").on(table.status, table.createdAt),
]);

export type StoredPost = typeof posts.$inferSelect;
