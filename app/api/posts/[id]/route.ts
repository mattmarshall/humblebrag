import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../../lib/db";
import { posts } from "../../../../lib/db/schema";
import { findPost, hydratePost } from "../../../../lib/posts";
import { ensureDatabase } from "../../../../lib/db/ensure";

export const runtime = "nodejs";

const updateSchema = z.object({
  status: z.enum(["complete", "error"]),
  error: z.string().max(2_000).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await findPost(id);
  if (!record) return Response.json({ error: "Post not found" }, { status: 404 });
  return Response.json({ id: record.id, status: record.status, post: hydratePost(record) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = updateSchema.parse(await request.json());
  await ensureDatabase();
  const [record] = await getDb().update(posts).set({
    status: input.status,
    error: input.error,
    completedAt: input.status === "complete" ? new Date() : null,
  }).where(eq(posts.id, id)).returning();
  if (!record) return Response.json({ error: "Post not found" }, { status: 404 });
  return Response.json({ id, permalink: `/p/${id}`, post: hydratePost(record) });
}
