/**
 * Put a name on a brag.
 *
 * The gate's whole purpose: the visitor signs in (with what is really a
 * resumarsh account) and this route binds the post to them. Authorization is
 * decided by lib/claim.ts — see the warning there about why a session alone is
 * not enough on a public permalink.
 */
import { and, eq, isNotNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../../../../../lib/db";
import { posts } from "../../../../../lib/db/schema";
import { ensureDatabase } from "../../../../../lib/db/ensure";
import { CREATOR_COOKIE, canClaim, parseCreatorIds } from "../../../../../lib/claim";
import { recordShareEvent } from "../../../../../lib/share-events";
import { getSession } from "../../../../../lib/session";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureDatabase();

  const [record] = await getDb()
    .select({ id: posts.id, ownerUserId: posts.ownerUserId, ownerHandle: posts.ownerHandle, createdAt: posts.createdAt })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!record) return Response.json({ error: "Post not found" }, { status: 404 });

  const session = await getSession();
  const verdict = canClaim({
    post: { id: record.id, ownerUserId: record.ownerUserId, createdAt: record.createdAt },
    userId: session?.userId,
    creatorIds: parseCreatorIds((await cookies()).get(CREATOR_COOKIE)?.value),
    now: new Date(),
  });
  if (!verdict.ok) return Response.json({ error: verdict.error }, { status: verdict.status });
  if (verdict.alreadyMine) return Response.json({ id, ownerHandle: record.ownerHandle });

  // If resumarsh has already told us this person's handle (from an earlier
  // brag), carry it across now rather than waiting for the next callback.
  const [known] = await getDb()
    .select({ ownerHandle: posts.ownerHandle })
    .from(posts)
    .where(and(eq(posts.ownerUserId, session!.userId), isNotNull(posts.ownerHandle)))
    .limit(1);

  await getDb().update(posts).set({
    ownerUserId: session!.userId,
    ownerHandle: known?.ownerHandle ?? null,
    claimedAt: new Date(),
  }).where(eq(posts.id, id));

  await recordShareEvent({ postId: id, kind: "claim", userId: session!.userId });
  return Response.json({ id, ownerHandle: known?.ownerHandle ?? null });
}
