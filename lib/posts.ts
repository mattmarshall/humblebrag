import { desc, eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "./db";
import { ensureDatabase } from "./db/ensure";
import { posts, type StoredPost } from "./db/schema";

export const DEFAULT_POST_ID = "brock-panel";

export function hydratePost(record: StoredPost) {
  return {
    ...record.payload,
    avatarUrl: record.avatarUrl || record.payload.avatarUrl,
    postImageUrl: record.postImageUrl || record.payload.postImageUrl,
  };
}

export const findPost = cache(async (id: string) => {
  await ensureDatabase();
  const [record] = await getDb().select().from(posts).where(eq(posts.id, id)).limit(1);
  return record;
});

export async function findHomepagePost() {
  try {
    const preferred = await findPost(DEFAULT_POST_ID);
    if (preferred?.status === "complete") return preferred;

    const [latest] = await getDb()
      .select()
      .from(posts)
      .where(eq(posts.status, "complete"))
      .orderBy(desc(posts.completedAt))
      .limit(1);
    return latest;
  } catch (cause) {
    console.warn("[humblebrag:homepage-post]", cause);
    return undefined;
  }
}
