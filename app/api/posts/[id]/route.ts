import { eq } from "drizzle-orm";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";
import { getDb } from "../../../../lib/db";
import { postPeople, posts } from "../../../../lib/db/schema";
import { findPost, hydratePost } from "../../../../lib/posts";
import { ensureDatabase } from "../../../../lib/db/ensure";
import { runImageJob } from "../../queues/generate-images/route";

export const runtime = "nodejs";

const updateSchema = z.object({
  status: z.enum(["complete", "error"]),
  error: z.string().max(2_000).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await findPost(id);
  if (!record) return Response.json({ error: "Post not found" }, { status: 404 });
  if (record.status === "pending" && record.imageNextAttemptAt <= new Date()) waitUntil(runImageJob(id));
  return Response.json({ id: record.id, status: record.status, error: record.error, post: hydratePost(record) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = updateSchema.parse(await request.json());
  await ensureDatabase();
  if (input.status === "complete") {
    const [post] = await getDb().select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
    const people = await getDb().select().from(postPeople).where(eq(postPeople.postId, id));
    if (!post.avatarUrl || !post.postImageUrl || people.length !== 4 || people.some((person) => !person.avatarUrl)) {
      return Response.json({ error: "Every roster and scene image must be persisted before completion" }, { status: 409 });
    }
  }
  const [record] = await getDb().update(posts).set({
    status: input.status,
    error: input.error,
    completedAt: input.status === "complete" ? new Date() : null,
  }).where(eq(posts.id, id)).returning();
  if (!record) return Response.json({ error: "Post not found" }, { status: 404 });
  return Response.json({ id, permalink: `/p/${id}`, post: hydratePost(record) });
}
