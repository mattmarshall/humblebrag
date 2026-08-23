import { waitUntil } from "@vercel/functions";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../../lib/db";
import { ensureDatabase } from "../../../../../lib/db/ensure";
import { posts } from "../../../../../lib/db/schema";
import { findPost } from "../../../../../lib/posts";
import { enqueuePostImages } from "../../../../../lib/image-jobs";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await findPost(id);
  if (!record) return Response.json({ error: "Post not found" }, { status: 404 });
  if (record.status === "complete") return Response.json({ id, status: "complete" });
  await ensureDatabase();
  await getDb().update(posts).set({ status: "pending", error: null, imageAttempts: 0, imageNextAttemptAt: new Date() }).where(eq(posts.id, id));
  waitUntil(enqueuePostImages(id));
  return Response.json({ id, status: "pending" }, { status: 202 });
}
