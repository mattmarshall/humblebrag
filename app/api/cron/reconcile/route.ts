import { and, asc, eq, lte } from "drizzle-orm";
import { getDb } from "../../../../lib/db";
import { ensureDatabase } from "../../../../lib/db/ensure";
import { posts } from "../../../../lib/db/schema";
import { enqueuePostImages, MAX_IMAGE_ATTEMPTS } from "../../../../lib/image-jobs";
import { getJobStatus } from "../../../../lib/runpod";

export const runtime = "nodejs";

// Safety net, not the drain. RunPod queues durably for 24h, retries internally
// and webhooks on completion, so this only has to catch the rare case where a
// webhook was lost or a job was submitted with presigned URLs that expired
// before a worker picked it up (they are STS-signed and live ~1h).
export async function GET() {
  await ensureDatabase();
  const stale = await getDb().select().from(posts)
    .where(and(eq(posts.status, "pending"), lte(posts.imageNextAttemptAt, new Date())))
    .orderBy(asc(posts.createdAt))
    .limit(25);

  const results: Array<{ postId: string; action: string }> = [];
  for (const post of stale) {
    try {
      // If the job is still alive on RunPod, leave it alone.
      if (post.runpodJobId) {
        const job = await getJobStatus(post.runpodJobId);
        if (job.status === "IN_QUEUE" || job.status === "IN_PROGRESS") {
          results.push({ postId: post.id, action: `waiting:${job.status}` });
          continue;
        }
      }
      if (post.imageAttempts >= MAX_IMAGE_ATTEMPTS) {
        await getDb().update(posts)
          .set({ status: "error", error: "Image generation exhausted its retry budget" })
          .where(eq(posts.id, post.id));
        results.push({ postId: post.id, action: "exhausted" });
        continue;
      }
      await enqueuePostImages(post.id);
      results.push({ postId: post.id, action: "resubmitted" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "reconcile failed";
      console.error("[humblebrag:reconcile]", { postId: post.id, message });
      results.push({ postId: post.id, action: `failed:${message}` });
    }
  }

  return Response.json({ ok: true, examined: stale.length, results });
}
