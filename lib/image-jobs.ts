import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { ensureDatabase } from "./db/ensure";
import { posts } from "./db/schema";
import { findPost, hydratePost } from "./posts";
import { submitPostJob } from "./runpod";

export const MAX_IMAGE_ATTEMPTS = 5;

/**
 * Hand a post's five images to RunPod. Prompts are read back from the persisted
 * row rather than taken from the caller, so nothing user-controlled reaches the
 * worker unchecked.
 *
 * Callers should not await this on the request path — use waitUntil.
 */
export async function enqueuePostImages(postId: string) {
  await ensureDatabase();
  const record = await findPost(postId);
  if (!record) throw new Error("Post not found");
  if (record.status === "complete") return undefined;

  if (record.imageAttempts >= MAX_IMAGE_ATTEMPTS) {
    await getDb().update(posts)
      .set({ status: "error", error: "Image generation exhausted its retry budget" })
      .where(eq(posts.id, postId));
    return undefined;
  }

  try {
    const jobId = await submitPostJob(hydratePost(record), postId);
    await getDb().update(posts).set({
      status: "pending",
      error: null,
      runpodJobId: jobId,
      imageAttempts: record.imageAttempts + 1,
      // Only the reconcile sweep reads this; RunPod owns real retry timing.
      imageNextAttemptAt: new Date(Date.now() + 60 * 60 * 1_000),
    }).where(eq(posts.id, postId));
    console.info("[humblebrag:image-job] submitted", { postId, jobId, attempt: record.imageAttempts + 1 });
    return jobId;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Could not submit the image job";
    await getDb().update(posts).set({
      status: "pending",
      error: message,
      imageAttempts: record.imageAttempts + 1,
      imageNextAttemptAt: new Date(Date.now() + 5 * 60 * 1_000),
    }).where(eq(posts.id, postId));
    console.error("[humblebrag:image-job] submit failed", { postId, message });
    throw cause;
  }
}
