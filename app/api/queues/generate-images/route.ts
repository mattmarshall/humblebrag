import { and, asc, eq, lte, sql } from "drizzle-orm";
import { getDb } from "../../../../lib/db";
import { ensureDatabase } from "../../../../lib/db/ensure";
import { posts } from "../../../../lib/db/schema";
import { findPost, hydratePost } from "../../../../lib/posts";
import { POST as generateImage } from "../../images/route";

export const runtime = "nodejs";
export const maxDuration = 300;

class PermanentImageJobError extends Error {}
class ImageQueueBusyError extends Error {}

async function acquireGlobalLease(postId: string) {
  await ensureDatabase();
  const result = await getDb().execute(sql`
    UPDATE "image_generation_lock"
    SET "holder" = ${postId}, "expires_at" = now() + interval '6 minutes'
    WHERE "id" = 'global'
      AND ("holder" = ${postId} OR "expires_at" <= now())
    RETURNING "holder"
  `);
  if (result.rows.length === 0) throw new ImageQueueBusyError("Another image job is using the Bedrock capacity lease");
}

async function releaseGlobalLease(postId: string) {
  await getDb().execute(sql`
    UPDATE "image_generation_lock"
    SET "holder" = NULL, "expires_at" = now()
    WHERE "id" = 'global' AND "holder" = ${postId}
  `);
}

async function requestImage(body: Record<string, unknown>) {
  const response = await generateImage(new Request("http://queue.internal/api/images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
  const result = await response.json() as { dataUrl?: string; url?: string; error?: string };
  if (response.ok) return result;
  const error = new Error(result.error || `Image generation failed (${response.status})`);
  if (response.status >= 400 && response.status < 500 && response.status !== 429) {
    throw new PermanentImageJobError(error.message);
  }
  throw error;
}

async function processPostImages(postId: string) {
  if (!postId) throw new PermanentImageJobError("postId is required");
  const record = await findPost(postId);
  if (!record) throw new PermanentImageJobError("Post not found");
  if (record.status === "complete") return;

  const post = hydratePost(record);
  const author = post.roster.find((person) => person.id === post.authorId);
  if (!author) throw new PermanentImageJobError("Post author is missing from the roster");

  let authorReference: string | undefined;
  if (!post.avatarUrl) {
    const avatar = await requestImage({
      kind: "avatar", postId, personId: post.authorId, network: post.network,
      prompt: post.avatarPrompt, seed: post.imageSeed,
    });
    authorReference = avatar.dataUrl;
  }

  if (!post.postImageUrl) {
    await requestImage({
      kind: "post", postId, network: post.network, prompt: post.postImagePrompt,
      seed: post.imageSeed, referenceImageDataUrl: authorReference,
    });
  }

  for (let index = 0; index < post.roster.length; index += 1) {
    const person = post.roster[index];
    if (person.role !== "commenter" || person.avatarUrl) continue;
    await requestImage({
      kind: "person", postId, personId: person.id, network: post.network,
      prompt: person.avatarPrompt,
      seed: Math.min(4_294_967_294, post.imageSeed + index + 1),
    });
  }

  await ensureDatabase();
  await getDb().update(posts).set({ status: "complete", error: null, completedAt: new Date() }).where(eq(posts.id, postId));
}

export async function runImageJob(postId: string) {
  let leased = false;
  try {
    await acquireGlobalLease(postId);
    leased = true;
    const record = await findPost(postId);
    if (!record || record.status === "complete") return;
    const attempt = record.imageAttempts + 1;
    await getDb().update(posts).set({ imageAttempts: attempt }).where(eq(posts.id, postId));
    await processPostImages(postId);
    console.info("[humblebrag:image-queue] completed", { postId, attempt });
  } catch (cause) {
    const messageText = cause instanceof Error ? cause.message : "Image generation failed";
    if (cause instanceof ImageQueueBusyError) return;
    const record = await findPost(postId);
    const attempt = record?.imageAttempts || 1;
    if (cause instanceof PermanentImageJobError) {
      await ensureDatabase();
      await getDb().update(posts).set({ status: "error", error: messageText }).where(eq(posts.id, postId));
      console.error("[humblebrag:image-queue] permanent failure", { postId, message: messageText });
      return;
    }
    if (attempt >= 8) {
      await ensureDatabase();
      await getDb().update(posts).set({ status: "error", error: `Image generation exhausted its retry budget: ${messageText}` }).where(eq(posts.id, postId));
      console.error("[humblebrag:image-queue] retry budget exhausted", { postId, attempt, message: messageText });
      return;
    }
    const delaySeconds = Math.min(300, 10 * (2 ** Math.max(0, attempt - 1)));
    await getDb().update(posts).set({
      status: "pending",
      error: messageText,
      imageNextAttemptAt: new Date(Date.now() + delaySeconds * 1_000),
    }).where(eq(posts.id, postId));
    console.warn("[humblebrag:image-queue] scheduled retry", { postId, attempt, delaySeconds, message: messageText });
  } finally {
    if (leased) await releaseGlobalLease(postId);
  }
}

export async function GET() {
  await ensureDatabase();
  const [next] = await getDb().select({ id: posts.id }).from(posts)
    .where(and(eq(posts.status, "pending"), lte(posts.imageNextAttemptAt, new Date())))
    .orderBy(asc(posts.createdAt)).limit(1);
  if (!next) return Response.json({ ok: true, processed: false });
  await runImageJob(next.id);
  return Response.json({ ok: true, processed: true, postId: next.id });
}
