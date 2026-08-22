import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../../../../lib/db";
import { ensureDatabase } from "../../../../lib/db/ensure";
import { postPeople, posts } from "../../../../lib/db/schema";
import { mediaUrl, personIdFromSlot, type ImageSlot } from "../../../../lib/media";
import { getJobStatus } from "../../../../lib/runpod";

export const runtime = "nodejs";

// RunPod does not sign webhook payloads, so nothing in the request body is
// trusted. We take only the job id from it and re-fetch the authoritative job
// record from RunPod with our API key. An attacker who guesses the URL can at
// most cause us to re-read a job that already exists.
export async function POST(request: Request) {
  let jobId: string | undefined;
  try {
    const body = await request.json() as { id?: string; jobId?: string };
    jobId = (body.id || body.jobId)?.trim();
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!jobId) return Response.json({ error: "Missing job id" }, { status: 400 });

  // An id RunPod does not recognise is a bad request, not a server fault.
  // Returning 500 also makes RunPod retry the delivery twice for nothing.
  let job;
  try {
    job = await getJobStatus(jobId);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unknown job";
    console.warn("[humblebrag:runpod-webhook] unknown job", { jobId, message });
    return Response.json({ error: "Unknown job" }, { status: 404 });
  }
  await ensureDatabase();

  // Bind the job to the post through our own record, not through the payload.
  const [post] = await getDb().select().from(posts).where(eq(posts.runpodJobId, jobId)).limit(1);
  if (!post) return Response.json({ error: "No post owns this job" }, { status: 404 });
  if (post.status === "complete") return Response.json({ ok: true, status: "complete" });

  if (job.status === "FAILED" || job.status === "CANCELLED" || job.status === "TIMED_OUT") {
    const message = job.error || `RunPod job ${job.status.toLowerCase()}`;
    await getDb().update(posts).set({ status: "error", error: message }).where(eq(posts.id, post.id));
    console.error("[humblebrag:runpod-webhook] job failed", { postId: post.id, jobId, message });
    return Response.json({ ok: true, status: "error" });
  }
  if (job.status !== "COMPLETED") return Response.json({ ok: true, status: job.status });

  // Slot names are the only thing taken from the worker; every URL is derived
  // from the post id, so a compromised worker cannot point a post at an
  // arbitrary image.
  const uploaded = (job.output?.uploaded || []).filter((slot): slot is ImageSlot =>
    slot === "avatar" || slot === "scene" || slot.startsWith("person:"));

  for (const slot of uploaded) {
    const url = mediaUrl(post.id, slot);
    if (slot === "avatar") {
      await getDb().update(posts).set({ avatarUrl: url }).where(eq(posts.id, post.id));
      await getDb().update(postPeople).set({ avatarUrl: url })
        .where(and(eq(postPeople.postId, post.id), eq(postPeople.id, post.payload.authorId)));
      continue;
    }
    if (slot === "scene") {
      await getDb().update(posts).set({ postImageUrl: url }).where(eq(posts.id, post.id));
      continue;
    }
    const personId = personIdFromSlot(slot);
    if (personId) {
      await getDb().update(postPeople).set({ avatarUrl: url })
        .where(and(eq(postPeople.postId, post.id), eq(postPeople.id, personId)));
    }
  }

  // Same completion invariant the API has always enforced: a post is only
  // complete once the scene and all four roster avatars are durable.
  const [fresh] = await getDb().select().from(posts).where(eq(posts.id, post.id)).limit(1);
  const withAvatars = await getDb().select({ id: postPeople.id }).from(postPeople)
    .where(and(eq(postPeople.postId, post.id), isNotNull(postPeople.avatarUrl)));
  const complete = Boolean(fresh?.avatarUrl && fresh?.postImageUrl && withAvatars.length === 4);

  if (complete) {
    await getDb().update(posts)
      .set({ status: "complete", error: null, completedAt: new Date() })
      .where(eq(posts.id, post.id));
    console.info("[humblebrag:runpod-webhook] completed", { postId: post.id, jobId });
  } else {
    const failed = job.output?.failed?.map((entry) => `${entry.slot}: ${entry.error}`).join("; ");
    await getDb().update(posts)
      .set({ status: "error", error: failed || "RunPod finished without producing every image" })
      .where(eq(posts.id, post.id));
    console.error("[humblebrag:runpod-webhook] incomplete", { postId: post.id, jobId, failed });
  }

  return Response.json({ ok: true, status: complete ? "complete" : "error" });
}
